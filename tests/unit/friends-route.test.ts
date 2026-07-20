import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/friends/route";
import { createFriendRequest, listFriendships } from "@/lib/services/friend-service";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/security/api-auth", () => ({
  databaseUnavailable: () => Response.json({ error: "Database unavailable." }, { status: 503 }),
  requireApiAccount: vi.fn(async () => ({
    ok: true,
    context: { userId: "user_123", role: "ATHLETE", email: "athlete@example.com" }
  }))
}));

vi.mock("@/lib/security/logging", () => ({
  logServerError: vi.fn()
}));

vi.mock("@/lib/security/request", () => ({
  enforceSameOrigin: vi.fn(() => null),
  parseSecureJson: vi.fn(async () => ({
    ok: true,
    data: { email: "target@example.com" }
  }))
}));

vi.mock("@/lib/services/friend-service", () => ({
  createFriendRequest: vi.fn(),
  listFriendships: vi.fn(),
  updateFriendship: vi.fn()
}));

const createFriendRequestMock = vi.mocked(createFriendRequest);
const listFriendshipsMock = vi.mocked(listFriendships);

describe("friend invite route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same generic response when a target account exists or does not exist", async () => {
    createFriendRequestMock.mockResolvedValueOnce({
      id: "friendship_123",
      requesterId: "user_123",
      addresseeId: "user_456",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const existing = await POST(new Request("https://swimsight.vercel.app/api/friends", { method: "POST" }));

    createFriendRequestMock.mockResolvedValueOnce(null);
    const missing = await POST(new Request("https://swimsight.vercel.app/api/friends", { method: "POST" }));

    expect(existing.status).toBe(202);
    expect(missing.status).toBe(202);
    await expect(existing.json()).resolves.toEqual({ message: "If that account exists, the request has been processed." });
    await expect(missing.json()).resolves.toEqual({ message: "If that account exists, the request has been processed." });
  });

  it("returns the current user id so only recipients render pending-request acceptance", async () => {
    listFriendshipsMock.mockResolvedValueOnce([]);
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ currentUserId: "user_123", friendships: [] });
  });
});
