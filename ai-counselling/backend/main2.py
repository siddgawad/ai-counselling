from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
from deepface import DeepFace
from collections import Counter
import tempfile
import os
import uvicorn
import PyPDF2
from sentence_transformers import SentenceTransformer
import faiss
import google.generativeai as genai
import numpy as np
import speech_recognition as sr
from pydub import AudioSegment, effects
from pydub.effects import high_pass_filter, low_pass_filter, compress_dynamic_range
from process_audio_tone import SpeechProcessor
from dotenv import load_dotenv
from speech_to_text import transcribe_latest_concat
from pymongo import MongoClient
from mongodb_fetcher import fetch_all_from_mongo

app = FastAPI(title="Mental Wellness & Emotion Detection API")
speech_processor = SpeechProcessor()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change "*" to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))

model = genai.GenerativeModel('gemini-2.5-flash')
load_dotenv()
default_bucket = os.getenv("DEFAULT_BUCKET", "mhacksforsid")

class EmotionDetector:
    @staticmethod
    def detect_emotion(frame):
        try:
            result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
            return result[0]['dominant_emotion']
        except:
            return "No face"

detector = EmotionDetector()

CRISIS_TERMS = {"suicide", "kill myself", "end my life", "self harm", "overdose", "hurt myself"}

def is_high_risk(text: str) -> bool:
    text = (text or "").lower()
    return any(term in text for term in CRISIS_TERMS)


PDF_PATH = "DSM5.pdf"
CHUNK_SIZE = 300
TOP_K = 5
CHUNK_SEC = 30 
LANG = "en-US" 

# Load and chunk text
text = ""
with open(PDF_PATH, "rb") as f:
    reader = PyPDF2.PdfReader(f)
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

words = text.split()
chunked_docs = [" ".join(words[i:i+CHUNK_SIZE]) for i in range(0, len(words), CHUNK_SIZE)]


embed_model = SentenceTransformer("all-mpnet-base-v2")

doc_embeddings = np.load("document_embeddings.npy")
faiss.normalize_L2(doc_embeddings)
print("Embeddings shape:", doc_embeddings.shape)
print("Total chunks:", len(chunked_docs))

d = doc_embeddings.shape[1]
index = faiss.IndexFlatIP(d)
index.add(doc_embeddings)

def retrieve_chunks(query, top_k=TOP_K):
    q_emb = embed_model.encode([query], convert_to_numpy=True)
    faiss.normalize_L2(q_emb)
    D, I = index.search(q_emb, top_k)
    return [chunked_docs[i] for i in I[0] if i < len(chunked_docs)]

print("Setup complete.")

def preprocess(path: str):
    audio = AudioSegment.from_file(path)
   
    audio = audio.set_channels(1).set_frame_rate(16000)
   
    audio = high_pass_filter(audio, cutoff=100)     
    audio = low_pass_filter(audio, cutoff=8000)     
   
    audio = effects.normalize(audio)
    audio = compress_dynamic_range(audio, threshold=-20.0, ratio=4.0, attack=5, release=50)
    return audio

def split_chunks(audio: AudioSegment, chunk_sec=CHUNK_SEC):
    step = int(chunk_sec * 1000)
    return [audio[i:i+step] for i in range(0, len(audio), step)]

def speech_to_text(path: str):
    r = sr.Recognizer()
    audio = preprocess(path)
    chunks = split_chunks(audio)

    texts = []
    with tempfile.TemporaryDirectory() as td:
        for i, ch in enumerate(chunks, 1):
            wav_path = os.path.join(td, f"part_{i}.wav")
            ch.export(wav_path, format="wav")
            with sr.AudioFile(wav_path) as source:
              
                r.adjust_for_ambient_noise(source, duration=0.3)
                audio_chunk = r.record(source)

            try:
                
                result = r.recognize_google(audio_chunk, language=LANG, show_all=True)
                if isinstance(result, dict) and "alternative" in result and result["alternative"]:
                    best = max(result["alternative"], key=lambda a: a.get("confidence", 0))
                    texts.append(best.get("transcript", "").strip())
                else:
                  
                    txt = r.recognize_google(audio_chunk, language=LANG)
                    texts.append(txt.strip())
                print(f"[{i}/{len(chunks)}] ✓")
            except sr.UnknownValueError:
                print(f"[{i}/{len(chunks)}] (no speech recognized)")
            except sr.RequestError as e:
                raise SystemExit(f"[{i}/{len(chunks)}] API error: {e}")
    return " ".join(t for t in texts if t).strip()



