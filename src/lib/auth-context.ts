import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { resolveTrustedRole } from "@/lib/security/admin";

export interface AuthContext {
  userId: string;
  clerkId: string;
  email: string;
  role: "ATHLETE" | "COACH" | "ADMIN";
  onboardingCompleted: boolean;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return null;
  }

  const authResult = await auth();

  if (!authResult.userId) {
    return null;
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  const name =
    clerkUser?.fullName ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    "SwimSight Athlete";

  if (!hasDatabaseConfig()) {
    return {
      userId: authResult.userId,
      clerkId: authResult.userId,
      email,
      role: "ATHLETE",
      onboardingCompleted: false
    };
  }

  const user = await prisma.user.upsert({
    where: { clerkId: authResult.userId },
    update: {
      email,
      name,
      imageUrl: clerkUser?.imageUrl
    },
    create: {
      clerkId: authResult.userId,
      email,
      name,
      imageUrl: clerkUser?.imageUrl
    }
  });
  const trustedRole = resolveTrustedRole(user.role, user.email);

  if (trustedRole !== user.role) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: trustedRole }
    });
  }

  return {
    userId: user.id,
    clerkId: user.clerkId,
    email: user.email,
    role: trustedRole,
    onboardingCompleted: user.onboardingCompleted
  };
}

export async function requireAuthContext() {
  const context = await getAuthContext();

  if (!context) {
    throw new Error("UNAUTHENTICATED");
  }

  return context;
}
