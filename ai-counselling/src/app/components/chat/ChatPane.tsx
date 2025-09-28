// src/app/components/chat/ChatPane.tsx
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { JSX } from 'react';


/* ---------- Strong types ---------- */

type Sender = 'user' | 'assistant';

type Message = {
  id: string;
  sender: Sender;
  text: string;
  ts: number; // epoch ms
};

type ChatPaneProps = {
  /** If you already have a backend, pass a handler that returns the assistant reply. */
  onSend?: (userText: string) => Promise<string>;
  /** Optional initial messages (e.g., greeting) */
  initialMessages?: ReadonlyArray<Message>;
};

/* ---------- Helpers ---------- */

function linkifyText(s: string): string {
  const urlRegex =
    /((?:https?:\/\/)?(?:[\w-]+\.)+[a-zA-Z]{2,}(?:\/[\w.,@?^=%&:/~+#-]*)?)/g;
  return s.replace(urlRegex, (m) => {
    const hasProtocol = m.startsWith('http://') || m.startsWith('https://');
    const href = hasProtocol ? m : `https://${m}`;
    return `[${m}](${href})`;
  });
}

// Typed markdown renderers (no `any`, no unused `node`)
const mdComponents: Components = {
  a: (p: React.ComponentPropsWithoutRef<'a'>) => (
    <a
      {...p}
      className="underline hover:text-emerald-600"
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  p: (p: React.ComponentPropsWithoutRef<'p'>) => (
    <p {...p} className="m-0 mb-1 leading-relaxed" />
  ),
  ul: (p: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul {...p} className="mb-1 list-disc pl-5" />
  ),
  ol: (p: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol {...p} className="mb-1 list-decimal pl-5" />
  ),
  code: ({
    inline,
    children,
    ...props
  }: (React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) & {
    children?: ReactNode;
  }) =>
    inline ? (
      <code
        {...props}
        className="rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-800"
      >
        {children}
      </code>
    ) : (
      <code {...props}>{children}</code>
    ),
  pre: (p: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre
      {...p}
      className="mb-2 max-w-full overflow-x-auto rounded bg-zinc-100 p-3 text-sm text-zinc-800"
    />
  ),
};

/* ---------- UI ---------- */

export default function ChatPane({
  onSend,
  initialMessages = [],
}: ChatPaneProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>(() => [...initialMessages]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // simple id generator
  const nextId = useMemo(() => {
    let n = 0;
    return () => `m_${Date.now()}_${n++}`;
  }, []);

  // autoscroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (): Promise<void> => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: nextId(), sender: 'user', text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (!onSend) {
      // Demo echo
      setLoading(true);
      setTimeout(() => {
        const reply: Message = {
          id: nextId(),
          sender: 'assistant',
          text: "I'm here and listening. (Wire your backend via the `onSend` prop!)",
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, reply]);
        setLoading(false);
      }, 600);
      return;
    }

    try {
      setLoading(true);
      const replyText = await onSend(text);
      const reply: Message = {
        id: nextId(),
        sender: 'assistant',
        text: replyText,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      const err: Message = {
        id: nextId(),
        sender: 'assistant',
        text: 'Sorry, something went wrong. Please try again.',
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, err]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-[450px] w-full max-w-[700x] flex-col rounded-xl border border-zinc-200 bg-white/70 p-3 shadow-sm backdrop-blur">
      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto pr-1"
        aria-label="Chat messages"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Generating…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="type your message..."
          className="w-full resize-none border-0 p-0 outline-none focus:ring-0"
          rows={2}
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            <svg
              className="size-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Message bubble (inline, type-safe) ---------- */

function MessageBubble({ message }: { message: Message }): JSX.Element {
  const isUser = message.sender === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100">
          <div className="h-8 w-8 rounded-full bg-emerald-500" />
        </span>
      )}

      <div
        className={`max-w-[75%] rounded-lg px-2 py-1 text-[15px] leading-relaxed ${
          isUser
            ? 'rounded-ee-none bg-emerald-600 text-white'
            : 'rounded-es-none bg-zinc-100 text-zinc-900'
        }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={mdComponents}
        >
          {linkifyText(message.text)}
        </ReactMarkdown>
      </div>

      {isUser && (
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200" />
      )}
    </div>
  );
}
