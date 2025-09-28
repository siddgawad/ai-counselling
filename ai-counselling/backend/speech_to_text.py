# sr_transcribe_s3_auto_robust.py
import os, tempfile, subprocess, json
from io import BytesIO
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.config import Config
from pydub import AudioSegment, effects
from pydub.effects import high_pass_filter, low_pass_filter, compress_dynamic_range
import speech_recognition as sr

# ---------- config ----------
CHUNK_SEC = 50
LANG = "en-US"
MIN_SIZE_BYTES = 8192   # skip tiny/partial chunks
# ---------------------------

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET  = os.getenv("DEFAULT_BUCKET")
USERS_BASE_PREFIX = os.getenv("USERS_BASE_PREFIX", "users/")
RECORD_SUBPATH    = os.getenv("RECORD_SUBPATH", "audio/webm/")

if not S3_BUCKET:
    raise SystemExit("Set S3_BUCKET (and AWS creds) in .env")

def _s3():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        config=Config(retries={"max_attempts": 5, "mode": "standard"})
    )

def list_users(bucket: str, base_prefix: str):
    s3 = _s3()
    out = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=base_prefix.rstrip("/") + "/", Delimiter="/"):
        for cp in page.get("CommonPrefixes", []) or []:
            out.append(cp["Prefix"].split("/", 1)[1].rstrip("/"))  # user_xxx
    return out

def list_latest_objects(bucket: str, users_base: str, record_subpath: str, limit=50):
    """Return newest objects across ALL users, sorted desc by LastModified."""
    s3 = _s3()
    items = []
    paginator = s3.get_paginator("list_objects_v2")
    users = list_users(bucket, users_base)
    for user in users:
        prefix = f"{users_base.rstrip('/')}/{user}/{record_subpath.strip('/')}/"
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []) or []:
                key, size, ts = obj["Key"], obj.get("Size", 0), obj.get("LastModified")
                if key.endswith("/") or size < MIN_SIZE_BYTES:  # skip folders & tiny chunks
                    continue
                items.append({"Key": key, "Size": size, "LastModified": ts})
    items.sort(key=lambda x: x["LastModified"], reverse=True)
    return items[:limit]

def download_to_temp(bucket: str, key: str) -> str:
    s3 = _s3()
    suffix = Path(key).suffix or ".bin"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp_path = tmp.name; tmp.close()
    with open(tmp_path, "wb") as f:
        s3.download_fileobj(bucket, key, f)
    return tmp_path

# ---- robust decode helpers ----
def ffmpeg_decode_to_wav_bytes(in_path: str) -> bytes:
    """Try a tolerant ffmpeg transcode to mono 16k WAV -> bytes."""
    cmd = [
        "ffmpeg", "-v", "error",
        "-fflags", "+genpts+discardcorrupt",
        "-err_detect", "ignore_err",
        "-i", in_path,
        "-ac", "1", "-ar", "16000",
        "-f", "wav", "pipe:1"
    ]
    return subprocess.check_output(cmd, stderr=subprocess.STDOUT)

def load_audio_robust(in_path: str) -> AudioSegment:
    """
    Try pydub first; if it fails, fall back to ffmpeg CLI to WAV bytes.
    Raise on hard failure so caller can try an older object.
    """
    try:
        return AudioSegment.from_file(in_path)
    except Exception:
        # Fallback: tolerant decode to WAV bytes
        pcm = ffmpeg_decode_to_wav_bytes(in_path)
        return AudioSegment.from_file(BytesIO(pcm), format="wav")

# ---- preprocessing + ASR ----
def preprocess(seg: AudioSegment) -> AudioSegment:
    seg = seg.set_channels(1).set_frame_rate(16000)
    seg = high_pass_filter(seg, cutoff=100)
    seg = low_pass_filter(seg, cutoff=8000)
    seg = effects.normalize(seg)
    seg = compress_dynamic_range(seg, threshold=-20.0, ratio=4.0, attack=5, release=50)
    return seg

