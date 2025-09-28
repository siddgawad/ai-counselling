// src/app/components/chat/ChatPane.tsx
'use client';

import { useState } from 'react';
import MessageBubble from './MessageBubble';
import ChatComposer from './ChatComposer';

export default function ChatPane() {
  const [messages, setMessages] = useState<string[]>([
    "Hey there! What's the vibe today? How are you feeling?",
  ]);

  return (
    <div className="space-y-3">
      {/* Assistant bubble */}
      <MessageBubble text={messages[0]} />

      {/* Composer */}
      <ChatComposer
        onSend={async (text) => {
          // TODO: call your backend here
          setMessages((m) => [...m, text]);
        }}
        onClose={() => {
          // close/hide chat panel
        }}
      />
    </div>
  );
}
