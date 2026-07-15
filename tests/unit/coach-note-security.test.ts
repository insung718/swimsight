import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const coachAthleteAccess = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  coachNote: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/access-audit-service", () => ({ coachAthleteAccess }));

import { createCoachNote, deleteCoachNote, listCoachNotes } from "@/lib/services/coach-note-service";

const access = {
  coachId: "coach-1",
  athleteId: "athlete-1",
  teamId: "team-1"
};

describe("private coach-note authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails closed and requests the dedicated note scope when listing notes", async () => {
    coachAthleteAccess.mockResolvedValueOnce(false);

    await expect(listCoachNotes(access)).resolves.toBeNull();
    expect(coachAthleteAccess).toHaveBeenCalledWith(expect.objectContaining({
      ...access,
      requiredScope: "COACH_NOTES"
    }));
    expect(prismaMock.coachNote.findMany).not.toHaveBeenCalled();
  });

  it("requires the dedicated note scope before creating a note", async () => {
    coachAthleteAccess.mockResolvedValueOnce(true);
    prismaMock.coachNote.create.mockResolvedValueOnce({ id: "note-1" });

    await createCoachNote({ ...access, content: "Keep the finish controlled." });

    expect(coachAthleteAccess).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: "COACH_NOTES" }));
    expect(prismaMock.coachNote.create).toHaveBeenCalledOnce();
  });

  it("does not let another coach delete the note", async () => {
    prismaMock.coachNote.findFirst.mockResolvedValueOnce({ authorId: "coach-2", subjectUserId: "athlete-1" });

    await expect(deleteCoachNote({ coachId: "coach-1", teamId: "team-1", noteId: "note-1" })).resolves.toBe(false);
    expect(coachAthleteAccess).not.toHaveBeenCalled();
    expect(prismaMock.coachNote.deleteMany).not.toHaveBeenCalled();
  });
});
