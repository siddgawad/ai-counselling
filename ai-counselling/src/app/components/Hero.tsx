// src/app/components/Hero.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import VoiceCircle from './VoiceCircle';
import ChatPane from './chat/ChatPane';

type ModeChoice = 'text' | 'voice' | 'video';

function coerceMode(raw: unknown): ModeChoice {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'text' || s === 'voice' || s === 'video') return s;
  if (s === 'multimodal') return 'voice'; // legacy alias
  return 'voice';
}

export default function Hero() {
  const { user, isLoaded } = useUser();

  // Prefer explicit preferredMode, fall back to any old "mode" key if present
  const preferredMode: ModeChoice = !isLoaded
    ? 'voice'
    : coerceMode(
        user?.publicMetadata?.preferredMode ??
          user?.publicMetadata?.mode // fallback for older users
      );

  return (
    <section className="glass mx-6 md:mx-8 2xl:mx-30 my-36 px-6 md:px-10 py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900">
            AI Counsellor made for <span className="text-green-800">you</span>.
          </h1>
          <p className="mt-5 text-slate-700 leading-relaxed">
            Personalised plans for pregnancy, PCOS, and sustainable weight
            management—guided by evidence, designed for real life.
          </p>
        </div>

        <div className="flex justify-center">
          {!isLoaded ? null : preferredMode === 'text' ? (
            <div className="w-full max-w-md">
              <ChatPane />
            </div>
          ) : preferredMode === 'voice' ? (
            <VoiceCircle backendUrl="/api/audio" />
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white/60 p-6 text-center">
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
