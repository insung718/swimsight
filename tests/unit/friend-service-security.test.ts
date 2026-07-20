import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateFriendship } from "@/lib/services/friend-service";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  friendship: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn()
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
    prismaMock.friendship.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await updateFriendship({
      userId: "user_2",
      friendshipId: "friendship_1",
      action: "accept"
    });

    expect(result).toBeNull();
    expect(prismaMock.friendship.updateMany).toHaveBeenCalledWith({
      where: { id: "friendship_1", addresseeId: "user_2", status: "PENDING" },
      data: { status: "ACCEPTED" }
    });
    expect(prismaMock.friendship.findUnique).not.toHaveBeenCalled();
  });

  it("uses participant-scoped atomic predicates for blocks and removals", async () => {
    prismaMock.friendship.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(updateFriendship({
      userId: "outsider",
      friendshipId: "friendship_1",
      action: "block"
    })).resolves.toBeNull();
    expect(prismaMock.friendship.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "friendship_1",
        OR: [{ requesterId: "outsider" }, { addresseeId: "outsider" }]
      })
    }));

    prismaMock.friendship.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(updateFriendship({
      userId: "outsider",
      friendshipId: "friendship_1",
      action: "remove"
    })).resolves.toBeNull();
    expect(prismaMock.friendship.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "friendship_1",
        OR: [{ requesterId: "outsider" }, { addresseeId: "outsider" }]
      }
    });
  });
});
