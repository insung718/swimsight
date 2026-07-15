import { created, forbidden, notFound, ok } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createCoachNote, deleteCoachNote, listCoachNotes } from "@/lib/services/coach-note-service";
import { coachNoteCreateSchema, coachNoteDeleteSchema, coachNoteQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const url = new URL(request.url);
  const parsed = coachNoteQuerySchema.safeParse({ teamId: url.searchParams.get("teamId"), athleteId: url.searchParams.get("athleteId") });
  if (!parsed.success) return notFound();
  try {
    const notes = await listCoachNotes({ coachId: account.context.userId, ...parsed.data });
    return notes ? ok({ notes }) : forbidden();
  } catch (error) {
    logServerError("Could not list coach notes", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, coachNoteCreateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const note = await createCoachNote({ coachId: account.context.userId, ...parsed.data });
    return note ? created({ note }) : forbidden();
  } catch (error) {
    logServerError("Could not create coach note", error);
    return databaseUnavailable();
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, coachNoteDeleteSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return await deleteCoachNote({ coachId: account.context.userId, ...parsed.data }) ? ok({ deleted: true }) : forbidden();
  } catch (error) {
    logServerError("Could not delete coach note", error);
    return databaseUnavailable();
  }
}
