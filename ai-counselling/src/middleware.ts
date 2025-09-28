// src/middleware.ts
import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk(.*)',
]);

// routes that are allowed even when not onboarded
const isOnboarding = createRouteMatcher(['/onboarding(.*)']);

// (optional) allow health/ping if you add one later
// const isHealth = createRouteMatcher(['/api/health(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes through
  if (isPublic(req)) return NextResponse.next();

  // Require auth everywhere else
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  // If already on the onboarding flow, allow it
  if (isOnboarding(req)) return NextResponse.next();

  // Check Clerk publicMetadata for the flag set after onboarding is saved
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const onboarded = Boolean(user.publicMetadata?.onboarded);

  if (!onboarded) {
    const url = new URL(req.nextUrl);
    url.pathname = '/onboarding';
    // optional: preserve original destination so you can redirect back after finishing
    url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // All good — proceed
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
