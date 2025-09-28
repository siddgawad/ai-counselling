// src/app/components/chat/ChatComposer.tsx
'use client';

import { useCallback, useRef, useState, FormEvent, KeyboardEvent } from 'react';

type ChatComposerProps = {
  placeholder?: string;
  onSend: (message: string) => void | Promise<void>;
  onClose?: () => void;
};

export default function ChatComposer({
  placeholder = 'type your message...',
  onSend,
  onClose,
}: ChatComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      await onSend(trimmed);
      setValue('');
      textareaRef.current?.focus();
    },
    [onSend, value],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          onSend(trimmed);
          setValue('');
          textareaRef.current?.focus();
        }
      }
    },
    [value, onSend],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-lg border border-zinc-300 bg-white focus-within:border-emerald-500/50 p-3 transition-colors"
    >
      <textarea
        ref={textareaRef}
        className="w-full resize-none border-0 bg-transparent p-0 text-base placeholder:text-zinc-500 focus:outline-none focus:ring-0"
        autoComplete="off"
        name="message"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Type your message"
        rows={2}
      />

      <div className="flex items-center justify-between mt-3">
        {/* Left controls (Close) */}
        <div className="flex gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center whitespace-nowrap text-base font-semibold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 transition-all bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 focus-visible:bg-zinc-200 p-2 rounded-full w-9 h-9"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none"
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="size-4" 
                aria-hidden="true"
              >
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
            </button>
          )}
        </div>

        {/* Send */}
        <div>
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send message"
            className="inline-flex items-center justify-center whitespace-nowrap text-base font-semibold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 transition-all bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:bg-emerald-700 disabled:bg-emerald-300 p-2 rounded-full w-9 h-9"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none"
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="size-4" 
              aria-hidden="true"
            >
              <path d="m5 12 7-7 7 7"></path>
              <path d="M12 19V5"></path>
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}