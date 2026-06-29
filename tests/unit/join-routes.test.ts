import { beforeEach, describe, expect, it, vi } from "vitest";
import { CannotJoinOwnedGroupError } from "@/lib/services/join-errors";
import { joinCoachClub } from "@/lib/services/coach-service";
import { joinCommunity } from "@/lib/services/community-service";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/security/api-auth", () => ({
  databaseUnavailable: () => Response.json({ error: "Database unavailable." }, { status: 503 }),
  requireApiAccount: vi.fn(async () => ({
    ok: true,
    context: { userId: "user_owner", role: "ATHLETE", email: "owner@example.com" }
  }))
}));

vi.mock("@/lib/security/logging", () => ({
  logServerError: vi.fn()
}));

vi.mock("@/lib/security/request", () => ({
  enforceSameOrigin: vi.fn(() => null),
  parseSecureJson: vi.fn(async () => ({
    ok: true,
    data: { joinCode: "OWNER123" }
  }))
}));

vi.mock("@/lib/services/coach-service", () => ({
  joinCoachClub: vi.fn(),
  listCoachClubsForSwimmer: vi.fn()
}));

vi.mock("@/lib/services/community-service", () => ({
  joinCommunity: vi.fn()
}));

const joinCoachClubMock = vi.mocked(joinCoachClub);
const joinCommunityMock = vi.mocked(joinCommunity);

describe("join routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when a user tries to join a coach club they created", async () => {
    joinCoachClubMock.mockRejectedValueOnce(new CannotJoinOwnedGroupError("coach club"));
    const { POST } = await import("../../app/api/coach/clubs/join/route");
    const response = await POST(new Request("https://swimsight.vercel.app/api/coach/clubs/join", { method: "POST" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "You cannot join a coach club you created." });
  });

  it("returns 409 when a user tries to join a community they created", async () => {
    joinCommunityMock.mockRejectedValueOnce(new CannotJoinOwnedGroupError("community"));
    const { POST } = await import("../../app/api/communities/join/route");
    const response = await POST(new Request("https://swimsight.vercel.app/api/communities/join", { method: "POST" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "You cannot join a community you created." });
  });
});
