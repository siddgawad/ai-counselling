import os, time, uuid, traceback
from dotenv import load_dotenv
load_dotenv()  # read .env if present

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
import shutil
import librosa
import boto3, botocore
from speech import SpeechProcessor  # our analyzer

# ---- Config ----
DEFAULT_BUCKET = os.getenv("DEFAULT_BUCKET", "")
MAX_BYTES_IN_MEMORY = int(os.getenv("MAX_BYTES_IN_MEMORY", "52428800"))
ALLOWED_EXTS = {e.strip().lower() for e in os.getenv(
    "ALLOWED_EXTS", ".wav,.mp3,.flac,.m4a,.webm"
).split(",")}
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"

# dynamic user path pieces (kept in env so you can change structure once)
USERS_BASE_PREFIX = os.getenv("USERS_BASE_PREFIX", "users/")
RECORD_SUBPATH   = os.getenv("RECORD_SUBPATH", "audio/webm/")

def make_s3_client():
    """Create an S3 client from env (or IAM role if running on AWS)."""
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    try:
        if access_key and secret_key:
            return boto3.client(
                "s3",
                region_name=AWS_REGION,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
        # Fall back to default provider chain (credentials file, IAM role, etc.)
        return boto3.client("s3", region_name=AWS_REGION)
    except Exception as e:
        raise RuntimeError(f"Failed to create S3 client: {e}")

_s3 = make_s3_client()

# ---- Helpers ----
def is_allowed_key(key: str) -> bool:
    k = key.lower()
    if looks_like_prefix(k):
        return True
    return any(k.endswith(ext) for ext in ALLOWED_EXTS)

def head_object(bucket: str, key: str):
    resp = _s3.head_object(Bucket=bucket, Key=key)
    return resp.get("ContentLength", 0), resp.get("ContentType")

def list_objects(bucket: str, prefix: str, limit: Optional[int] = None):
    """Yield objects (dicts with Key, Size, LastModified) under a prefix."""
    paginator = _s3.get_paginator("list_objects_v2")
    count = 0
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []) or []:
            key = obj["Key"]
            if key.endswith("/"):
                continue
            yield {"Key": key, "Size": obj.get("Size", 0), "LastModified": obj.get("LastModified")}
            count += 1
            if limit and count >= limit:
                return

def looks_like_prefix(key: str) -> bool:
    if not key:
        return False
    if key.endswith("/"):
        return True
    tail = key.split("/")[-1]
    return "." not in tail  # no extension => treat as folder-like

def build_user_prefix(user_id: str) -> str:
    base = USERS_BASE_PREFIX if USERS_BASE_PREFIX.endswith("/") else USERS_BASE_PREFIX + "/"
    sub  = RECORD_SUBPATH     if RECORD_SUBPATH.endswith("/")     else RECORD_SUBPATH + "/"
    return f"{base}{user_id}/{sub}"

def list_common_prefixes(bucket: str, prefix: str) -> List[str]:
    """Return 'folders' (common prefixes) one level below prefix."""
    out: List[str] = []
    paginator = _s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for cp in page.get("CommonPrefixes", []) or []:
            p = cp.get("Prefix")
            if p:
                out.append(p)
    return out

def latest_user_with_audio(bucket: str) -> Optional[str]:
    """Pick the user whose recordings path contains the most-recent object."""
    base = USERS_BASE_PREFIX if USERS_BASE_PREFIX.endswith("/") else USERS_BASE_PREFIX + "/"
    users = list_common_prefixes(bucket, base)  # e.g., ['users/user_X/', ...]
    best_user_id, best_ts = None, None
    paginator = _s3.get_paginator("list_objects_v2")

    for uprefix in users:
        user_id = uprefix.removeprefix(base).strip("/")
        rec_prefix = build_user_prefix(user_id)
        latest = None
        for page in paginator.paginate(Bucket=bucket, Prefix=rec_prefix):
            for obj in page.get("Contents", []) or []:
                ts = obj.get("LastModified")
                if ts and (latest is None or ts > latest):
                    latest = ts
        if latest is not None and (best_ts is None or latest > best_ts):
            best_ts = latest
            best_user_id = user_id

    return best_user_id

