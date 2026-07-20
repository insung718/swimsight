import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { rankEvents } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { fromPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import { CannotJoinOwnedGroupError } from "@/lib/services/join-errors";
import type { CommunityMember, CommunitySummary, Course, FriendComparison, SwimEvent } from "@/types/swim";

const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function createJoinCode() {
  return Array.from(randomBytes(8), (byte) => joinCodeAlphabet[byte % joinCodeAlphabet.length]).join("");
}

function communitySummary(community: {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  joinCode: string;
  memberships?: unknown[];
  _count?: { memberships: number };
}): CommunitySummary {
  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    joinCode: community.joinCode,
    memberCount: community._count?.memberships ?? community.memberships?.length ?? 0
  };
}

export async function createCommunity(input: {
  ownerId: string;
  name: string;
  description?: string;
}) {
  const baseSlug = slugify(input.name);
  const slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  const community = await prisma.community.create({
    data: {
      ownerId: input.ownerId,
      name: input.name,
      slug,
      description: input.description,
      joinCode: createJoinCode(),
      memberships: {
        create: {
          userId: input.ownerId,
          role: "OWNER"
        }
      }
    },
    include: { _count: { select: { memberships: true } } }
  });

  return communitySummary(community);
}

export async function listCommunitiesForUser(userId: string) {
  const memberships = await prisma.communityMembership.findMany({
    where: { userId },
    include: {
      community: {
        include: {
          _count: { select: { memberships: true } }
        }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return memberships.map((membership) => ({
    ...communitySummary(membership.community),
    joinCode: membership.role === "OWNER" ? membership.community.joinCode : ""
  }));
}

export async function joinCommunity(input: { userId: string; joinCode: string }) {
  const community = await prisma.community.findFirst({
    where: {
      joinCode: {
        equals: input.joinCode,
        mode: "insensitive"
      }
    },
    include: {
      memberships: {
        where: { userId: input.userId },
        select: { role: true },
        take: 1
      }
    }
  });

  if (!community) {
    return null;
  }
  const currentMembership = community.memberships[0];
  if (community.ownerId === input.userId || currentMembership?.role === "OWNER") {
    throw new CannotJoinOwnedGroupError("community");
  }

  await prisma.communityMembership.upsert({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: input.userId
      }
    },
    update: {},
    create: {
      communityId: community.id,
      userId: input.userId
    }
  });

  const updated = await prisma.community.findUniqueOrThrow({
    where: { id: community.id },
    include: { _count: { select: { memberships: true } } }
  });

  return { ...communitySummary(updated), joinCode: "" };
}

function memberAnalytics(member: {
  user: {
    id: string;
    name: string;
    imageUrl?: string | null;
    age?: number | null;
    swims: Array<{
      id: string;
      userId: string;
      date: Date;
      event: string;
      course: string;
      timeSeconds: number;
      meetName: string;
      source?: string;
      notes?: string | null;
    }>;
  };
  role: string;
  createdAt: Date;
}): CommunityMember {
  const swims = member.user.swims.map(toSwimResult);
  const rankings = swims.length ? rankEvents(swims, member.user.age) : [];
  const averageScore = rankings.length
    ? rankings.reduce((sum, ranking) => sum + ranking.score, 0) / rankings.length
    : 0;

  return {
    id: member.user.id,
    name: member.user.name,
    imageUrl: member.user.imageUrl,
    role: member.role as CommunityMember["role"],
    joinedAt: member.createdAt.toISOString(),
    analytics: {
      totalSwims: swims.length,
      strongestEvent: rankings[0]?.event,
      swimPowerIndex: Math.round(averageScore),
      yearlyImprovement: rankings[0]?.improvementPercent ?? 0
    }
  };
}

export async function getCommunityComparison(communityId: string, userId: string) {
  const membership = await prisma.communityMembership.findUnique({
    where: {
      communityId_userId: {
        communityId,
        userId
      }
    }
  });

  if (!membership) {
    return null;
  }

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: {
      _count: { select: { memberships: true } },
      memberships: {
        take: 200,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              age: true,
              swims: {
                where: { resultKind: "OFFICIAL", raceType: "INDIVIDUAL" },
                orderBy: [{ date: "asc" }, { createdAt: "asc" }],
                take: 2_000
              }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!community) {
    return null;
  }

  return {
    community: {
      ...communitySummary(community),
      joinCode: community.ownerId === userId ? community.joinCode : ""
    },
    members: community.memberships.map(memberAnalytics)
  };
}

export async function compareTwoMembers(input: {
  userId: string;
  friendId: string;
}): Promise<FriendComparison | null> {
  if (input.userId === input.friendId) {
    return null;
  }

  const [acceptedFriendship, sharedCommunity] = await Promise.all([
    prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: input.userId, addresseeId: input.friendId },
          { requesterId: input.friendId, addresseeId: input.userId }
        ]
      },
      select: { id: true }
    }),
    prisma.communityMembership.findFirst({
      where: {
        userId: input.userId,
        community: {
          memberships: {
            some: {
              userId: input.friendId
            }
          }
        }
      },
      select: { id: true }
    })
  ]);

  if (!acceptedFriendship && !sharedCommunity) {
    return null;
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [input.userId, input.friendId]
      }
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      age: true,
      swims: {
        where: { resultKind: "OFFICIAL", raceType: "INDIVIDUAL" },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        take: 2_000
      }
    }
  });
  const user = users.find((record) => record.id === input.userId);
  const friend = users.find((record) => record.id === input.friendId);

  if (!user || !friend) {
    return null;
  }

  const bestByEventCourse = (swims: typeof user.swims) => {
    return swims.reduce<Map<string, { event: SwimEvent; course: Course; timeSeconds: number }>>((bestTimes, swim) => {
      const event = fromPrismaEvent(swim.event);
      const course = swim.course as Course;
      const key = `${event}__${course}`;
      const existing = bestTimes.get(key);
      if (!existing || swim.timeSeconds < existing.timeSeconds) {
        bestTimes.set(key, { event, course, timeSeconds: swim.timeSeconds });
      }
      return bestTimes;
    }, new Map());
  };
  const userBest = bestByEventCourse(user.swims);
  const friendBest = bestByEventCourse(friend.swims);
  const sharedEvents = Array.from(userBest.keys())
    .filter((eventCourse) => friendBest.has(eventCourse))
    .map((eventCourse) => {
      const userResult = userBest.get(eventCourse)!;
      const friendResult = friendBest.get(eventCourse)!;
      const userTime = userResult.timeSeconds;
      const friendTime = friendResult.timeSeconds;
      return {
        event: userResult.event,
        course: userResult.course,
        userBest: userTime,
        friendBest: friendTime,
        gapSeconds: Math.round((userTime - friendTime) * 100) / 100
      };
    });

  return {
    user: memberAnalytics({ user, role: "MEMBER", createdAt: new Date() }),
    friend: memberAnalytics({ user: friend, role: "MEMBER", createdAt: new Date() }),
    sharedEvents
  };
}
