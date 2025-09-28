// src/app/page.tsx
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import { auth, clerkClient } from '@clerk/nextjs/server';
import DebugUserConsole from './components/DebugUserConsole';

export default async function Page() {
  const { userId } = await auth();
  if (userId) {
    const c = await clerkClient();
    const u = await c.users.getUser(userId);
    // This prints into the **server** terminal
    console.log('[home] clerk_user_id:', u.id);
    console.log('[home] profile:', {
      id: u.id,
      email: u.primaryEmailAddress?.emailAddress,
      firstName: u.firstName,
      lastName: u.lastName,
    });
  }

  return (
    <div className="min-h-screen bg-sunset flex flex-col">
      <DebugUserConsole />
      <Navbar />
      <div>
        <Hero />
      </div>
    </div>
  );
}
