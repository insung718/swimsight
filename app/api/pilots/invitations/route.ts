import { created, forbidden, notFound, ok } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { coachCanManageClub } from "@/lib/services/coach-service";
import { createPilotInvitation, listPilotInvitations, revokePilotInvitation } from "@/lib/services/pilot-service";
import { pilotInviteCreateSchema, pilotInviteRevokeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return ok({ invitations: await listPilotInvitations(account.context.userId) });
  } catch (error) {
    logServerError("Could not list pilot invitations", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, pilotInviteCreateSchema);
  if (!parsed.ok) return parsed.response;
  if (!parsed.data.teamId && account.context.role !== "ADMIN") return forbidden("Only an administrator can create an individual pilot invitation.");
  if (parsed.data.teamId && !(await coachCanManageClub(account.context.userId, parsed.data.teamId))) return forbidden();
  try {
    const result = await createPilotInvitation({ createdById: account.context.userId, ...parsed.data });
    return created({
      invitation: result.invitation,
      token: result.token,
      joinPath: `/pilot?token=${encodeURIComponent(result.token)}`,
      warning: "This token is shown once. Share it only with the intended pilot participants."
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PILOT_FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "PILOT_COHORT_UNAVAILABLE") return notFound("Pilot cohort is inactive or expires before this invitation.");
    if (error instanceof Error && error.message.includes("Foreign key")) return notFound("Pilot cohort or club was not found.");
    logServerError("Could not create pilot invitation", error);
    return databaseUnavailable();
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, pilotInviteRevokeSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const invitation = await revokePilotInvitation({
      actorId: account.context.userId,
      actorRole: account.context.role,
      invitationId: parsed.data.invitationId
    });
    return invitation ? ok({ invitation }) : notFound("Pilot invitation was not found.");
  } catch (error) {
    logServerError("Could not revoke pilot invitation", error);
    return databaseUnavailable();
  }
}