# ---- API models ----
class ProcessRequest(BaseModel):
    bucket: Optional[str] = Field(default=None, description="S3 bucket; uses DEFAULT_BUCKET if omitted")
    key: Optional[str] = Field(default="", description="S3 key (file) or prefix (folder). Leave empty if using options.user_id or options.user='latest'.")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("key")
    @classmethod
    def check_key(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        if v.startswith("/") or ".." in v:
            raise ValueError("Invalid S3 key")
        return v

class ProcessResponse(BaseModel):
    request_id: str
    input: Dict[str, Any]
    result: Dict[str, Any]
    meta: Dict[str, Any]

# ---- App ----
app = FastAPI(title="Speech Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost", "http://127.0.0.1"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

# -------- Debug routes (handy while wiring S3) --------
@app.get("/debug/ls")
def debug_ls(prefix: str, bucket: Optional[str] = None, limit: int = 50):
    b = bucket or DEFAULT_BUCKET
    if not b:
        return {"error": "DEFAULT_BUCKET not set and no bucket param provided."}
    items = list(list_objects(b, prefix, limit=limit))
    return {"bucket": b, "prefix": prefix, "count": len(items), "items": items}
    
@app.get("/debug/probe")
def debug_probe(prefix: str, bucket: Optional[str] = None):
    """
    Download the first audio file under `prefix` and try to decode it with librosa.
    Returns what went wrong if decoding fails (e.g., missing ffmpeg).
    """
    b = bucket or DEFAULT_BUCKET
    if not b:
        return {"error": "DEFAULT_BUCKET not set and no bucket param provided."}

    ffmpeg = shutil.which("ffmpeg")
    found = next((obj for obj in list_objects(b, prefix, limit=10)
                  if any(obj["Key"].lower().endswith(ext) for ext in ALLOWED_EXTS)), None)
    if not found:
        return {"bucket": b, "prefix": prefix, "ffmpeg": ffmpeg, "error": "No audio files found under prefix"}

    key = found["Key"]
    try:
        import tempfile
        suffix = (os.path.splitext(key)[1] or ".wav").lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            _s3.download_fileobj(b, key, tmp)
            path = tmp.name
        # try to decode
        y, sr = librosa.load(path, sr=16000, mono=True)
        dur = len(y) / 16000.0
        os.remove(path)
        return {"bucket": b, "key": key, "ffmpeg": ffmpeg, "decoded": True, "duration_s": dur}
    except Exception as e:
        try:
            os.remove(path)
        except Exception:
            pass
        return {"bucket": b, "key": key, "ffmpeg": ffmpeg, "decoded": False, "error": f"{type(e).__name__}: {e}"}

@app.get("/debug/tree")
def debug_tree(prefix: str = "", bucket: Optional[str] = None, limit: int = 100):
    b = bucket or DEFAULT_BUCKET
    if not b:
        return {"error": "DEFAULT_BUCKET not set and no bucket param provided."}
    out = {"bucket": b, "prefix": prefix, "common_prefixes": [], "items": []}
    try:
        paginator = _s3.get_paginator("list_objects_v2")
        count_items = 0
        for page in paginator.paginate(Bucket=b, Prefix=prefix, Delimiter="/"):
            for cp in page.get("CommonPrefixes", []) or []:
                out["common_prefixes"].append(cp.get("Prefix"))
            for obj in page.get("Contents", []) or []:
                key = obj["Key"]
                if key.endswith("/"):
                    continue
                out["items"].append({"key": key, "size": obj.get("Size", 0)})
                count_items += 1
                if count_items >= limit:
                    break
        return out
    except botocore.exceptions.ClientError as e:
        return {"bucket": b, "prefix": prefix, "error": str(e)}

@app.get("/debug/users")
def debug_users():
    b = DEFAULT_BUCKET
    base = USERS_BASE_PREFIX if USERS_BASE_PREFIX.endswith("/") else USERS_BASE_PREFIX + "/"
    users = list_common_prefixes(b, base)
    return {"bucket": b, "base": base, "users": [u.removeprefix(base).strip("/") for u in users]}

# ------------- Main processing endpoint -------------
@app.post("/process", response_model=ProcessResponse)
def process(req: ProcessRequest):
    rid = str(uuid.uuid4())
    t0 = time.time()

    bucket = req.bucket or DEFAULT_BUCKET
    if not bucket:
        raise HTTPException(status_code=400, detail={
            "request_id": rid, "code": "BAD_INPUT",
            "message": "Bucket not provided and DEFAULT_BUCKET not set"
        })

    # ----- dynamic key building from options -----
    user_id_opt = (req.options or {}).get("user_id")
    user_auto = (req.options or {}).get("user", "").lower() == "latest"

    if user_id_opt and not req.key:
        req.key = build_user_prefix(user_id_opt)

    if (user_auto and (not req.key or req.key.rstrip("/") == USERS_BASE_PREFIX.rstrip("/"))):
        uid = latest_user_with_audio(bucket)
        if not uid:
            raise HTTPException(status_code=404, detail={
                "request_id": rid, "code": "NO_USERS_WITH_AUDIO",
                "message": f"No audio found under base '{USERS_BASE_PREFIX}'"
            })
        req.key = build_user_prefix(uid)

    if not req.key:
        raise HTTPException(status_code=400, detail={
            "request_id": rid, "code": "BAD_INPUT",
            "message": "Provide 'key', or set options.user_id, or options.user='latest'."
        })

    if not is_allowed_key(req.key):
        raise HTTPException(status_code=415, detail={
            "request_id": rid, "code": "UNSUPPORTED_MEDIA_TYPE",
            "message": f"Key must end with one of: {sorted(ALLOWED_EXTS)} or be a folder/prefix"
        })

    frames_mode = looks_like_prefix(req.key)
    per_file = bool((req.options or {}).get("per_file", True))  # default: analyze each file under prefix
    min_size_bytes = int((req.options or {}).get("min_size_bytes", 2048))  # skip super tiny frames by default

    # Single-file sanity (size/type)
    ctype = None
    size = 0
    if not frames_mode:
        try:
            size, ctype = head_object(bucket, req.key)
        except botocore.exceptions.ClientError as e:
            status = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 500)
            if status == 404:
                raise HTTPException(status_code=404, detail={"request_id": rid, "code": "S3_NOT_FOUND", "message": "Object not found"})
            elif status == 403:
                raise HTTPException(status_code=403, detail={"request_id": rid, "code": "S3_FORBIDDEN", "message": "Access denied"})
            else:
                raise HTTPException(status_code=502, detail={"request_id": rid, "code": "S3_ERROR", "message": "S3 error"})
        if size > MAX_BYTES_IN_MEMORY:
            raise HTTPException(status_code=413, detail={
                "request_id": rid, "code": "PAYLOAD_TOO_LARGE",
                "message": f"Object is {size} bytes which exceeds MAX_BYTES_IN_MEMORY={MAX_BYTES_IN_MEMORY}"
            })

    # Delegate S3 fetch + processing to the speech package
    t_cmp0 = time.time()
    sp = SpeechProcessor(**(req.options or {}))
    try:
        if frames_mode and per_file:
            # iterate each file under prefix and analyze individually (tolerant of bad frames)
            frames = []
            errors = []
            total_bytes = 0
            total_download_ms = 0
            count = 0

            for obj in list_objects(bucket, req.key):
                key = obj["Key"]
                size_b = int(obj.get("Size", 0))

                # extension filter
                if not any(key.lower().endswith(ext) for ext in ALLOWED_EXTS):
                    continue
                # tiny file guard
                if size_b < min_size_bytes:
                    errors.append({"key": key, "error": f"TooSmall: {size_b} < {min_size_bytes} bytes"})
                    continue
                # skip too-large parts (optional)
                if size_b > MAX_BYTES_IN_MEMORY:
                    errors.append({"key": key, "error": f"TooLarge: {size_b} > {MAX_BYTES_IN_MEMORY} bytes"})
                    continue

                try:
                    analysis, download_ms = sp.process_s3(bucket, key, s3_client=_s3)
                    frames.append({
                        "key": key,
                        "size_bytes": size_b,
                        "download_ms": download_ms,
                        "result": analysis,
                    })
                    total_bytes += size_b
                    total_download_ms += download_ms
                    count += 1
                except Exception as e:
                    errors.append({"key": key, "error": f"{type(e).__name__}: {e}"})
                    continue

            if not frames and errors:
                # Everything failed – surface details
                raise HTTPException(status_code=422, detail={
                    "request_id": rid,
                    "code": "ALL_FRAMES_FAILED",
                    "message": "All audio files under prefix failed to decode/process",
                    "errors": errors,
                })
            if not frames and not errors:
                # Truly nothing there
                raise HTTPException(status_code=404, detail={
                    "request_id": rid, "code": "NO_FRAMES", "message": "No audio files found under prefix"
                })

            analysis = {"frames": frames}
            if errors:
                analysis["errors"] = errors

            size = total_bytes
            meta_extra = {
                "frames_mode": True,
                "per_file": True,
                "frames_count": count,
                "sum_download_ms": total_download_ms,
                "skipped_or_failed": len(errors),
                "min_size_bytes": min_size_bytes,
            }

        elif frames_mode and not per_file:
            # concatenate all frames into one waveform and analyze once
            try:
                analysis, download_ms, file_count, total_bytes = sp.process_s3_frames(bucket, req.key, s3_client=_s3)
            except Exception as e:
                raise HTTPException(status_code=422, detail={
                    "request_id": rid, "code": "CONCAT_FAILED", "message": f"{type(e).__name__}: {e}"
                })
            size = total_bytes
            meta_extra = {"frames_mode": True, "per_file": False, "frames_count": file_count, "download_ms": download_ms}

        else:
            # single file
            analysis, download_ms = sp.process_s3(bucket, req.key, s3_client=_s3)
            meta_extra = {"frames_mode": False, "per_file": False, "download_ms": download_ms}

    except HTTPException as he:
        # preserve detailed messages like NO_FRAMES, ALL_FRAMES_FAILED, CONCAT_FAILED, etc.
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail={
            "request_id": rid,
            "code": "PROCESSING_FAILED",
            "message": f"{type(e).__name__}: {e}" or "Unknown error"
        })
    t_cmp1 = time.time()

    return {
        "request_id": rid,
        "input": {"bucket": bucket, "key": req.key, "options": req.options or {}},
        "result": analysis,
        "meta": {
            "content_type": ctype,
            "size_bytes": size,
            "downloaded_bytes": size,
            "compute_ms": int((t_cmp1 - t_cmp0) * 1000),
            "total_ms": int((time.time() - t0) * 1000),
            **meta_extra,
        }
    }

