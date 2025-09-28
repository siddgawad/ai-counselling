'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

export default function DebugUserConsole() {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;
    // This prints into the **browser** devtools console
    console.log('[home] clerk_user_id:', user.id);
    console.log('[home] profile:', {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }, [isLoaded, user]);

  return null; // no UI
}
