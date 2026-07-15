import { NextResponse } from "next/server";
import { ok } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { recordProductEvent } from "@/lib/services/product-analytics-service";
import { productEventMutationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, productEventMutationSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const event = await recordProductEvent({
      userId: account.context.userId,
      eventName: parsed.data.eventName,
      properties: parsed.data.properties,
      sessionId: parsed.data.sessionId,
      minimumIntervalMinutes: parsed.data.eventName === "RETURN_VISIT" ? 1_200 : 5
    });
    return ok({ recorded: Boolean(event) });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PRODUCT_EVENT_")) {
      return NextResponse.json({ error: "That analytics event is not permitted." }, { status: 400 });
    }
    logServerError("Could not record product analytics event", error);
    return NextResponse.json({ error: "Analytics event could not be recorded." }, { status: 503 });
  }
}
