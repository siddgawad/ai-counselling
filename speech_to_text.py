# sr_transcribe_better.py
import os, math, tempfile
from pathlib import Path
from pydub import AudioSegment, effects
from pydub.effects import high_pass_filter, low_pass_filter, compress_dynamic_range
import speech_recognition as sr

INPUT_PATH = "/Users/madhusiddharthsuthagar/Downloads/input_4.wav"
CHUNK_SEC  = 50   # keep each chunk < ~60s for the web API
LANG       = "en-US"

def preprocess(path: str) -> AudioSegment:
    # Load via ffmpeg (handles mp3/m4a/mp4/webm/etc.)
    audio = AudioSegment.from_file(path)
    # Convert to mono 16k for ASR stability
    audio = audio.set_channels(1).set_frame_rate(16000)
    # Light filtering to reduce rumble/hiss
    audio = high_pass_filter(audio, cutoff=100)      # kill HVAC/handling noise
    audio = low_pass_filter(audio, cutoff=8000)      # cut harsh highs
    # Normalize loudness and tame spikes
    audio = effects.normalize(audio)
    audio = compress_dynamic_range(audio, threshold=-20.0, ratio=4.0, attack=5, release=50)
    return audio

def split_chunks(audio: AudioSegment, chunk_sec=CHUNK_SEC):
    step = int(chunk_sec * 1000)
    return [audio[i:i+step] for i in range(0, len(audio), step)]

def transcribe_google(path: str) -> str:
    r = sr.Recognizer()
    audio = preprocess(path)
    chunks = split_chunks(audio)

    texts = []
    with tempfile.TemporaryDirectory() as td:
        for i, ch in enumerate(chunks, 1):
            wav_path = os.path.join(td, f"part_{i}.wav")
            ch.export(wav_path, format="wav")
            with sr.AudioFile(wav_path) as source:
                # Let recognizer estimate ambient noise per chunk (helps a bit)
                r.adjust_for_ambient_noise(source, duration=0.3)
                audio_chunk = r.record(source)

            try:
                # show_all=True gives N-best; we pick top hypothesis
                result = r.recognize_google(audio_chunk, language=LANG, show_all=True)
                if isinstance(result, dict) and "alternative" in result and result["alternative"]:
                    best = max(result["alternative"], key=lambda a: a.get("confidence", 0))
                    texts.append(best.get("transcript", "").strip())
                else:
                    # fallback to simple call if no alternatives returned
                    txt = r.recognize_google(audio_chunk, language=LANG)
                    texts.append(txt.strip())
                print(f"[{i}/{len(chunks)}] ✓")
            except sr.UnknownValueError:
                print(f"[{i}/{len(chunks)}] (no speech recognized)")
            except sr.RequestError as e:
                raise SystemExit(f"[{i}/{len(chunks)}] API error: {e}")
    return " ".join(t for t in texts if t).strip()

if __name__ == "__main__":
    print("\n=== TRANSCRIPT ===\n")
    print(transcribe_google(INPUT_PATH))
