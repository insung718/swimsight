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
  const friendship = await prisma.friendship.findUnique({
    where: { id: input.friendshipId }
  });

  if (!friendship) {
    return null;
  }

  const isParticipant = friendship.requesterId === input.userId || friendship.addresseeId === input.userId;

  if (input.action === "remove") {
    if (!isParticipant) return null;
    await prisma.friendship.delete({ where: { id: input.friendshipId } });
    return { ...friendship, status: "BLOCKED" as const };
  }

  if (input.action === "accept" && (friendship.addresseeId !== input.userId || friendship.status !== "PENDING")) return null;
  if (input.action === "block" && !isParticipant) return null;

  return prisma.friendship.update({
    where: { id: input.friendshipId },
    data: {
      status: input.action === "accept" ? "ACCEPTED" : "BLOCKED"
    }
  });
}
