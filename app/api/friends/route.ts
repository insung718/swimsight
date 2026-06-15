import { NextResponse } from "next/server";
import { badRequest, created, notFound, unauthorized, validationError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { createFriendRequest, listFriendships, updateFriendship } from "@/lib/services/friend-service";
import { friendActionSchema, friendRequestSchema, parseJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();

  if (!context || !hasDatabaseConfig()) {
    return NextResponse.json({
      mode: "demo",
      friendships: []
    });
  }

  return NextResponse.json({
    mode: "account",
    friendships: await listFriendships(context.userId)
  });
}

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before adding friends.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before friend requests can be saved.");
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(friendRequestSchema, body);

  if (!parsed.ok) {
    return validationError(parsed.errors);
  }

  const friendship = await createFriendRequest({
    requesterId: context.userId,
    email: parsed.data.email
  });

  if (!friendship) {
    return notFound("No SwimSight account exists for that email yet.");
  }

  return created({ friendship });
}

export async function PATCH(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before responding to friend requests.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before friend requests can be saved.");
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(friendActionSchema, body);

  if (!parsed.ok) {
    return validationError(parsed.errors);
  }

  const friendship = await updateFriendship({
    userId: context.userId,
    ...parsed.data
  });

  if (!friendship) {
    return notFound("Friend request was not found.");
  }

  return NextResponse.json({ friendship });
}
