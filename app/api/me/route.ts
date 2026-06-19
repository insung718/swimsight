import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccount } from "@/lib/security/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  const user = await prisma.user.findUnique({
    where: { id: account.context.userId },
    select: { id: true, name: true, email: true, imageUrl: true, role: true, createdAt: true }
  });

  return NextResponse.json({
    user
  });
}
