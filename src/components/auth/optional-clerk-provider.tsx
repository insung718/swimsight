"use client";

import { ClerkProvider } from "@clerk/nextjs";

export function OptionalClerkProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      publishableKey={publishableKey}
      signInFallbackRedirectUrl="/"
      signInForceRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      signUpForceRedirectUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
