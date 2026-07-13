import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { resolveTrustedRole } from "@/lib/security/admin";

export interface AuthContext {
  userId: string;
  clerkId: string;
  email: string;
  age?: number | null;
  sex?: "FEMALE" | "MALE" | null;
  taperDays?: number | null;
  swimSessionsPerWeek?: number | null;
  role: "ATHLETE" | "COACH" | "ADMIN";
  onboardingCompleted: boolean;
  personalAnalyticsConsentActive: boolean;
}

function isVerifiedEmail(emailAddress: NonNullable<Awaited<ReturnType<typeof currentUser>>>["emailAddresses"][number]) {
  return emailAddress.verification?.status === "verified";
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
  const verifiedEmail =
    clerkUser?.primaryEmailAddress && isVerifiedEmail(clerkUser.primaryEmailAddress)
      ? clerkUser.primaryEmailAddress
      : clerkUser?.emailAddresses.find(isVerifiedEmail);
  const email = verifiedEmail?.emailAddress;
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
      age: null,
      sex: null,
      taperDays: null,
      swimSessionsPerWeek: null,
      role: "ATHLETE",
      onboardingCompleted: false,
      personalAnalyticsConsentActive: false
    };
  }

  const userByClerkId = await prisma.user.findUnique({
    where: { clerkId: authResult.userId }
  });
  let user;
  if (userByClerkId) {
    const emailOwner = await prisma.user.findFirst({
      where: { email, id: { not: userByClerkId.id } },
      select: { id: true }
    });
    user = await prisma.user.update({
      where: { id: userByClerkId.id },
      data: {
        ...(emailOwner ? {} : { email }),
        name,
        imageUrl: clerkUser?.imageUrl
      }
    });
  } else {
    user = await prisma.user.upsert({
      where: { email },
      update: {
        clerkId: authResult.userId,
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
  }
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
    age: user.age,
    sex: user.sex,
    taperDays: user.taperDays,
    swimSessionsPerWeek: user.swimSessionsPerWeek,
    role: trustedRole,
    onboardingCompleted: user.onboardingCompleted,
    personalAnalyticsConsentActive: Boolean(
      user.personalAnalyticsConsentedAt
      && user.personalAnalyticsConsentVersion === "analytics-v1"
      && (!user.personalAnalyticsWithdrawnAt || user.personalAnalyticsConsentedAt > user.personalAnalyticsWithdrawnAt)
    )
  };
}

export async function requireAuthContext() {
  const context = await getAuthContext();

  if (!context) {
    throw new Error("UNAUTHENTICATED");
  }

  return context;
}
