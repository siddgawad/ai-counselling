// src/app/actions/preferences.ts
'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export type ModeChoice = 'text' | 'voice' | 'video';

function isMode(x: unknown): x is ModeChoice {
  return x === 'text' || x === 'voice' || x === 'video';
}

/**
 * Form-action: expects a field named "mode" with value 'text' | 'voice' | 'video'.
 */
export async function setPreferredModeAction(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const raw = formData.get('mode');
  if (!isMode(raw)) throw new Error('Invalid mode');

  const c = await clerkClient();
  const current = await c.users.getUser(userId);
  const prev = (current.publicMetadata ?? {}) as Record<string, unknown>;

  // Store under preferences.mode (and keep a flat alias for backwards-compat)
  await c.users.updateUser(userId, {
    publicMetadata: {
      ...prev,
      preferredMode: raw,
      preferences: {
        ...(typeof prev.preferences === 'object' && prev.preferences !== null
          ? (prev.preferences as Record<string, unknown>)
          : {}),
        mode: raw,
      },
    },
  });

  // Re-render pages/components that read mode from Clerk
  revalidatePath('/');
}
