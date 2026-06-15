import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();

  if (!context || !hasDatabaseConfig()) {
    return NextResponse.json({
      mode: "demo",
      user: {
        id: "demo-athlete",
        name: "Demo Athlete",
        email: "demo@swimsight.app"
      }
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: context.userId }
  });

  return NextResponse.json({
    mode: "account",
    user
  });
}