@app.post("/respond")
def respond(msg: str, user_id):
    if is_high_risk(msg):
        reply = ("I'm really glad you reached out. Your safety matters. "
                 "If you’re in immediate danger, call your local emergency number now. "
                 "You can also contact a local crisis line or reach out to someone you trust.")
        return {"response": {"reply": reply}}

    # Retrieve relevant chunks
    relevant_chunks = retrieve_chunks(msg)
    context_text = "\n".join(relevant_chunks) if relevant_chunks else "No relevant content found in the document."
    try:
        questionnaire = fetch_all_from_mongo("users", {"user_id": user_id})
    except Exception as e:
        questionnaire = ""
    # Build prompt for Gemini
    prompt = f"""
    Using the following DSM-5 context, answer the user's question:

    {context_text}

    User question: "{msg}"
    User's previous questionnaire data: "{questionnaire}"
    Respond in a concise, empathetic, and supportive way. Focus on genuinely understanding the person's feelings and providing comforting, actionable guidance. Do NOT provide medical advice or suggest contacting health professionals.

    """
    response = model.generate_content(prompt)
    answer = (response.text or "").strip()

    return {"final_response": answer}


@app.post("/detect_video_emotions")
async def detect_video_emotions(user_id, file: UploadFile = File(...)):
    try:
        # Save uploaded file temporarily
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return JSONResponse({"error": "Cannot open video file"}, status_code=400)

        emotions = []
        frame_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            emotion = detector.detect_emotion(frame)
            emotions.append(emotion)
            frame_count += 1

        cap.release()
        os.remove(tmp_path)

      
        final_emotion = Counter(emotions).most_common(1)[0][0] if emotions else "No face detected"

          # Use userid as the prefix in S3
        analysis, download_ms, file_count, total_bytes = speech_processor.process_s3_frames(
            bucket=default_bucket,
            prefix=f"{user_id}/"  # assumes files are under bucket/<userid>/...
        )

        try:
            transcript = transcribe_latest_concat(default_bucket, k=3, pool=30)
            print("Transcript:", transcript)
            relevant_chunks = retrieve_chunks(transcript)
            context_text = "\n".join(relevant_chunks) if relevant_chunks else "No relevant content found in the document."
        except Exception as e:
            transcript = ""
            context_text = "No relevant content found in the document."
           
      
        try:
            questionnaire = fetch_all_from_mongo("users", {"user_id": user_id})
        except Exception as e:
            questionnaire = ""

        prompt = f"""
        Using the following DSM-5 context, answer the user's question:

        {context_text}

        User question: "{transcript}"
        User tone analysis: "{analysis}"
        User final detected emotion: "{final_emotion}"
        User's previous questionnaire data: "{questionnaire}"
        Respond in a concise, empathetic, and supportive way. Focus on genuinely understanding the person's feelings and providing comforting, actionable guidance. Understand the user's tone and emotion while responding. Do NOT provide medical advice or suggest contacting health professionals.

        """
        response = model.generate_content(prompt)
        answer = (response.text or "").strip()
        return JSONResponse({
            "emotions_per_frame": emotions,
            "total_frames": frame_count,
            "final_emotion": final_emotion,
            "final_response": answer,
        })

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)

@app.get("/process_speech")
def process_speech(userid):
    """
    Process all audio frames in S3 under a prefix matching the user ID.
    """
    try:
        # Use userid as the prefix in S3
        analysis, download_ms, file_count, total_bytes = speech_processor.process_s3_frames(
            bucket=default_bucket,
            prefix=f"{userid}/"  # assumes files are under bucket/<userid>/...
        )
        try:
            transcript = transcribe_latest_concat(default_bucket, k=3, pool=30)
            print("Transcript:", transcript)
            relevant_chunks = retrieve_chunks(transcript)
            context_text = "\n".join(relevant_chunks) if relevant_chunks else "No relevant content found in the document."
            print("Context for Gemini:", context_text)
            try:
                questionnaire = fetch_all_from_mongo("users", {"user_id": userid})
            except Exception as e:
                questionnaire = ""
        except Exception as e:
            transcript = ""
            context_text = "No relevant content found in the document."
            questionnaire = ""


        prompt = f"""
        Using the following DSM-5 context, answer the user's question:

        {context_text}

        User question: "{transcript}"
        User tone analysis: "{analysis}"
        User's previous questionnaire data: "{questionnaire}"
        Respond in a concise, empathetic, and supportive way. Focus on genuinely understanding the person's feelings and providing comforting, actionable guidance. Understand the user's tone while responding. Do NOT provide medical advice or suggest contacting health professionals.

        """
        response = model.generate_content(prompt)
        answer = (response.text or "").strip()




        return {
            "user_id": userid,
            "analysis": analysis,
            "download_ms": download_ms,
            "file_count": file_count,
            "total_bytes": total_bytes,
            "final_response": answer,
        }

    except Exception as e:
        return JSONResponse(
            {"error": "No speech recognized or processing failed", "details": str(e)},
            status_code=400
        )
    



if __name__ == "__main__":
    uvicorn.run("main2:app", host="0.0.0.0", port=8000, reload=True)
