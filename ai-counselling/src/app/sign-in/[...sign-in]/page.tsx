'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <SignIn
        routing="hash"                 // avoids app router conflicts
        signUpUrl="/sign-up"
      />
    </div>
  );
}
