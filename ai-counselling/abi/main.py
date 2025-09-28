import os, json, time
from uuid import uuid4
from typing import Optional, Dict, List
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

class Message(BaseModel):
    text: str
    session_id: Optional[str] = None

# --- session memory (simple in-memory store) ---
SESSIONS: Dict[str, Dict] = {}

# --- safety flags (very small) ---
CRISIS_TERMS = {"suicide","kill myself","end my life","self harm","overdose","hurt myself"}

def is_high_risk(t: str) -> bool:
    t = (t or "").lower()
    return any(k in t for k in CRISIS_TERMS)

# --- configure Gemini ---
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
GEM_MODEL = genai.GenerativeModel("gemini-1.5-flash")  # use 1.5-pro if you need more reasoning

SYSTEM_RULES = """
You are a supportive, non-clinical mental-wellness assistant.
- DO: validate feelings, reflect concisely, offer ONE practical step (breathing, brief walk, journaling, grounding).
- DO: keep replies 80–120 words unless asked.
- DO: ask a small follow-up that moves the conversation forward.
- DO: adapt across turns using the conversation summary provided.
- DO NOT: diagnose, mention DSM criteria, or quote/reproduce any copyrighted manual.
- DO NOT: claim to treat conditions; encourage speaking with a licensed clinician for evaluation.
If there are indications of imminent harm, advise contacting local emergency services or a crisis line immediately.
Return JSON only with keys: reply (string), action (<=120 chars), follow_up (a single question), tone ("negative"|"neutral"|"positive").
"""

PROMPT_TEMPLATE = """
Conversation summary so far (short):
{summary}

User just said:
"{user_text}"

Helpful general notes you may use (non-copyrighted):
- Common distress signs (high-level): low energy, anxious thoughts, sleep/appetite changes, trouble focusing, avoidance.
- Helpful skills: paced breathing (in 4 / hold 4 / out 6, ×3), 60-sec brain dump, 2-minute stretch/water, pick one <10-min task.
- Encourage seeking professional care for diagnosis or treatment questions.

Remember: Do NOT diagnose. Do NOT quote DSM or describe diagnostic criteria.
Output JSON with keys: reply, action, follow_up, tone. No extra commentary.
"""

def summarize(history: List[Dict]) -> str:
    """Tiny extractive summary for context to the model."""
    # keep last 6 turns compact
    last = history[-6:]
    lines = []
    for h in last:
        if "user" in h:
            lines.append(f'U: {h["user"][:220]}')
        if "assistant" in h:
            lines.append(f'A: {h["assistant"][:220]}')
    return " | ".join(lines) or "New conversation."

@app.post("/respond")
def respond(msg: Message):
    text = (msg.text or "").strip()

    # set up / restore session
    sid = msg.session_id or str(uuid4())
    state = SESSIONS.get(sid, {"history": []})

    # crisis screen
    if is_high_risk(text):
        reply = ("I’m really glad you reached out. Your safety matters. "
                 "If you’re in immediate danger, call your local emergency number now. "
                 "You can also contact a local crisis line or reach out to someone you trust.")
        out = {"reply": reply, "action": "Contact local emergency services or a crisis line now.", "follow_up": "Would you like resources in your area?", "tone": "negative"}
        state["history"].append({"user": text, "assistant": out["reply"]})
        SESSIONS[sid] = state
        return {"response": {**out, "mirroring": text[:240], "session_id": sid}}

    # build prompt
    conv_summary = summarize(state["history"])
    prompt = PROMPT_TEMPLATE.format(summary=conv_summary, user_text=text)

    # call Gemini
    result = GEM_MODEL.generate_content([SYSTEM_RULES, prompt])
    raw = (result.text or "").strip()

    # parse JSON safely
    try:
        data = json.loads(raw)
        reply = data.get("reply") or "I’m here and listening."
        action = data.get("action") or "Take 3 slow breaths: in 4, hold 4, out 6."
        follow_up = data.get("follow_up") or "What feels like a helpful next small step?"
        tone = data.get("tone") or "neutral"
    except Exception:
        # if the model didn’t return valid JSON, fall back gracefully
        reply = raw[:600]
        action = "Take 3 slow breaths: in 4, hold 4, out 6."
        follow_up = "What would 1% better look like in the next 10 minutes?"
        tone = "neutral"

    # update memory
    state["history"].append({"user": text, "assistant": reply})
    SESSIONS[sid] = state

    return {"response": {
        "reply": reply,
        "action": action,
        "follow_up": follow_up,
        "tone": tone,
        "mirroring": text[:240],
        "session_id": sid
    }}

@app.get("/health")
def health():
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

