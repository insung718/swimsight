import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createSwim, getSwimsForUser } from "@/lib/services/swim-service";
import { manualSwimSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return NextResponse.json({ swims: await getSwimsForUser(account.context.userId) });
  } catch (error) {
    console.error("Could not load swims", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, manualSwimSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const swim = await createSwim({
      userId: account.context.userId,
      ...parsed.data,
      source: "MANUAL"
    });

    return created({ swim });
  } catch (error) {
    console.error("Could not create swim", error);
    return databaseUnavailable();
  }
}
