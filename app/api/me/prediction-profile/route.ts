import { NextResponse } from "next/server";
import { ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { predictionProfileSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  try {
    const profile = await prisma.user.findUnique({
      where: { id: account.context.userId },
      select: { age: true, sex: true, taperDays: true, swimSessionsPerWeek: true }
    });

    return NextResponse.json({ profile });
  } catch (error) {
    logServerError("Could not load prediction profile", error);
    return databaseUnavailable();
  }
}

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, predictionProfileSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const profile = await prisma.user.update({
      where: { id: account.context.userId },
      data: parsed.data,
      select: { age: true, sex: true, taperDays: true, swimSessionsPerWeek: true }
    });

    return ok({ profile });
  } catch (error) {
    logServerError("Could not update prediction profile", error);
    return databaseUnavailable();
  }
}
