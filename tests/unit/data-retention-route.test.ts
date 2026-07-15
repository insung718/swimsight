import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const deleteUser = vi.hoisted(() => vi.fn());
const privacy = vi.hoisted(() => ({
  listPendingIdentityDeletions: vi.fn(),
  markIdentityDeletionAttempt: vi.fn(),
  purgeExpiredDeletionTombstones: vi.fn()
}));
const purgeExpiredProductEvents = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: vi.fn(async () => ({ users: { deleteUser } })) }));
vi.mock("@/lib/services/privacy-service", () => privacy);
vi.mock("@/lib/services/product-analytics-service", () => ({ purgeExpiredProductEvents }));
vi.mock("@/lib/security/logging", () => ({ logServerError: vi.fn() }));

import { GET } from "../../app/api/cron/data-retention/route";

describe("protected data-retention job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purgeExpiredProductEvents.mockResolvedValue({ count: 2 });
    privacy.purgeExpiredDeletionTombstones.mockResolvedValue({ count: 1 });
    privacy.listPendingIdentityDeletions.mockResolvedValue([]);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when the maintenance secret is missing or incorrect", async () => {
    vi.stubEnv("CRON_SECRET", "a-secure-cron-secret-that-is-at-least-32-characters");
    const response = await GET(new Request("https://swimsight.example/api/cron/data-retention", {
      headers: { authorization: "Bearer wrong-secret" }
    }));
    expect(response.status).toBe(401);
    expect(purgeExpiredProductEvents).not.toHaveBeenCalled();
  });

  it("purges bounded retention data and retries pending identity deletion", async () => {
    const secret = "a-secure-cron-secret-that-is-at-least-32-characters";
    vi.stubEnv("CRON_SECRET", secret);
    privacy.listPendingIdentityDeletions.mockResolvedValueOnce([{ clerkId: "clerk-user-1" }]);
    deleteUser.mockResolvedValueOnce(undefined);

    const response = await GET(new Request("https://swimsight.example/api/cron/data-retention", {
      headers: { authorization: `Bearer ${secret}` }
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      purgedProductEvents: 2,
      purgedDeletionTombstones: 1,
      completedIdentityDeletions: 1
    });
    expect(deleteUser).toHaveBeenCalledWith("clerk-user-1");
    expect(privacy.markIdentityDeletionAttempt).toHaveBeenCalledWith("clerk-user-1", true);
  });
});
