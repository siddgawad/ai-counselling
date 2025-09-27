// src/db/users.ts
import { getCollection } from '@/lib/mongo';

export type OnboardingPayload = {
  fullName?: string;
  age?: number;
  goals?: string[];
  mode?: 'text' | 'multimodal';
  timezone?: string;
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
