// src/app/onboarding/page.tsx
import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { saveOnboarding, upsertUserFromClerk, type OnboardingPayload } from '@/db/users';

const scale = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const ageRange = z.enum(['<18', '18-24', '25-35', '40-50', '>50']);
const mode = z.enum(['text', 'voice', 'video']);
const yesNoPns = z.enum(['yes', 'no', 'prefer_not_to_say']);

const PayloadSchema = z.object({
  fullName: z.string().min(1).max(120),
  ageRange: ageRange,

  immediateDanger: yesNoPns,
  selfHarmThoughts: scale,

  mode: mode,

  concernsText: z.string().optional(),
  concerns: z.array(z.string()).default([]),
  goalsText: z.string().optional(),

  crossCutting: z.object({
    pleasure: scale, lowMood: scale, irritability: scale, activation: scale,
    anxiety: scale, avoidance: scale, somatic: scale, psychosisLike: scale,
    sleepProblems: scale, cognition: scale, ocdLike: scale, dissociation: scale,
    substance: scale,
  }),

  functioning: z.object({
    understanding: scale, mobility: scale, selfCare: scale, gettingAlong: scale,
    lifeActivities: scale, participation: scale,
  }),

  identityContext: z.string().optional(),
  meaningMaking: z.string().optional(),
  stressesSupports: z.string().optional(),

  medicalDx: z.string().optional(),
  meds: z.string().optional(),
  sleep: z.string().optional(),
  substances: z.object({
    caffeine: z.string().optional(),
    alcohol: z.string().optional(),
    nicotine: z.string().optional(),
    cannabis: z.string().optional(),
  }).optional(),
  movement: z.string().optional(),

  strengths: z.string().optional(),
  preferences: z.array(z.enum(['guided', 'mindfulness', 'journaling', 'short_checkins'])).default([]),
  nudges: z.enum(['daily', '2-3x/week', 'weekly']),
});

export default async function OnboardingPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/sign-in/' });

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);

  if (clerkUser.publicMetadata?.onboarded) redirect('/');

  await upsertUserFromClerk({
    clerk_user_id: userId,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
    first_name: clerkUser.firstName ?? null,
    last_name: clerkUser.lastName ?? null,
    image_url: clerkUser.imageUrl ?? null,
  });

  // ----- server action -----
  async function submit(formData: FormData) {
    'use server';
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const json = formData.get('payload')?.toString() ?? '';
    const parsed = PayloadSchema.parse(JSON.parse(json)) as OnboardingPayload;

    await saveOnboarding({ clerk_user_id: userId, data: parsed });

    // flag in Clerk
    const c = await clerkClient();
    const u = await c.users.getUser(userId);
    await c.users.updateUser(userId, { publicMetadata: { ...(u.publicMetadata ?? {}), onboarded: true } });

    redirect('/');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <OnboardingWizard
        defaultName={clerkUser.fullName ?? ''}
        action={submit}
      />
    </div>
  );
}

// Mark the client wizard import
import OnboardingWizard from './wizard';
