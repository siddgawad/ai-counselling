// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk(.*)'
  // add truly public routes if you have any:
  // '/', '/privacy'
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return NextResponse.next();

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  return NextResponse.next(); // no consent/onboarding logic here
});

export const config = { matcher: ['/((?!_next|.*\\..*).*)'] };
