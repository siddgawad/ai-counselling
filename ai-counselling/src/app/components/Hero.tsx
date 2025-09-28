// src/app/components/Hero.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import VoiceCircle from './VoiceCircle';
import ChatPane from './chat/ChatPane';
import ModeToggle from './ModeToggle';

type ModeChoice = 'text' | 'voice' | 'video';

function coerceMode(raw: unknown): ModeChoice {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'text' || s === 'voice' || s === 'video') return s;
  if (s === 'multimodal') return 'voice'; // legacy alias
  return 'voice';
}

export default function Hero() {
  const { user, isLoaded } = useUser();

  // Prefer nested preferences.mode, then preferredMode, then legacy mode
  const preferredMode: ModeChoice = !isLoaded
    ? 'voice'
    : coerceMode(
        // @ts-expect-error publicMetadata is an untyped bag
        user?.publicMetadata?.preferences?.mode ??
        user?.publicMetadata?.preferredMode ??
        user?.publicMetadata?.mode
      );

  return (
    <section className="glass h-screen flex flex-col items-center justify-center px-6 md:px-10">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center space-y-8">
        
        {/* Mode toggle at top */}
        <div className="text-center">
          <ModeToggle value={preferredMode} disabled={!isLoaded} />
          <p className="mt-2 text-xs text-zinc-500">Switch between text, voice, or video anytime.</p>
        </div>

        {/* Main content area - centered */}
        <div className="flex-1 w-full flex items-center justify-center">
          {!isLoaded ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : preferredMode === 'text' ? (
            <div className="w-full max-w-[600px] h-[70vh]">
              <ChatPane />
            </div>
          ) : preferredMode === 'voice' ? (
            <div className="flex justify-center">
              <VoiceCircle backendUrl="/api/audio" />
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white/60 p-8 text-center max-w-md">
              <p className="text-sm text-zinc-600">
                Video mode coming soon. You can switch to voice or text above.
              </p>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}