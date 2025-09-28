// src/app/onboarding/page.tsx
import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { saveOnboarding, OnboardingPayload, upsertUserFromClerk } from '@/db/users';

const OnboardingSchema = z.object({
  fullName: z.string().min(1).max(120),
  age: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? Number(v) : undefined))
    .refine((v) => (v === undefined ? true : (Number.isInteger(v) && v >= 13 && v <= 120)), {
      message: 'Age must be between 13 and 120',
    }),
  goals: z
    .array(z.string())
    .optional()
    .transform((g) => (g && g.length ? g : [])),
  mode: z.enum(['text', 'multimodal']).default('multimodal'),
  timezone: z.string().optional(),
});

export default async function OnboardingPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/onboarding' });

  // Fetch Clerk user
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);

  // If already onboarded, skip this page
  const alreadyOnboarded = Boolean(clerkUser.publicMetadata?.onboarded);
  if (alreadyOnboarded) redirect('/session');

  // Ensure a user document exists in Mongo (idempotent upsert)
  await upsertUserFromClerk({
    clerk_user_id: userId,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
    first_name: clerkUser.firstName ?? null,
    last_name: clerkUser.lastName ?? null,
    image_url: clerkUser.imageUrl ?? null,
  });

  // --- Server Action: handles form submit ---
  async function submit(formData: FormData) {
    'use server';
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    // Collect raw values from the form
    const raw = {
      fullName: formData.get('fullName')?.toString() ?? '',
      age: formData.get('age')?.toString(),
      // getAll returns FormDataEntryValue[], cast to strings
      goals: (formData.getAll('goals') as string[]) ?? [],
      mode: (formData.get('mode') as 'text' | 'multimodal') ?? 'multimodal',
      timezone: formData.get('timezone')?.toString(),
    };

    // Validate & coerce using Zod
    const parsed = OnboardingSchema.parse(raw);

    const payload: OnboardingPayload = {
      fullName: parsed.fullName,
      age: parsed.age,
      goals: parsed.goals,
      mode: parsed.mode,
      timezone: parsed.timezone,
    };

    // Persist to Mongo
    await saveOnboarding({ clerk_user_id: userId, data: payload });

    // Merge-safe update to Clerk publicMetadata
    const c = await clerkClient();
    const current = await c.users.getUser(userId);
    await c.users.updateUser(userId, {
      publicMetadata: { ...(current.publicMetadata ?? {}), onboarded: true },
    });

    // Done → go to session
    redirect('/');
  }

  // Render the questionnaire form
  return (
    <form action={submit} className="mx-auto max-w-2xl space-y-6 p-6 bg-white/80 rounded-xl">
      <h1 className="text-2xl font-semibold">Onboarding</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" defaultValue={clerkUser.fullName ?? ''}
               className="w-full rounded border px-3 py-2" required />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="age">Age</label>
        <input id="age" type="number" name="age" min={13} max={120}
               className="w-full rounded border px-3 py-2" />
      </div>

      <div className="space-y-2">
        <p className="block text-sm font-medium">Goals</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {['stress', 'sleep', 'focus', 'mood', 'confidence', 'relationships'].map((g) => (
            <label key={g} className="inline-flex items-center gap-2">
              <input type="checkbox" name="goals" value={g} /> <span className="capitalize">{g}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="block text-sm font-medium">Mode</p>
        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="text" /> Text-only
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="mode" value="multimodal" defaultChecked /> Camera + Mic
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="timezone">Time zone</label>
        <input id="timezone" name="timezone" placeholder="e.g., America/Detroit"
               className="w-full rounded border px-3 py-2" />
      </div>

      <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">
        Continue
      </button>
    </form>
  );
}
