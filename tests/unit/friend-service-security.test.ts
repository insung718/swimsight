import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateFriendship } from "@/lib/services/friend-service";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  friendship: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

describe("friend service security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not allow blocked relationships to be accepted later", async () => {
    prismaMock.friendship.findUnique.mockResolvedValueOnce({
      id: "friendship_1",
      requesterId: "user_1",
      addresseeId: "user_2",
      status: "BLOCKED",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await updateFriendship({
      userId: "user_2",
      friendshipId: "friendship_1",
      action: "accept"
    });

    expect(result).toBeNull();
    expect(prismaMock.friendship.update).not.toHaveBeenCalled();
  });
});
