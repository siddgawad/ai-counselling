// src/app/components/chat/MessageBubble.tsx
'use client';

type MessageBubbleProps = {
  text: string;
  avatarBgClass?: string; // e.g. "bg-accent-default"
  align?: 'left' | 'right';
};

export default function MessageBubble({
  text,
  avatarBgClass = 'bg-accent-default',
  align = 'left',
}: MessageBubbleProps) {
  const isLeft = align === 'left';

  return (
    <div
      className={`flex gap-2 ${isLeft ? 'justify-start' : 'justify-end'}`}
      role="group"
      aria-label="chat message"
    >
      {/* Avatar */}
      <span className="relative flex overflow-hidden rounded-full h-8 w-8 shrink-0 self-end">
        <span className="flex h-full w-full items-center justify-center rounded-full bg-surface-2">
          <div className={`w-8 h-8 rounded-full ${avatarBgClass}`} />
        </span>
      </span>

      {/* Bubble */}
      <div
        className={`rounded-lg px-2 py-1 font-normal max-w-[75%] md:max-w-[85%] lowercase bg-surface-2 text-foreground ${
          isLeft ? 'rounded-es-none' : 'rounded-ee-none'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
