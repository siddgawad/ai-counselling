// in src/app/sign-in/page.tsx or a server component that renders after login
import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { upsertUserFromClerk } from '@/db/users';

export default async function SignInRedirector() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/session' });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  await upsertUserFromClerk({
    clerk_user_id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    image_url: user.imageUrl ?? null,
  });

  // now redirect to wherever you want
  redirect('/session');
}