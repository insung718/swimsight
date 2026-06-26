import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: account.context.userId },
      select: { id: true, name: true, email: true, imageUrl: true, role: true, createdAt: true }
    });
  } catch (error) {
    console.error("Could not load profile", error);
    return databaseUnavailable();
  }

  return NextResponse.json({
    user
  });
}
