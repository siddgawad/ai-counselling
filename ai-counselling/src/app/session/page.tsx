import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/mongo';

export default async function SessionPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/session' });

  // Prefer Clerk flag (fast), or check Mongo if you like
  const client = await clerkClient();
  const u = await client.users.getUser(userId);
  const onboarded = Boolean(u.publicMetadata?.onboarded);
  if (!onboarded) redirect('/onboarding');

  const db = await getDb();
  const user = await db
    .collection('users')
    .findOne({ clerk_user_id: userId }, { projection: { onboarding: 1, first_name: 1 } });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Session</h1>
      <pre className="rounded border p-4 text-sm bg-white/60">
        {JSON.stringify(user?.onboarding ?? {}, null, 2)}
      </pre>
    </div>
  );
}
