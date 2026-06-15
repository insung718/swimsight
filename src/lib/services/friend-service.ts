import { prisma } from "@/lib/prisma";

export async function listFriendships(userId: string) {
  return prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: userId }, { addresseeId: userId }]
    },
    include: {
      requester: true,
      addressee: true
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function createFriendRequest(input: { requesterId: string; email: string }) {
  const addressee = await prisma.user.findUnique({
    where: { email: input.email }
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
  action: "accept" | "block";
}) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: input.friendshipId }
  });

  if (!friendship || friendship.addresseeId !== input.userId) {
    return null;
  }

  return prisma.friendship.update({
    where: { id: input.friendshipId },
    data: {
      status: input.action === "accept" ? "ACCEPTED" : "BLOCKED"
    }
  });
}