def chunk(seg: AudioSegment, seconds=CHUNK_SEC):
    step = int(seconds * 1000)
    return [seg[i:i+step] for i in range(0, len(seg), step)]

def transcribe_key(bucket: str, key: str) -> str:
    print(f"Trying: s3://{bucket}/{key}")
    local = download_to_temp(bucket, key)
    try:
        raw = load_audio_robust(local)      # <-- tolerant loader
        audio = preprocess(raw)
        parts = chunk(audio)
        r = sr.Recognizer()
        texts = []
        with tempfile.TemporaryDirectory() as td:
            for i, p in enumerate(parts, 1):
                wav_path = os.path.join(td, f"part_{i}.wav")
                p.export(wav_path, format="wav")
                with sr.AudioFile(wav_path) as src:
                    r.adjust_for_ambient_noise(src, duration=0.3)
                    audio_chunk = r.record(src)
                try:
                    res = r.recognize_google(audio_chunk, language=LANG, show_all=True)
                    if isinstance(res, dict) and res.get("alternative"):
                        best = max(res["alternative"], key=lambda a: a.get("confidence", 0))
                        texts.append((best.get("transcript") or "").strip())
                    else:
                        texts.append(r.recognize_google(audio_chunk, language=LANG).strip())
                    print(f"[{i}/{len(parts)}] ✓")
                except sr.UnknownValueError:
                    print(f"[{i}/{len(parts)}] (no speech recognized)")
                except sr.RequestError as e:
                    raise SystemExit(f"[{i}/{len(parts)}] API error: {e}")
        out = " ".join(t for t in texts if t).strip()
        if not out:
            raise RuntimeError("Empty transcript (audio may be silence).")
        return out
    finally:
        try: os.remove(local)
        except OSError: pass

def collect_last_k_decodable(bucket: str, candidates: list[dict], k: int = 3):
    """Try candidates newest->oldest, decode those that work (up to k), return a single concatenated AudioSegment."""
    got = []
    for obj in candidates:
        key = obj["Key"]
        try:
            local = download_to_temp(bucket, key)
            raw = load_audio_robust(local)
            got.append(raw)
            print(f"collected: {key}")
            if len(got) >= k:
                break
        except Exception as e:
            print(f"skip {key}: {e}")
        finally:
            try: os.remove(local)
            except: pass
    if not got:
        raise RuntimeError("No decodable audio found.")
    # concatenate and preprocess once
    merged = got[0]
    for seg in got[1:]:
        merged += seg
    return preprocess(merged)

def transcribe_latest_concat(bucket: str, k: int = 3, pool=30) -> str:
    # newest N across all users (you already have list_latest_objects)
    candidates = list_latest_objects(bucket, USERS_BASE_PREFIX, RECORD_SUBPATH, limit=pool)
    merged = collect_last_k_decodable(bucket, candidates, k=k)
    parts = chunk(merged)
    r = sr.Recognizer()
    out = []
    with tempfile.TemporaryDirectory() as td:
        for i, p in enumerate(parts, 1):
            wav = os.path.join(td, f"part_{i}.wav")
            p.export(wav, format="wav")
            with sr.AudioFile(wav) as src:
                r.adjust_for_ambient_noise(src, duration=0.3)
                audio_chunk = r.record(src)
            try:
                res = r.recognize_google(audio_chunk, language=LANG, show_all=True)
                if isinstance(res, dict) and res.get("alternative"):
                    best = max(res["alternative"], key=lambda a: a.get("confidence", 0))
                    out.append((best.get("transcript") or "").strip())
                else:
                    out.append(r.recognize_google(audio_chunk, language=LANG).strip())
                print(f"[{i}/{len(parts)}] ✓")
            except sr.UnknownValueError:
                print(f"[{i}/{len(parts)}] (no speech recognized)")
            except sr.RequestError as e:
                raise SystemExit(f"[{i}/{len(parts)}] API error: {e}")
    return " ".join(t for t in out if t).strip()

