import { rankEvents } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { fromPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import type { CommunityMember, CommunitySummary, FriendComparison, SwimEvent } from "@/types/swim";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function createJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function communitySummary(community: {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  joinCode: string;
  memberships?: unknown[];
}): CommunitySummary {
  return {
    id: community.id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    joinCode: community.joinCode,
    memberCount: community.memberships?.length ?? 0
  };
}

export async function createCommunity(input: {
  ownerId: string;
  name: string;
  description?: string;
}) {
  const baseSlug = slugify(input.name);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
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
    include: { memberships: true }
  });

  return communitySummary(community);
}

export async function listCommunitiesForUser(userId: string) {
  const memberships = await prisma.communityMembership.findMany({
    where: { userId },
    include: {
      community: {
        include: {
          memberships: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return memberships.map((membership) => communitySummary(membership.community));
}

export async function joinCommunity(input: { userId: string; joinCode: string }) {
  const community = await prisma.community.findUnique({
    where: { joinCode: input.joinCode.toUpperCase() },
    include: { memberships: true }
  });

  if (!community) {
    return null;
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
    include: { memberships: true }
  });

  return communitySummary(updated);
}

function memberAnalytics(member: {
  user: {
    id: string;
    name: string;
    imageUrl?: string | null;
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
  const rankings = swims.length ? rankEvents(swims) : [];
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
      memberships: {
        include: {
          user: {
            include: {
              swims: {
                orderBy: { date: "asc" }
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
    community: communitySummary(community),
    members: community.memberships.map(memberAnalytics)
  };
}

export async function compareTwoMembers(input: {
  userId: string;
  friendId: string;
}): Promise<FriendComparison | null> {
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [input.userId, input.friendId]
      }
    },
    include: {
      swims: {
        orderBy: { date: "asc" }
      }
    }
  });
  const user = users.find((record) => record.id === input.userId);
  const friend = users.find((record) => record.id === input.friendId);

  if (!user || !friend) {
    return null;
  }

  const bestByEvent = (swims: typeof user.swims) => {
    return swims.reduce<Map<SwimEvent, number>>((bestTimes, swim) => {
      const event = fromPrismaEvent(swim.event);
      const existing = bestTimes.get(event);
      if (!existing || swim.timeSeconds < existing) {
        bestTimes.set(event, swim.timeSeconds);
      }
      return bestTimes;
    }, new Map());
  };
  const userBest = bestByEvent(user.swims);
  const friendBest = bestByEvent(friend.swims);
  const sharedEvents = Array.from(userBest.keys())
    .filter((event) => friendBest.has(event))
    .map((event) => {
      const userTime = userBest.get(event) ?? 0;
      const friendTime = friendBest.get(event) ?? 0;
      return {
        event,
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
