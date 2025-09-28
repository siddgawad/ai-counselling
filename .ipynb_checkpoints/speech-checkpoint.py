from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2FeatureExtractor
import torch
import librosa
import math
import numpy as np
import os
import io
import tempfile
import time
import boto3
from collections import Counter
import warnings

warnings.filterwarnings('ignore')


# ----------------------------- Model wrapper -----------------------------

class EnsembleEmotionRecognizer:
    def __init__(self, model_name="r-f/wav2vec-english-speech-emotion-recognition", num_runs=5):
        self.feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
        self.model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)
        self.model.eval()
        self.num_runs = num_runs

        # Confidence thresholds (unused in logic, kept for clarity)
        self.high_confidence_threshold = 0.7
        self.medium_confidence_threshold = 0.5

    def is_valid_speech(self, audio_chunk: np.ndarray, sr: int) -> bool:
        """Basic sanity checks to skip silence/noise chunks."""
        if audio_chunk.size == 0:
            return False
        rms = float(np.sqrt(np.mean(audio_chunk**2)))
        if rms < 0.005:
            return False

        try:
            zcr = float(np.mean(librosa.feature.zero_crossing_rate(audio_chunk)[0]))
            if zcr > 0.4:
                return False
        except Exception:
            pass

        try:
            spectral_centroid = librosa.feature.spectral_centroid(y=audio_chunk, sr=sr)[0]
            spec_centroid_mean = float(np.mean(spectral_centroid))
            if spec_centroid_mean < 300 or spec_centroid_mean > 8000:
                return False
        except Exception:
            pass

        return True

    def predict_single_chunk(self, audio_chunk: np.ndarray, sr: int):
        """Return (emotion, confidence) for a single chunk, or (None, 0.0) if invalid."""
        if not self.is_valid_speech(audio_chunk, sr):
            return None, 0.0

        try:
            inputs = self.feature_extractor(audio_chunk, sampling_rate=sr, return_tensors="pt", padding=True)
            with torch.no_grad():
                logits = self.model(**inputs).logits
            probs = torch.softmax(logits.squeeze(0), dim=-1)
            top_prob, predicted_id = torch.max(probs, dim=-1)
            emotion = self.model.config.id2label[predicted_id.item()]
            return emotion, float(top_prob.item())
        except Exception:
            return None, 0.0

    def predict_chunk_ensemble(self, audio_chunk: np.ndarray, sr: int):
        """Run multiple predictions and return majority-vote emotion + ensemble confidence."""
        predictions, confidences = [], []
        for _ in range(self.num_runs):
            emotion, conf = self.predict_single_chunk(audio_chunk, sr)
            if emotion is not None:
                predictions.append(emotion)
                confidences.append(conf)
        if not predictions:
            return None, 0.0

        counts = Counter(predictions)
        final_emotion, vote_count = counts.most_common(1)[0]
        vote_ratio = vote_count / len(predictions)
        emo_conf = [c for e, c in zip(predictions, confidences) if e == final_emotion]
        ensemble_confidence = float(vote_ratio * (np.mean(emo_conf) if emo_conf else 0.0))
        return final_emotion, ensemble_confidence

    def process_audio(self, audio_file: str):
        """Process a single audio file path (any format librosa can decode)."""
        sr_target = 16000
        print(f"Running ensemble emotion recognition ({self.num_runs} runs per chunk)...")
        y, sr = librosa.load(audio_file, sr=sr_target, mono=True)
        y = librosa.util.normalize(y)
        y, _ = librosa.effects.trim(y, top_db=20)

        total_duration = len(y) / sr_target
        print(f"Processing audio: {total_duration:.2f} seconds")

        # Chunking
        chunk_dur = 1.0
        overlap_dur = 0.5
        chunk_size = int(chunk_dur * sr_target)
        overlap_size = int(overlap_dur * sr_target)
        step = chunk_size - overlap_size

        results = []
        if len(y) < chunk_size // 3:
            return results

        num_chunks = max(0, math.ceil((len(y) - chunk_size) / step) + 1)
        for i in range(num_chunks):
            start = i * step
            end = min(start + chunk_size, len(y))
            if end - start < chunk_size // 3:
                break
            chunk = y[start:end]
            if len(chunk) < chunk_size:
                chunk = np.pad(chunk, (0, chunk_size - len(chunk)), mode='constant')
            emotion, conf = self.predict_chunk_ensemble(chunk, sr_target)
            if emotion is None:
                continue
            results.append({
                "emotion": emotion,
                "confidence": float(conf),
                "start": start / sr_target,
                "end": min(end / sr_target, total_duration),
            })

        print("Ensemble processing complete!")
        return results


# ------------------------ Analysis helper functions ------------------------

def _summarize_results_to_dict(results: list[dict]) -> dict | None:
    if not results:
        return None

    # Merge consecutive identical emotions into phases
    phases, current = [], None
    for r in results:
        if current is None or current["emotion"] != r["emotion"]:
            if current is not None:
                phases.append(current)
            current = {
                "emotion": r["emotion"],
                "start": r["start"],
                "end": r["end"],
                "confidences": [r["confidence"]],
            }
        else:
            current["end"] = r["end"]
            current["confidences"].append(r["confidence"])
    if current is not None:
        phases.append(current)

    total_duration = results[-1]["end"] - results[0]["start"]
    durations = {}
    for p in phases:
        durations[p["emotion"]] = durations.get(p["emotion"], 0.0) + (p["end"] - p["start"])
    all_conf = [r["confidence"] for r in results]

    return {
        "phases": phases,
        "distribution": durations,
        "total_duration": float(total_duration),
        "avg_confidence": float(np.mean(all_conf)) if all_conf else 0.0,
    }


