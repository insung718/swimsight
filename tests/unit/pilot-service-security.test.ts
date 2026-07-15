import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const appendAccessAudit = vi.hoisted(() => vi.fn());
const recordProductEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/access-audit-service", () => ({
  ATHLETE_SHARE_CONSENT_VERSION: "coach-share-v2",
  ATHLETE_SHARE_SCOPES: ["RESULTS", "GOALS", "PREDICTIONS", "UPCOMING_MEETS", "COACH_NOTES"],
  appendAccessAudit
}));
vi.mock("@/lib/services/product-analytics-service", () => ({ recordProductEvent }));

const transaction = vi.hoisted(() => ({
  pilotInvitation: { findUnique: vi.fn(), updateMany: vi.fn() },
  pilotEnrollment: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  teamMembership: { findUnique: vi.fn(), create: vi.fn() },
  athleteShareGrant: { upsert: vi.fn(), updateMany: vi.fn() }
}));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  pilotInvitation: { findUnique: vi.fn() },
  pilotEnrollment: { findUnique: vi.fn() },
  teamMembership: { findUnique: vi.fn() }
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  acceptPilotInvitation,
  inspectPilotInvitation,
  withdrawPilotEnrollment
} from "@/lib/services/pilot-service";

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invite-1",
    createdById: "coach-1",
    cohortId: "cohort-1",
    teamId: "team-1",
    audience: "CLUB",
    maxUses: 1,
    useCount: 0,
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    cohort: { id: "cohort-1", name: "Summer pilot", label: "summer-2026", active: true, startsAt: null, endsAt: null },
    ...overrides
  };
}

describe("pilot invitation and athlete-sharing security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.pilotEnrollment.findUnique.mockResolvedValue(null);
    transaction.teamMembership.findUnique.mockResolvedValue(null);
    transaction.pilotInvitation.updateMany.mockResolvedValue({ count: 1 });
    transaction.pilotEnrollment.upsert.mockResolvedValue({ id: "enrollment-1", status: "ACTIVE" });
  });

  it("fails closed for missing, revoked, expired, and not-yet-open invitations", async () => {
    for (const unavailable of [
      null,
      invitation({ revokedAt: new Date() }),
      invitation({ expiresAt: new Date(Date.now() - 1_000) }),
      invitation({ cohort: { id: "cohort-1", active: true, startsAt: new Date(Date.now() + 86_400_000), endsAt: null } })
    ]) {
      transaction.pilotInvitation.findUnique.mockResolvedValueOnce(unavailable);
      await expect(acceptPilotInvitation({ userId: "athlete-1", token: "valid-token-value" })).resolves.toEqual({
        ok: false,
        reason: "INVITATION_UNAVAILABLE"
      });
    }
    expect(transaction.pilotEnrollment.upsert).not.toHaveBeenCalled();
  });

  it("prevents invitation creators and existing club coaches from joining as athletes", async () => {
    transaction.pilotInvitation.findUnique.mockResolvedValueOnce(invitation({ createdById: "athlete-1" }));
    await expect(acceptPilotInvitation({ userId: "athlete-1", token: "valid-token-value" })).resolves.toMatchObject({ reason: "INVITATION_SELF" });

    transaction.pilotInvitation.findUnique.mockResolvedValueOnce(invitation());
    transaction.teamMembership.findUnique.mockResolvedValueOnce({ role: "COACH" });
    await expect(acceptPilotInvitation({ userId: "coach-2", token: "valid-token-value" })).resolves.toMatchObject({ reason: "INVITATION_SELF" });
    expect(transaction.pilotEnrollment.upsert).not.toHaveBeenCalled();
  });

  it("claims the final use atomically and fails closed when another request wins", async () => {
    transaction.pilotInvitation.findUnique.mockResolvedValueOnce(invitation());
    transaction.pilotInvitation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(acceptPilotInvitation({ userId: "athlete-1", token: "valid-token-value" })).resolves.toEqual({
      ok: false,
      reason: "INVITATION_FULL"
    });
    expect(transaction.pilotEnrollment.upsert).not.toHaveBeenCalled();
  });

  it("creates only swimmer membership and the disclosed least-privilege share scopes", async () => {
    transaction.pilotInvitation.findUnique.mockResolvedValueOnce(invitation());

    const result = await acceptPilotInvitation({ userId: "athlete-1", token: "valid-token-value" });

    expect(result).toMatchObject({ ok: true, enrollment: { teamId: "team-1", status: "ACTIVE" } });
    expect(transaction.teamMembership.create).toHaveBeenCalledWith({ data: { teamId: "team-1", userId: "athlete-1", role: "SWIMMER" } });
    expect(transaction.athleteShareGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        athleteId: "athlete-1",
        grantedById: "athlete-1",
        scopes: ["RESULTS", "GOALS", "PREDICTIONS", "UPCOMING_MEETS", "COACH_NOTES"]
      })
    }));
    expect(transaction.pilotEnrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        metadata: expect.objectContaining({ invitationDisclosureVersion: "pilot-disclosure-v2" })
      })
    }));
    expect(appendAccessAudit).toHaveBeenCalled();
  });

  it("shows the cohort, club, and scopes before acceptance without mutating access", async () => {
    prismaMock.pilotInvitation.findUnique.mockResolvedValueOnce({
      ...invitation(),
      team: { name: "BIS Swim Club" }
    });
    prismaMock.teamMembership.findUnique.mockResolvedValueOnce(null);
    prismaMock.pilotEnrollment.findUnique.mockResolvedValueOnce(null);

    const result = await inspectPilotInvitation({ userId: "athlete-1", token: "valid-token-value" });
    expect(result).toMatchObject({
      ok: true,
      invitation: {
        cohortName: "Summer pilot",
        clubName: "BIS Swim Club",
        coachAccessScopes: ["RESULTS", "GOALS", "PREDICTIONS", "UPCOMING_MEETS", "COACH_NOTES"]
      }
    });
    expect(transaction.teamMembership.create).not.toHaveBeenCalled();
    expect(transaction.athleteShareGrant.upsert).not.toHaveBeenCalled();
  });

  it("prevents cross-account withdrawal and revokes sharing on an owned enrollment", async () => {
    transaction.pilotEnrollment.findFirst.mockResolvedValueOnce(null);
    await expect(withdrawPilotEnrollment({ userId: "attacker", enrollmentId: "enrollment-1" })).resolves.toBeNull();
    expect(transaction.athleteShareGrant.updateMany).not.toHaveBeenCalled();

    transaction.pilotEnrollment.findFirst.mockResolvedValueOnce({ id: "enrollment-1", userId: "athlete-1", teamId: "team-1" });
    transaction.pilotEnrollment.update.mockResolvedValueOnce({ id: "enrollment-1", status: "WITHDRAWN", withdrawnAt: new Date() });
    await expect(withdrawPilotEnrollment({ userId: "athlete-1", enrollmentId: "enrollment-1" })).resolves.toMatchObject({ status: "WITHDRAWN" });
    expect(transaction.athleteShareGrant.updateMany).toHaveBeenCalledWith({
      where: { athleteId: "athlete-1", teamId: "team-1" },
      data: { status: "WITHDRAWN", withdrawnAt: expect.any(Date) }
    });
  });
});
