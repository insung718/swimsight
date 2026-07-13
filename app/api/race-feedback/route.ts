import { NextResponse } from "next/server";
import { conflict, created, notFound, ok } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createRaceFeedback, deleteRaceFeedback, listRaceFeedback, updateRaceFeedback } from "@/lib/services/race-feedback-service";
import { raceFeedbackCreateSchema, raceFeedbackDeleteSchema, raceFeedbackUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function feedbackError(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "FEEDBACK_RESULT_NOT_FOUND" || error.message === "FEEDBACK_NOT_FOUND") return notFound("Race feedback was not found in this account.");
  if (error.message === "FEEDBACK_ALREADY_EXISTS") return conflict("Feedback already exists for this race.");
  if (error.message === "FEEDBACK_VERSION_CONFLICT") return conflict("This feedback changed in another session. Refresh before editing again.");
  return null;
}

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return ok({ feedback: await listRaceFeedback(account.context.userId) });
  } catch (error) {
    logServerError("Could not load race feedback", error);
    return NextResponse.json({ error: "Race feedback is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, raceFeedbackCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { swimResultId, ...fields } = parsed.data;
  try {
    return created({ feedback: await createRaceFeedback(account.context.userId, swimResultId, fields) });
  } catch (error) {
    const response = feedbackError(error);
    if (response) return response;
    logServerError("Could not create race feedback", error);
    return NextResponse.json({ error: "Race feedback could not be saved." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, raceFeedbackUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { expectedVersion, feedbackId, ...fields } = parsed.data;
  try {
    return ok({ feedback: await updateRaceFeedback(account.context.userId, feedbackId, expectedVersion, fields) });
  } catch (error) {
    const response = feedbackError(error);
    if (response) return response;
    logServerError("Could not update race feedback", error);
    return NextResponse.json({ error: "Race feedback could not be updated." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, raceFeedbackDeleteSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return ok(await deleteRaceFeedback(account.context.userId, parsed.data.feedbackId, parsed.data.expectedVersion));
  } catch (error) {
    const response = feedbackError(error);
    if (response) return response;
    logServerError("Could not delete race feedback", error);
    return NextResponse.json({ error: "Race feedback could not be deleted." }, { status: 503 });
  }
}
