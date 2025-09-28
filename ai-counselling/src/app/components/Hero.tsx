// src/app/components/Hero.tsx
'use client';

import { useMemo } from 'react';
import ChatPane from './chat/ChatPane';
import ModeToggle from './ModeToggle';
import { useUser } from '@clerk/nextjs';
import VoiceCircle from './VoiceCircle'; // <-- use your VoiceCircle

const FASTAPI_BASE_URL = process.env.NEXT_PUBLIC_FASTAPI_BASE_URL || 'http://localhost:8000';

type ModeChoice = 'text' | 'voice' | 'video';

type PublicMetadataShape = {
  preferredMode?: string;
  mode?: string;
  preferences?: { mode?: string };
};

function coerceMode(s: string | undefined | null): ModeChoice {
  const v = String(s ?? '').toLowerCase();
  if (v === 'text' || v === 'voice' || v === 'video') return v;
  if (v === 'multimodal') return 'voice';
  return 'voice';
}

export default function Hero() {
  const { user, isLoaded } = useUser();

  const mode: ModeChoice = useMemo(() => {
    if (!isLoaded) return 'voice';
    const pm = (user?.publicMetadata ?? {}) as PublicMetadataShape;
    const picked = pm.preferences?.mode ?? pm.preferredMode ?? pm.mode ?? '';
    return coerceMode(picked);
  }, [isLoaded, user?.publicMetadata]);

  async function processSpeech() {
    if (!user?.id) return;
    try {
      const url = `${FASTAPI_BASE_URL}/process_speech?userid=${encodeURIComponent(user.id)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        console.error('Process failed:', json);
        return;
      }
      console.log('process_speech response:', json);
      // you can toast this JSON or render the answer in UI
    } catch (e) {
      console.error('Process request failed', e);
    }
  }

  return (
    <section className="sticky top-0 z-10 glass mx-6 md:mx-8 2xl:mx-30 my-6 px-6 md:px-10 py-8 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-8 items-start">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900">
            AI Counsellor made for <span className="text-green-800">you</span>.
          </h1>
          <p className="mt-5 text-slate-700 leading-relaxed">
            Personalised plans for pregnancy, PCOS, and sustainable weight
            management—guided by evidence, designed for real life.
          </p>

          <div className="mt-6">
            <ModeToggle value={mode} disabled={!isLoaded} />
          </div>
        </div>

        <div className="flex justify-center">
          {mode === 'text' ? (
            <div className="w-full max-w-md">
              <ChatPane />
            </div>
          ) : mode === 'voice' ? (
            <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white/60 p-6 flex flex-col items-center gap-4">
              {isLoaded && user?.id ? (
                <>
                  <VoiceCircle userId={user.id} uploadUrl="/api/uploadAudio" />
                  <button
                    onClick={processSpeech}
                    className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                  >
                    Process Speech
                  </button>
                </>
              ) : (
                <p className="text-sm text-zinc-600">Sign in to record & process audio.</p>
              )}
            </div>
          ) : (
            <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white/60 p-6 text-center">
              <p className="text-sm text-zinc-600">
                Video mode coming soon. You can switch to voice or text in settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
