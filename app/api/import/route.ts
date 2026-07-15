import { badRequest, created, notFound, ok } from "@/lib/api";
import { CsvDocumentError } from "@/lib/imports/csv-parser";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import {
  commitImportBatch,
  correctImportRow,
  listImportBatches,
  previewImportBatch,
  resolveImportIdentity,
  rollbackImportBatch
} from "@/lib/services/import-service";
import { importMutationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return ok({ batches: await listImportBatches(account.context.userId) });
  } catch (error) {
    logServerError("Could not list import batches", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, importMutationSchema, 1_650_000);
  if (!parsed.ok) return parsed.response;

  try {
    switch (parsed.data.mode) {
      case "PREVIEW":
        return created(await previewImportBatch({ userId: account.context.userId, ...parsed.data }));
      case "COMMIT": {
        const batch = await commitImportBatch({ userId: account.context.userId, batchId: parsed.data.batchId, rowIds: parsed.data.rowIds });
        return batch ? ok({ batch }) : notFound("Import batch is unavailable or no longer commit-ready.");
      }
      case "ROLLBACK": {
        const batch = await rollbackImportBatch({ userId: account.context.userId, batchId: parsed.data.batchId });
        return batch ? ok({ batch }) : notFound("Import batch was not found or was already rolled back.");
      }
      case "CORRECT_ROW": {
        const batch = await correctImportRow({ userId: account.context.userId, batchId: parsed.data.batchId, rowId: parsed.data.rowId, result: parsed.data.result });
        return batch ? ok({ batch }) : notFound("Import row was not found or can no longer be edited.");
      }
      case "RESOLVE_IDENTITY": {
        const batch = await resolveImportIdentity({ userId: account.context.userId, batchId: parsed.data.batchId, candidateId: parsed.data.candidateId, action: parsed.data.action });
        return batch ? ok({ batch }) : notFound("Identity review was not found.");
      }
    }
  } catch (error) {
    if (error instanceof CsvDocumentError) return badRequest(error.message, [{ code: error.code }]);
    if (error instanceof Error && error.message.startsWith("Column mapping")) return badRequest(error.message);
    logServerError("Import operation failed", error);
    return databaseUnavailable();
  }
}
