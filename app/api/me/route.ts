import { NextResponse } from "next/server";
import { ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { isTrustedAdminEmail } from "@/lib/security/admin";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { profileRoleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: account.context.userId },
      select: { id: true, name: true, email: true, imageUrl: true, role: true, onboardingCompleted: true, createdAt: true }
    });
  } catch (error) {
    logServerError("Could not load profile", error);
    return databaseUnavailable();
  }

  return NextResponse.json({
    user
  });
}

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, profileRoleSchema);
  if (!parsed.ok) return parsed.response;
  const nextRole = isTrustedAdminEmail(account.context.email) ? "ADMIN" : parsed.data.role;

  try {
    const user = await prisma.user.update({
      where: { id: account.context.userId },
      data: {
        role: nextRole,
        onboardingCompleted: true
      },
      select: { id: true, name: true, email: true, imageUrl: true, role: true, onboardingCompleted: true }
    });

    return ok({ user });
  } catch (error) {
    logServerError("Could not update profile role", error);
    return databaseUnavailable();
  }
}
