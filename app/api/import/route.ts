import { NextResponse } from "next/server";
import { badRequest, created, unauthorized } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { validateSwimCsv } from "@/lib/csv";
import { hasDatabaseConfig } from "@/lib/prisma";
import { createManySwims } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Request body must include a csv string." }, { status: 400 });
  }

  const result = validateSwimCsv(body.csv);

  if (!body.persist) {
    return NextResponse.json(result);
  }

  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before importing swims.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before imported swims can be saved.");
  }

  if (result.errors.length) {
    return badRequest("Fix CSV validation errors before importing.", result.errors);
  }

  const swims = await createManySwims(
    result.validRows.map((row) => ({
      userId: context.userId,
      ...row,
      notes: row.notes ?? undefined,
      source: "CSV"
    }))
  );

  return created({ ...result, swims });
}
