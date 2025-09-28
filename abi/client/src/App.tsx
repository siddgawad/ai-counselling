import { useEffect, useRef, useState } from "react";

type BotOut = {
  reply: string;
  action: string;
  tone: string;
  mirroring: string;
  session_id: string;
};
type Msg = { role: "user" | "assistant"; content: string };

const API = "http://127.0.0.1:8000/respond";

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi, I'm here. Share a sentence about how you feel. I'll think, then respond." },
  ]);
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setErr(null);
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setThinking(true);

    try {
      await new Promise((r) => setTimeout(r, 280)); // let the typing bubble show
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const out: BotOut = json.response;

      setSessionId(out.session_id);
      const pretty = `${out.reply}\n\n— Try this: ${out.action}`;
      setMsgs((m) => [...m, { role: "assistant", content: pretty }]);
    } catch (e: any) {
      setErr(e.message ?? "Failed to reach server");
      setMsgs((m) => [...m, { role: "assistant", content: "Hmm, I lost connection for a moment—try again?" }]);
    } finally {
      setThinking(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) send();
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Calm<span style={styles.grad}>Chat</span></h1>
        <p style={styles.sub}>A gentle space to reflect. I'll think for a moment, then respond.</p>
      </header>

      <main style={styles.mainCard}>
        <div ref={boxRef} style={styles.chatScroll}>
          {msgs.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
          {thinking && <TypingBubble />}
        </div>

        <div style={styles.composer}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type what's on your mind… (Enter to send)"
            style={styles.input}
          />
          <button onClick={send} disabled={!input.trim() || thinking} style={styles.button}>
            {thinking ? "Thinking…" : "Send"}
          </button>
        </div>

        {err && <p style={{ color: "#fca5a5", marginTop: 8, fontSize: 13 }}>Error: {err}</p>}
        <p style={styles.footerNote}>Not a diagnostic tool. If you're in immediate danger, contact local emergency services.</p>
      </main>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "78%",
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
          padding: "10px 14px",
          borderRadius: 16,
          margin: "8px 0",
          color: isUser ? "#0b1220" : "#0f172a",
          background: isUser ? "linear-gradient(90deg,#67e8f9,#a78bfa)" : "rgba(255,255,255,0.85)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          border: isUser ? "none" : "1px solid rgba(15,23,42,0.06)"
        }}
      >
        {content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{
        padding: "10px 14px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.7)",
        color: "#0f172a",
        border: "1px solid rgba(15,23,42,0.06)"
      }}>
        <span>Thinking</span>
        <span style={{ display: "inline-flex", gap: 6, marginLeft: 8, letterSpacing: 2, animation: "blink 1.4s infinite" }}>
          • • •
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "linear-gradient(#0f172a,#0b1324)", color: "#e2e8f0" },
  header: { maxWidth: 900, margin: "0 auto", padding: "40px 20px 12px" },
  title: { fontSize: 38, fontWeight: 800, margin: 0 },
  grad: { background: "linear-gradient(90deg,#60a5fa,#22d3ee)", WebkitBackgroundClip: "text", color: "transparent" },
  sub: { marginTop: 6, color: "#94a3b8" },
  mainCard: {
    maxWidth: 900, margin: "0 auto", padding: 20,
    background: "rgba(255,255,255,0.06)", borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    backdropFilter: "blur(6px)", marginBottom: 40
  },
  chatScroll: { maxHeight: "58vh", overflowY: "auto", padding: "10px 8px" },
  composer: { display: "flex", gap: 10, marginTop: 8 },
  input: {
    flex: 1, padding: "12px 14px", borderRadius: 12, outline: "none",
    background: "rgba(255,255,255,0.12)", color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.2)"
  },
  button: {
    padding: "12px 16px", borderRadius: 12, border: "none",
    background: "linear-gradient(90deg,#6366f1,#22d3ee)", color: "#0b1220",
    fontWeight: 700, cursor: "pointer", opacity: 1
  },
  footerNote: { marginTop: 12, fontSize: 12, color: "#9ca3af" }
};
