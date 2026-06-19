import { NextResponse } from "next/server";
import { created, notFound, ok } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createFriendRequest, listFriendships, updateFriendship } from "@/lib/services/friend-service";
import { friendActionSchema, friendRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  return NextResponse.json({ friendships: await listFriendships(account.context.userId) });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, friendRequestSchema);
  if (!parsed.ok) return parsed.response;

  const friendship = await createFriendRequest({
    requesterId: account.context.userId,
    email: parsed.data.email
  });

  if (!friendship) {
    return ok({ message: "If that account exists, the request has been processed." }, 202);
  }

  return created({ friendship });
}

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, friendActionSchema);
  if (!parsed.ok) return parsed.response;

  const friendship = await updateFriendship({
    userId: account.context.userId,
    ...parsed.data
  });

  if (!friendship) {
    return notFound("Friend request was not found.");
  }

  return NextResponse.json({ friendship });
}
