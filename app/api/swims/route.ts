import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createSwim, getSwimsForUser } from "@/lib/services/swim-service";
import { manualSwimSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  return NextResponse.json({ swims: await getSwimsForUser(account.context.userId) });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, manualSwimSchema);
  if (!parsed.ok) return parsed.response;

  const swim = await createSwim({
    userId: account.context.userId,
    ...parsed.data,
    source: "MANUAL"
  });

  return created({ swim });
}
