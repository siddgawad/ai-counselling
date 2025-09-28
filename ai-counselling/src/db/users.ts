// src/db/users.ts
import { getCollection } from '@/lib/mongo';

export type AgeRange = '<18' | '18-24' | '25-35' | '40-50' | '>50';
export type Scale0to4 = 0 | 1 | 2 | 3 | 4;
export type ModeChoice = 'text' | 'voice' | 'video';

export type OnboardingPayload = {
  fullName: string;
  ageRange: AgeRange;

  // Safety
  immediateDanger: 'yes' | 'no' | 'prefer_not_to_say';
  selfHarmThoughts: Scale0to4;

  // Mode
  mode: ModeChoice;

  // Presenting concerns & goals
  concernsText?: string;                // short free text
  concerns: string[];                   // chips
  goalsText?: string;                   // short free text

  // Cross-cutting (short form)
  crossCutting: {
    pleasure: Scale0to4;
    lowMood: Scale0to4;
    irritability: Scale0to4;
    activation: Scale0to4;
    anxiety: Scale0to4;
    avoidance: Scale0to4;
    somatic: Scale0to4;
    psychosisLike: Scale0to4;
    sleepProblems: Scale0to4;
    cognition: Scale0to4;
    ocdLike: Scale0to4;
    dissociation: Scale0to4;
    substance: Scale0to4;
  };

  // Functioning (WHODAS-lite; last 30d)
  functioning: {
    understanding: Scale0to4;
    mobility: Scale0to4;
    selfCare: Scale0to4;
    gettingAlong: Scale0to4;
    lifeActivities: Scale0to4;
    participation: Scale0to4;
  };

  // Cultural & context (short free text)
  identityContext?: string;
  meaningMaking?: string;
  stressesSupports?: string;

  // Medical & lifestyle (short free text or toggles)
  medicalDx?: string;
  meds?: string;
  sleep?: string;
  substances?: {
    caffeine?: string;
    alcohol?: string;
    nicotine?: string;
    cannabis?: string;
  };
  movement?: string;

  // Strengths & preferences
  strengths?: string;
  preferences: ('guided' | 'mindfulness' | 'journaling' | 'short_checkins')[];
  nudges: 'daily' | '2-3x/week' | 'weekly';
};

type UserDoc = {
  clerk_user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  onboarding?: OnboardingPayload & { completed_at?: Date };
  onboarded?: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function upsertUserFromClerk(input: {
  clerk_user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}): Promise<void> {
  const users = await getCollection<UserDoc>('users');
  const now = new Date();
  await users.updateOne(
    { clerk_user_id: input.clerk_user_id },
    {
      $setOnInsert: { created_at: now },
      $set: {
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        image_url: input.image_url,
        updated_at: now,
      },
    },
    { upsert: true },
  );
}

export async function saveOnboarding(params: {
  clerk_user_id: string;
  data: OnboardingPayload;
}): Promise<void> {
  const users = await getCollection<UserDoc>('users');
  const now = new Date();
  await users.updateOne(
    { clerk_user_id: params.clerk_user_id },
    {
      $setOnInsert: { created_at: now },
      $set: {
        onboarding: { ...params.data, completed_at: now },
        onboarded: true,
        updated_at: now,
      },
    },
    { upsert: true },
  );
}


