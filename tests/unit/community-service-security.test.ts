import { beforeEach, describe, expect, it, vi } from "vitest";
import { compareTwoMembers } from "@/lib/services/community-service";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  communityMembership: {
    findFirst: vi.fn()
  },
  friendship: {
    findFirst: vi.fn()
  },
  user: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

const userSwim = {
  id: "swim-user",
  userId: "user_1",
  date: new Date("2026-06-01"),
  event: "FIFTY_FREESTYLE",
  course: "LCM",
  timeSeconds: 25.5,
  meetName: "Meet A",
  source: "MANUAL",
  resultKind: "OFFICIAL",
  notes: null
};

const friendSwim = {
  ...userSwim,
  id: "swim-friend",
  userId: "user_2",
  timeSeconds: 26.1
};

describe("community comparison privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not load private swims without friendship or shared community access", async () => {
    prismaMock.friendship.findFirst.mockResolvedValueOnce(null);
    prismaMock.communityMembership.findFirst.mockResolvedValueOnce(null);

    const result = await compareTwoMembers({ userId: "user_1", friendId: "user_2" });

    expect(result).toBeNull();
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("allows comparison for accepted friends", async () => {
    prismaMock.friendship.findFirst.mockResolvedValueOnce({ id: "friendship_1" });
    prismaMock.communityMembership.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: "user_1", name: "Athlete", imageUrl: null, swims: [userSwim] },
      { id: "user_2", name: "Friend", imageUrl: null, swims: [friendSwim] }
    ]);

    const result = await compareTwoMembers({ userId: "user_1", friendId: "user_2" });

    expect(result?.sharedEvents).toEqual([
      {
        event: "50 Freestyle",
        userBest: 25.5,
        friendBest: 26.1,
        gapSeconds: -0.6
      }
    ]);
  });
});
