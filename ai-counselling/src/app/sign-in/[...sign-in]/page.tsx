// src/app/sign-in/page.tsx  (server component)
import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { upsertUserFromClerk } from '@/db/users';

export default async function SignInRedirector() {

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/sign-in/' });


  console.log('[sign-in] clerk_user_id:', userId);

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  // Optional: log a lightweight profile snapshot (avoid secrets)
  console.log('[sign-in] profile:', {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  await upsertUserFromClerk({
    clerk_user_id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    image_url: user.imageUrl ?? null,
  });

  redirect('/onboarding');
}
