"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";

export function UserActions() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!clerkEnabled) {
    return (
      <span className="rounded-md border border-aqua-400/30 bg-aqua-50 px-3 py-2 text-xs font-semibold text-navy-700 dark:bg-aqua-400/10 dark:text-aqua-100">
        Demo mode
      </span>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-navy-700 dark:bg-aqua-400 dark:text-navy-950">
            <LogIn aria-hidden className="h-4 w-4" />
            Sign in with Google
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
}
