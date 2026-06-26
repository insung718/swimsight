import { NextResponse } from "next/server";
import { created, notFound, ok } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createFriendRequest, listFriendships, updateFriendship } from "@/lib/services/friend-service";
import { friendActionSchema, friendRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return NextResponse.json({ friendships: await listFriendships(account.context.userId) });
  } catch (error) {
    logServerError("Could not load friendships", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, friendRequestSchema);
  if (!parsed.ok) return parsed.response;

  let friendship;
  try {
    friendship = await createFriendRequest({
      requesterId: account.context.userId,
      email: parsed.data.email
    });
  } catch (error) {
    logServerError("Could not create friend request", error);
    return databaseUnavailable();
  }

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

  let friendship;
  try {
    friendship = await updateFriendship({
      userId: account.context.userId,
      ...parsed.data
    });
  } catch (error) {
    logServerError("Could not update friendship", error);
    return databaseUnavailable();
  }

  if (!friendship) {
    return notFound("Friend request was not found.");
  }

  return NextResponse.json({ friendship });
}
