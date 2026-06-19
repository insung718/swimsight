"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserActions({ compact = false, hero = false, light = false }: { compact?: boolean; hero?: boolean; light?: boolean }) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!clerkEnabled) {
    return compact || hero ? null : <span className="text-xs text-current opacity-45">Account unavailable</span>;
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className={cn(
            "inline-flex items-center gap-2 text-sm font-medium transition",
            compact && "h-8 rounded-full bg-black px-4 text-white hover:bg-black/75",
            hero && !light && "h-11 rounded-full bg-white px-5 text-black hover:bg-white/85",
            hero && light && "h-11 rounded-full bg-black px-5 text-white hover:bg-black/80",
            !compact && !hero && "h-10 rounded-md bg-navy-900 px-3 text-white hover:bg-navy-700 dark:bg-aqua-400 dark:text-navy-950"
          )}>
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
