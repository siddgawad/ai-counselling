import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function ConsentPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/consent' });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const consented = Boolean(user.publicMetadata?.consented);
  const onboarded = Boolean(user.publicMetadata?.onboarded);

  // Short-circuit if they already did this step
  if (consented && onboarded) redirect('/session');
  if (consented && !onboarded) redirect('/onboarding');

  async function accept() {
    'use server';
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const client = await clerkClient();
    const u = await client.users.getUser(userId);

    // Merge publicMetadata so we don't clobber other flags
    const nextMeta = { ...(u.publicMetadata ?? {}), consented: true };

    // Idempotent: only update if needed
    if (!nextMeta.consented) nextMeta.consented = true;

    await client.users.updateUser(userId, { publicMetadata: nextMeta });

    redirect('/onboarding');
  }

  return (
    <form action={accept} className="space-y-4">
      <h1 className="text-xl font-semibold">Consent</h1>
      <p>No raw audio/video is stored by default. You control exports and retention.</p>
      <button className="rounded bg-black px-4 py-2 text-white" type="submit">
        I Agree
      </button>
    </form>
  );
}
