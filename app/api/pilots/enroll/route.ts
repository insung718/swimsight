import { conflict, created, notFound, ok } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { acceptPilotInvitation, inspectPilotInvitation, listPilotEnrollments, withdrawPilotEnrollment } from "@/lib/services/pilot-service";
import { pilotEnrollmentSchema, pilotWithdrawalSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return ok({ enrollments: await listPilotEnrollments(account.context.userId) });
  } catch (error) {
    logServerError("Could not list pilot enrollments", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, pilotEnrollmentSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = parsed.data.mode === "PREVIEW"
      ? await inspectPilotInvitation({ userId: account.context.userId, token: parsed.data.token })
      : await acceptPilotInvitation({ userId: account.context.userId, token: parsed.data.token });
    if (!result.ok) {
      if (result.reason === "INVITATION_FULL") return conflict("This pilot invitation has reached its participant limit.");
      if (result.reason === "INVITATION_SELF") return conflict("You cannot join a pilot club that you created or coach.");
      return notFound("Pilot invitation is invalid, expired, or revoked.");
    }
    return parsed.data.mode === "PREVIEW" ? ok(result) : created(result);
  } catch (error) {
    logServerError("Could not accept pilot invitation", error);
    return databaseUnavailable();
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, pilotWithdrawalSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const enrollment = await withdrawPilotEnrollment({ userId: account.context.userId, enrollmentId: parsed.data.enrollmentId });
    return enrollment ? ok({ enrollment }) : notFound("Active pilot enrollment was not found.");
  } catch (error) {
    logServerError("Could not withdraw pilot enrollment", error);
    return databaseUnavailable();
  }
}
