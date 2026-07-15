import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireApiAccount = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({ user: { findUniqueOrThrow: vi.fn() } }));
vi.mock("@/lib/security/api-auth", () => ({ requireApiAccount }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/logging", () => ({ logServerError: vi.fn() }));

import { GET } from "../../app/api/me/export/route";

describe("account export authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not query account data for an unauthenticated request", async () => {
    requireApiAccount.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Unauthorized." }, { status: 401 })
    });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(prismaMock.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("exports only the server-derived authenticated account with no-cache headers", async () => {
    requireApiAccount.mockResolvedValueOnce({
      ok: true,
      context: { userId: "user-1", clerkId: "clerk-1", role: "ATHLETE" }
    });
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({ id: "user-1", email: "athlete@example.com" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(prismaMock.user.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    await expect(response.json()).resolves.toMatchObject({ schemaVersion: "swimsight-export-v2", user: { id: "user-1" } });
  });
});
