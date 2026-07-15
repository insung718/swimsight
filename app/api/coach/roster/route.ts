import { badRequest, conflict, created, forbidden, ok } from "@/lib/api";
import { CsvDocumentError } from "@/lib/imports/csv-parser";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { commitRosterImport, previewRosterImport } from "@/lib/services/roster-import-service";
import { rosterImportMutationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, rosterImportMutationSchema, 220_000);
  if (!parsed.ok) return parsed.response;
  try {
    return parsed.data.mode === "PREVIEW"
      ? ok(await previewRosterImport({ coachId: account.context.userId, ...parsed.data }))
      : created(await commitRosterImport({ coachId: account.context.userId, ...parsed.data }));
  } catch (error) {
    if (error instanceof CsvDocumentError) return badRequest(error.message, [{ code: error.code }]);
    if (error instanceof Error && error.message === "ROSTER_FORBIDDEN") return forbidden("You cannot manage this club roster.");
    if (error instanceof Error && error.message === "ROSTER_COHORT_UNAVAILABLE") return badRequest("The selected pilot cohort is unavailable.");
    if (error instanceof Error && error.message === "ROSTER_PREVIEW_INVALID") return badRequest("Roster preview expired or no longer matches this file.");
    if (error instanceof Error && error.message === "ROSTER_ALREADY_COMMITTED") return conflict("This exact roster was already committed for this club.");
    if (error instanceof Error && error.message === "ROSTER_TOO_MANY_ROWS") return badRequest("Roster imports are limited to 500 swimmers.");
    if (error instanceof Error && error.message === "ROSTER_COLUMNS_REQUIRED") return badRequest("Roster spreadsheet requires Name and Email columns.");
    logServerError("Could not import coach roster", error);
    return databaseUnavailable();
  }
}
