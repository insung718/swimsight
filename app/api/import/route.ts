import { badRequest, created } from "@/lib/api";
import { validateSwimCsv } from "@/lib/csv";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createManySwims } from "@/lib/services/swim-service";
import { csvImportSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, csvImportSchema, 120_000);
  if (!parsed.ok) return parsed.response;
  const result = validateSwimCsv(parsed.data.csv);

  if (!parsed.data.persist) {
    return Response.json(result);
  }

  if (result.errors.length) {
    return badRequest("Fix CSV validation errors before importing.", result.errors);
  }

  try {
    const swims = await createManySwims(
      result.validRows.map((row) => ({
        userId: account.context.userId,
        ...row,
        notes: row.notes ?? undefined,
        source: "CSV"
      }))
    );

    return created({ ...result, swims });
  } catch (error) {
    console.error("Could not import swims", error);
    return databaseUnavailable();
  }
}
