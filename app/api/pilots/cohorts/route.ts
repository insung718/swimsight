import { created, forbidden, ok } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createPilotCohort, listActivePilotCohorts } from "@/lib/services/pilot-service";
import { coachHasManagedClub } from "@/lib/services/coach-service";
import { pilotCohortCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    if (account.context.role !== "ADMIN" && !(await coachHasManagedClub(account.context.userId))) return forbidden("Coach or administrator access is required.");
    return ok({ cohorts: await listActivePilotCohorts() });
  } catch (error) {
    logServerError("Could not list pilot cohorts", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  if (account.context.role !== "ADMIN") return forbidden("Administrator access is required.");
  const parsed = await parseSecureJson(request, pilotCohortCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return created({ cohort: await createPilotCohort({ createdById: account.context.userId, ...parsed.data }) });
  } catch (error) {
    if (error instanceof Error && error.message === "PILOT_FORBIDDEN") return forbidden("Administrator access is required.");
    logServerError("Could not create pilot cohort", error);
    return databaseUnavailable();
  }
}
