// src/app/components/chat/ChatComposer.tsx
'use client';

import { useCallback, useRef, useState, FormEvent } from 'react';

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

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-lg border border-border bg-background focus-within:border-primary/50 p-2 transition-colors"
    >
      <textarea
        ref={textareaRef}
        className="border-input ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full flex items-center h-16 text-base min-h-10 max-h-10 resize-none rounded-none bg-background border-0 shadow-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        autoComplete="off"
        name="message"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Type your message"
      />

      <div className="flex items-center pt-0 justify-between mt-2">
        {/* Left controls (Close) */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center whitespace-nowrap text-base font-semibold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 transition-all bg-accent-grey-default hover:bg-accent-grey-hover active:bg-accent-grey-active focus-visible:bg-accent-grey-active disabled:bg-accent-grey-default/50 disabled:text-foreground/50 p-2 rounded-full w-9 h-9"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="lucide lucide-x size-4" aria-hidden="true"
            >
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>

        {/* Send */}
        <div>
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send message"
            className="inline-flex items-center justify-center whitespace-nowrap text-base font-semibold focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 transition-all bg-accent-default text-accent-foreground hover:bg-accent-hover active:bg-accent-active focus-visible:bg-accent-active disabled:bg-accent-disabled p-2 rounded-full ml-auto gap-1.5 w-9 h-9"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="lucide lucide-arrow-up size-4" aria-hidden="true"
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