def analyze_audio_array(waveform: np.ndarray, rate: int, num_runs=5) -> dict | None:
    rec = EnsembleEmotionRecognizer(num_runs=num_runs)
    y = librosa.util.normalize(waveform.astype(np.float32, copy=False))
    y, _ = librosa.effects.trim(y, top_db=20)

    sr_target = rate
    chunk_dur, overlap_dur = 1.0, 0.5
    chunk_size, overlap_size = int(chunk_dur * sr_target), int(overlap_dur * sr_target)
    step = chunk_size - overlap_size

    if len(y) < chunk_size // 3:
        return None

    results = []
    num_chunks = max(0, math.ceil((len(y) - chunk_size) / step) + 1)
    for i in range(num_chunks):
        start = i * step
        end = min(start + chunk_size, len(y))
        if end - start < chunk_size // 3:
            break
        chunk = y[start:end]
        if len(chunk) < chunk_size:
            chunk = np.pad(chunk, (0, chunk_size - len(chunk)), mode='constant')

        emotion, conf = rec.predict_chunk_ensemble(chunk, sr_target)
        if emotion is None:
            continue
        results.append({"emotion": emotion, "confidence": float(conf), "start": start / sr_target, "end": end / sr_target})

    return _summarize_results_to_dict(results)


def analyze_audio_ensemble(audio_file: str, num_runs=5) -> dict | None:
    rec = EnsembleEmotionRecognizer(num_runs=num_runs)
    results = rec.process_audio(audio_file)
    return _summarize_results_to_dict(results)


# ------------------------------ S3 wrappers ------------------------------

class SpeechProcessor:
    _instance = None  # optional simple cache

    def __init__(self, **options):
        self.options = options
        self.recognizer = EnsembleEmotionRecognizer(
            num_runs=options.get("num_runs", 3)
        )

    def process_file(self, path: str):
        return analyze_audio_ensemble(path, num_runs=self.recognizer.num_runs)

    def process_s3(self, bucket: str, key: str, s3_client=None):
        """
        Download a single S3 object to a temp file (preserving suffix),
        analyze, and return (analysis_dict, download_ms).
        """
        s3 = s3_client or boto3.client("s3")
        suffix = (os.path.splitext(key)[1] or ".wav").lower()
        t0 = time.time()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            s3.download_fileobj(bucket, key, tmp)
            tmp_path = tmp.name
        download_ms = int((time.time() - t0) * 1000)

        try:
            analysis = analyze_audio_ensemble(tmp_path, num_runs=self.recognizer.num_runs)
            if analysis is None:
                analysis = {"phases": [], "distribution": {}, "total_duration": 0.0, "avg_confidence": 0.0}
            return analysis, download_ms
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    def process_s3_frames(self, bucket: str, prefix: str, s3_client=None):
        """
        List all audio objects under s3://bucket/prefix, download each to a temp file,
        decode with librosa (FFmpeg-backed; supports .webm), resample to 16k mono,
        concatenate, and analyze once.
        Returns (analysis_dict, download_ms, file_count, total_bytes)
        """
        s3 = s3_client or boto3.client("s3")
        paginator = s3.get_paginator("list_objects_v2")
        allowed_exts = {".wav", ".mp3", ".flac", ".m4a", ".webm"}

        keys, total_bytes = [], 0
        t0 = time.time()
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []) or []:
                key = obj["Key"]
                if key.endswith("/"):
                    continue
                if not any(key.lower().endswith(ext) for ext in allowed_exts):
                    continue
                keys.append(key)
                total_bytes += int(obj.get("Size", 0))

        if not keys:
            # empty prefix; return an empty analysis:
            return {"phases": [], "distribution": {}, "total_duration": 0.0, "avg_confidence": 0.0}, 0, 0, 0

        keys.sort()

        # Download & decode each; use librosa.load for .webm (requires ffmpeg)
        waveforms = []
        for k in keys:
            suffix = (os.path.splitext(k)[1] or ".wav").lower()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmpf:
                s3.download_fileobj(bucket, k, tmpf)
                tmp_path = tmpf.name
            try:
                y, sr = librosa.load(tmp_path, sr=16000, mono=True)
                waveforms.append(y.astype(np.float32, copy=False))
            finally:
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

        combined = np.concatenate(waveforms) if len(waveforms) > 1 else waveforms[0]
        download_ms = int((time.time() - t0) * 1000)

        analysis = analyze_audio_array(combined, rate=16000, num_runs=self.recognizer.num_runs)
        if analysis is None:
            analysis = {"phases": [], "distribution": {}, "total_duration": 0.0, "avg_confidence": 0.0}

        return analysis, download_ms, len(keys), total_bytes


# ------------------------------- Local test -------------------------------

if __name__ == "__main__":
    # Only runs if you `python speech.py` directly; importing from FastAPI won't hit this.
    test_path = os.environ.get("LOCAL_TEST_AUDIO", "")
    if not test_path:
        print("Set LOCAL_TEST_AUDIO=/path/to/file.(wav|mp3|m4a|flac|webm) and run again.")
    else:
        out = analyze_audio_ensemble(test_path, num_runs=5)
        print(out)
