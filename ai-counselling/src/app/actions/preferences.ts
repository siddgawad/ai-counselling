// src/app/actions/preferences.ts
'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';

/* ---------- Types ---------- */

export type ModeChoice = 'text' | 'voice' | 'video';

type PreferencesShape = {
  mode?: string;
};

type PublicMetadataShape = {
  preferredMode?: string;
  mode?: string; // legacy
  preferences?: PreferencesShape;
};

/* ---------- Helpers ---------- */

function isModeChoice(v: string): v is ModeChoice {
  return v === 'text' || v === 'voice' || v === 'video';
}

function coerceMode(v: string): ModeChoice {
  if (isModeChoice(v.toLowerCase())) return v.toLowerCase() as ModeChoice;
  if (v.toLowerCase() === 'multimodal') return 'voice';
  return 'voice';
}

function isPreferencesShape(val: unknown): val is PreferencesShape {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/* ---------- Core API ---------- */

export async function setPreferredMode(mode: ModeChoice): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const c = await clerkClient();
  const u = await c.users.getUser(userId);

  const pm: PublicMetadataShape = (u.publicMetadata ?? {}) as PublicMetadataShape;
  const prevPrefs: PreferencesShape = isPreferencesShape(pm.preferences) ? pm.preferences : {};

  const nextPrefs: PreferencesShape = { ...prevPrefs, mode };

  await c.users.updateUser(userId, {
    publicMetadata: {
      ...pm,
      preferences: nextPrefs,     // nested (new)
      preferredMode: mode,        // flat (legacy)
    },
  });
}

/* ---------- Form Server Action (for <ModeToggle/>) ---------- */

export async function setPreferredModeAction(formData: FormData): Promise<{ ok: true }> {
  const raw = String(formData.get('mode') ?? '');
  const mode = coerceMode(raw);
  await setPreferredMode(mode);
  return { ok: true };
}
