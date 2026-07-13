import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { conflict, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { changeConsent, excludeTrainingData, getConsentState } from "@/lib/services/privacy-service";
import { consentMutationSchema, privacyDeletionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return ok({
      consent: await getConsentState(account.context.userId),
      retentionPolicy: "/privacy",
      publicResearchMinimumCohort: 25
    });
  } catch (error) {
    logServerError("Could not load privacy settings", error);
    return NextResponse.json({ error: "Privacy settings are temporarily unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, consentMutationSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const consent = await changeConsent({ ...parsed.data, userId: account.context.userId });
    return ok({ consent });
  } catch (error) {
    if (error instanceof Error && error.message === "GUARDIAN_CONSENT_REQUIRED") {
      return NextResponse.json({ error: "Guardian consent is required before a minor can join model training or public research." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "GUARDIAN_VERIFICATION_REQUIRED") {
      return NextResponse.json({ error: "Guardian consent cannot be self-certified. A verified guardian workflow is required." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "CONSENT_POLICY_VERSION_MISMATCH") {
      return conflict("The consent policy has changed. Refresh before confirming.");
    }
    logServerError("Could not update consent", error);
    return NextResponse.json({ error: "Consent could not be updated." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, privacyDeletionSchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.scope === "TRAINING_DATA") {
    try {
      const consent = await excludeTrainingData(account.context.userId);
      return ok({ excluded: true, personalAnalyticsRetained: true, consent });
    } catch (error) {
      logServerError("Could not exclude training data", error);
      return NextResponse.json({ error: "Training-data exclusion could not be completed." }, { status: 503 });
    }
  }

  try {
    await prisma.user.delete({ where: { id: account.context.userId } });
  } catch (error) {
    logServerError("Could not delete SwimSight account data", error);
    return NextResponse.json({ error: "Account data could not be deleted." }, { status: 503 });
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(account.context.clerkId);
    return ok({ applicationDataDeleted: true, identityDeleted: true });
  } catch (error) {
    logServerError("Clerk identity deletion remains pending after application-data deletion", error);
    return NextResponse.json({ applicationDataDeleted: true, identityDeleted: false, identityDeletionPending: true }, { status: 202 });
  }
}
