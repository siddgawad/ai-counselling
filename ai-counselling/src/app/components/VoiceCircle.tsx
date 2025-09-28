'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  userId: string;              // <-- add
  uploadUrl?: string;          // <-- add (default to /api/uploadAudio)
  size?: number;
};

type PendingFrame = {
  blob: Blob;
  tsMs: number;
  seq: number;
};

const VoiceCircle: React.FC<Props> = ({
  userId,
  uploadUrl = '/api/uploadAudio',
  size = 200,
}) => {
  const [isListening, setIsListening] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const seqRef = useRef(0);
  const sendingRef = useRef<Promise<void> | null>(null);
  const pendingRef = useRef<PendingFrame | null>(null);

  const start = async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

      mr.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        pendingRef.current = {
          blob: ev.data,
          tsMs: Date.now(),
          seq: seqRef.current++,
        };
        if (!sendingRef.current) {
          sendingRef.current = sendLoop();
        }
      };

      mr.onstart = () => {
        seqRef.current = 0;
      };

      recorderRef.current = mr;
      mr.start(3000);
      setIsListening(true);
    } catch (e) {
      console.error('mic error', e);
      alert('Microphone permission is required to start voice.');
    }
  };

  const stop = () => {
    setIsListening(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const sendLoop = async () => {
    try {
      while (true) {
        const next = pendingRef.current;
        if (!next) break;
        pendingRef.current = null;

        const file = new File([next.blob], `frame_${next.seq}.webm`, { type: next.blob.type || 'audio/webm' });
        const form = new FormData();
        form.append('file', file);                      // <-- renamed to 'file'
        form.append('userId', userId);                 // <-- include userId
        form.append('timestamp', String(next.tsMs));
        form.append('frameId', String(next.seq));

        const res = await fetch(uploadUrl, { method: 'POST', body: form });
        if (!res.ok) {
          console.error('Upload failed', res.status, await res.text().catch(() => ''));
        }
      }
    } finally {
      sendingRef.current = null;
      if (pendingRef.current && !sendingRef.current) {
        sendingRef.current = sendLoop();
      }
    }
  };

  const onClick = () => {
    if (!isListening) start();
    else stop();
  };

  useEffect(() => () => stop(), []);

  // Tailwind-powered circle with green hero palette; minimal-only circle (no X / no text)
  return (
    <button
      onClick={onClick}
      aria-label={isListening ? 'Stop voice' : 'Start voice'}
      className="relative rounded-full focus:outline-none"
      style={{ width: size, height: size }}
    >
      {/* Outer animated rings (green when active, neutral when idle) */}
      {isListening && (
        <>
          <div
            className="absolute inset-0 rounded-full border-2 border-emerald-400/70 opacity-30"
            style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
          />
          <div
            className="absolute inset-0 rounded-full border-2 border-emerald-400/70 opacity-20"
            style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite', animationDelay: '0.5s' }}
          />
          <div
            className="absolute inset-0 rounded-full border border-emerald-400/70 opacity-10"
            style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite', animationDelay: '1s' }}
          />
        </>
      )}

      {/* Middle halo */}
      <div
        className={`absolute inset-4 rounded-full ${
          isListening ? 'bg-emerald-500/10' : 'bg-slate-600/10'
        }`}
        style={{ animation: isListening ? 'wave 3s ease-in-out infinite' : 'none' }}
      >
        <div
          className={`w-full h-full rounded-full border-2 ${
            isListening ? 'border-emerald-400/50' : 'border-slate-500/30'
          } backdrop-blur-sm`}
        />
      </div>

      {/* Core */}
      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl flex items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full transition-all duration-500 ${
            isListening
              ? 'bg-gradient-to-tr from-emerald-500/30 to-teal-400/30'
              : 'bg-gradient-to-tr from-slate-700/30 to-slate-800/30'
          }`}
        />
        {/* Icon (mic when idle/active) */}
        <svg
          className={`relative z-10 w-10 h-10 ${
            isListening ? 'text-emerald-400' : 'text-slate-400'
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
        >
          <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
          <path d="M19 11a7 7 0 01-6 6.93V21h-2v-3.07A7 7 0 015 11h2a5 5 0 0010 0h2z" />
        </svg>
      </div>

      {/* Active glow */}
      {isListening && (
        <div
          className="absolute inset-0 rounded-full bg-emerald-400 blur-2xl opacity-20"
          style={{ animation: 'glow 2s ease-in-out infinite' }}
        />
      )}

      {/* Local keyframes to avoid global CSS pollution */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0; }
          50% { transform: scale(1.5); opacity: 0.3; }
        }
        @keyframes wave {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </button>
  );
};

export default VoiceCircle;
