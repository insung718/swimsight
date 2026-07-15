import { badRequest, created, forbidden, ok } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { buildDatasetReadiness, createResearchCohortManifest, listResearchCohortManifests } from "@/lib/services/data-foundation-service";
import { listActivePilotCohorts } from "@/lib/services/pilot-service";
import { researchCohortBuildSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  if (account.context.role !== "ADMIN") return forbidden("Administrator access is required.");
  try {
    const [readiness, manifests, pilots] = await Promise.all([buildDatasetReadiness(), listResearchCohortManifests(), listActivePilotCohorts(true)]);
    return ok({ readiness, manifests, pilots });
  } catch (error) {
    logServerError("Could not load data foundation dashboard", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  if (account.context.role !== "ADMIN") return forbidden("Administrator access is required.");
  const parsed = await parseSecureJson(request, researchCohortBuildSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return created({ manifest: await createResearchCohortManifest({ createdById: account.context.userId, extractionCutoff: new Date(parsed.data.extractionCutoff) }) });
  } catch (error) {
    if (error instanceof Error && error.message === "COHORT_FORBIDDEN") return forbidden("Administrator access is required.");
    if (error instanceof Error && error.message === "COHORT_CUTOFF_IN_FUTURE") return badRequest("Extraction cutoff cannot be in the future.");
    if (error instanceof Error && error.message === "TRAINING_PSEUDONYM_SECRET_NOT_CONFIGURED") return badRequest("Training cohort security is not configured.");
    logServerError("Could not create research cohort manifest", error);
    return databaseUnavailable();
  }
}
