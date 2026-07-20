import "server-only";
import { prisma } from "@/lib/prisma";

export async function listFriendships(userId: string) {
  return prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }]
    },
    include: {
      requester: { select: { id: true, name: true, imageUrl: true } },
      addressee: { select: { id: true, name: true, imageUrl: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
}

export async function createFriendRequest(input: { requesterId: string; email: string }) {
  const addressee = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true }
  });

  if (!addressee || addressee.id === input.requesterId) {
    return null;
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: input.requesterId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: input.requesterId }
      ]
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.friendship.create({
    data: {
      requesterId: input.requesterId,
      addresseeId: addressee.id
    }
  });
}

export async function updateFriendship(input: {
  userId: string;
  friendshipId: string;
  action: "accept" | "block" | "remove";
}) {
  if (input.action === "remove") {
    const deleted = await prisma.friendship.deleteMany({
      where: {
        id: input.friendshipId,
        OR: [{ requesterId: input.userId }, { addresseeId: input.userId }]
      }
    });
    return deleted.count === 1 ? { id: input.friendshipId, status: "BLOCKED" as const } : null;
  }

  const updated = await prisma.friendship.updateMany({
    where: input.action === "accept"
      ? { id: input.friendshipId, addresseeId: input.userId, status: "PENDING" }
      : {
          id: input.friendshipId,
          OR: [{ requesterId: input.userId }, { addresseeId: input.userId }]
        },
    data: {
      status: input.action === "accept" ? "ACCEPTED" : "BLOCKED"
    }
  });
  if (updated.count !== 1) return null;

  return prisma.friendship.findUnique({ where: { id: input.friendshipId } });
}
