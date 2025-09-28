// src/app/components/ModeToggle.tsx
'use client';

import { useTransition } from 'react';
import type { ModeChoice } from '@/app/actions/preferences';
import { setPreferredModeAction } from '@/app/actions/preferences';

type Props = {
  value: ModeChoice;   // current mode
  disabled?: boolean;  // disable while Clerk/user loads
};

export default function ModeToggle({ value, disabled = false }: Props) {
  const [pending, startTransition] = useTransition();

  function submitMode(next: ModeChoice) {
    const fd = new FormData();
    fd.append('mode', next);

    // Server action + hard refresh
    startTransition(async () => {
      try {
        await setPreferredModeAction(fd);
      } finally {
        // Force a full document reload so Hero re-reads Clerk metadata
        window.location.reload();
      }
    });
  }

  const isBusy = pending || disabled;

  const btnBase =
    'inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors';
  const selected =
    'border-emerald-600 bg-emerald-600 text-white';
  const unselected =
    'border-zinc-300 bg-white text-zinc-900 hover:bg-emerald-50';

  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={value === 'text'}
        disabled={isBusy}
        onClick={() => submitMode('text')}
        className={`${btnBase} ${value === 'text' ? selected : unselected} disabled:opacity-50`}
      >
        Text
      </button>
      <button
        type="button"
        aria-pressed={value === 'voice'}
        disabled={isBusy}
        onClick={() => submitMode('voice')}
        className={`${btnBase} ${value === 'voice' ? selected : unselected} disabled:opacity-50`}
      >
        Voice
      </button>
      <button
        type="button"
        aria-pressed={value === 'video'}
        disabled={isBusy}
        onClick={() => submitMode('video')}
        className={`${btnBase} ${value === 'video' ? selected : unselected} disabled:opacity-50`}
      >
        Video
      </button>
    </div>
  );
}
