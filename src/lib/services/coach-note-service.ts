import "server-only";
import { prisma } from "@/lib/prisma";
import { coachAthleteAccess } from "@/lib/services/access-audit-service";

export async function listCoachNotes(input: { coachId: string; athleteId: string; teamId: string }) {
  const allowed = await coachAthleteAccess({
    ...input,
    action: "LIST_COACH_NOTES",
    resourceType: "COACH_NOTE",
    purpose: "COACHING_WORKSPACE",
    requiredScope: "COACH_NOTES"
  });
  if (!allowed) return null;
  return prisma.coachNote.findMany({
    where: { teamId: input.teamId, subjectUserId: input.athleteId },
    select: { id: true, content: true, authorId: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function createCoachNote(input: { coachId: string; athleteId: string; teamId: string; content: string }) {
  const allowed = await coachAthleteAccess({
    ...input,
    action: "CREATE_COACH_NOTE",
    resourceType: "COACH_NOTE",
    purpose: "COACHING_WORKSPACE",
    requiredScope: "COACH_NOTES"
  });
  if (!allowed) return null;
  return prisma.coachNote.create({
    data: { authorId: input.coachId, subjectUserId: input.athleteId, teamId: input.teamId, content: input.content },
    select: { id: true, content: true, authorId: true, createdAt: true, updatedAt: true }
  });
}

export async function deleteCoachNote(input: { coachId: string; noteId: string; teamId: string }) {
  const note = await prisma.coachNote.findFirst({ where: { id: input.noteId, teamId: input.teamId }, select: { authorId: true, subjectUserId: true } });
  if (!note || note.authorId !== input.coachId) return false;
  const allowed = await coachAthleteAccess({
    coachId: input.coachId,
    athleteId: note.subjectUserId,
    teamId: input.teamId,
    action: "DELETE_COACH_NOTE",
    resourceType: "COACH_NOTE",
    resourceId: input.noteId,
    purpose: "COACHING_WORKSPACE",
    requiredScope: "COACH_NOTES"
  });
  if (!allowed) return false;
  return (await prisma.coachNote.deleteMany({ where: { id: input.noteId, teamId: input.teamId, authorId: input.coachId } })).count === 1;
}