# ------------------- CLI runner -------------------
if __name__ == "__main__":
    import argparse, json, sys

    parser = argparse.ArgumentParser(description="Run speech analysis from S3 (single file or frames prefix) or serve API.")
    parser.add_argument("--key", help="S3 key (file) or prefix (folder). Leave blank to use options/user helpers.", default=os.getenv("TEST_KEY", ""))
    parser.add_argument("--bucket", help="S3 bucket (overrides DEFAULT_BUCKET env).", default=os.getenv("DEFAULT_BUCKET", ""))
    parser.add_argument("--num-runs", type=int, default=5, help="Ensemble runs per chunk.")
    parser.add_argument("--per-file", action="store_true", help="Frames mode: analyze each file separately (default).")
    parser.add_argument("--concat", dest="per_file", action="store_false", help="Frames mode: concatenate all frames then analyze once.")
    parser.set_defaults(per_file=True)
    parser.add_argument("--user-id", default="", help="If set and no key provided, build users/<id>/audio/webm/")
    parser.add_argument("--latest", action="store_true", help="If set and no key provided, pick latest user with audio.")
    parser.add_argument("--serve", action="store_true", help="Start FastAPI server instead of one-off run.")
    parser.add_argument("--host", default="0.0.0.0", help="Host for --serve")
    parser.add_argument("--port", type=int, default=8000, help="Port for --serve")
    args = parser.parse_args()

    if args.serve:
        import uvicorn
        uvicorn.run("speech_backend:app", host=args.host, port=args.port, reload=False)
        sys.exit(0)

    # Build key from helpers if absent
    key = args.key or ""
    bucket = args.bucket or DEFAULT_BUCKET
    if not bucket:
        print("ERROR: Bucket not provided and DEFAULT_BUCKET not set. Use --bucket or set DEFAULT_BUCKET in .env", file=sys.stderr)
        sys.exit(2)

    if not key and args.user_id:
        key = build_user_prefix(args.user_id)
    if not key and args.latest:
        uid = latest_user_with_audio(bucket)
        if not uid:
            print(f"ERROR: No users with audio found under base '{USERS_BASE_PREFIX}'", file=sys.stderr)
            sys.exit(3)
        key = build_user_prefix(uid)

    if not key:
        print("ERROR: Provide --key OR --user-id OR --latest", file=sys.stderr)
        sys.exit(2)

    print(f"[debug] bucket={bucket!r} key={key!r} frames_mode={looks_like_prefix(key)} per_file={args.per_file}")

    sp = SpeechProcessor(num_runs=args.num_runs)
    try:
        if looks_like_prefix(key):
            if args.per_file:
                frames = []
                total_bytes = 0
                total_download_ms = 0
                for obj in list_objects(bucket, key):
                    k = obj["Key"]
                    if not any(k.lower().endswith(ext) for ext in ALLOWED_EXTS):
                        continue
                    analysis, download_ms = sp.process_s3(bucket, k, s3_client=_s3)
                    frames.append({"key": k, "size_bytes": obj["Size"], "download_ms": download_ms, "result": analysis})
                    total_bytes += obj["Size"]
                    total_download_ms += download_ms
                if not frames:
                    print("ERROR: No audio files found under prefix", file=sys.stderr)
                    sys.exit(4)
                output = {
                    "input": {"bucket": bucket, "key": key, "num_runs": args.num_runs, "per_file": True},
                    "result": {"frames": frames},
                    "meta": {"frames_mode": True, "per_file": True, "frames_count": len(frames), "size_bytes": total_bytes, "sum_download_ms": total_download_ms},
                }
                print(json.dumps(output, indent=2))
            else:
                analysis, download_ms, file_count, total_bytes = sp.process_s3_frames(bucket, key, s3_client=_s3)
                output = {
                    "input": {"bucket": bucket, "key": key, "num_runs": args.num_runs, "per_file": False},
                    "result": analysis,
                    "meta": {"frames_mode": True, "per_file": False, "frames_count": file_count, "size_bytes": total_bytes, "download_ms": download_ms},
                }
                print(json.dumps(output, indent=2))
        else:
            # single file
            try:
                size, ctype = head_object(bucket, key)
            except Exception:
                size, ctype = None, None
            analysis, download_ms = sp.process_s3(bucket, key, s3_client=_s3)
            output = {
                "input": {"bucket": bucket, "key": key, "num_runs": args.num_runs},
                "result": analysis,
                "meta": {"frames_mode": False, "size_bytes": size, "content_type": ctype, "download_ms": download_ms},
            }
            print(json.dumps(output, indent=2))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
