import { timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logServerError } from "@/lib/security/logging";
import { listPendingIdentityDeletions, markIdentityDeletionAttempt, purgeExpiredDeletionTombstones } from "@/lib/services/privacy-service";
import { purgeExpiredProductEvents } from "@/lib/services/product-analytics-service";

export const dynamic = "force-dynamic";

function validCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !supplied?.startsWith("Bearer ")) return false;
  const expectedBytes = Buffer.from(`Bearer ${secret}`);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: Request) {
  if (!validCronAuthorization(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const [eventResult, expiredTombstones, pendingDeletions] = await Promise.all([
      purgeExpiredProductEvents(),
      purgeExpiredDeletionTombstones(),
      listPendingIdentityDeletions()
    ]);
    const clerk = await clerkClient();
    let completedIdentityDeletions = 0;
    for (const pending of pendingDeletions) {
      try {
        await clerk.users.deleteUser(pending.clerkId);
        await markIdentityDeletionAttempt(pending.clerkId, true);
        completedIdentityDeletions += 1;
      } catch (error) {
        const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
        await markIdentityDeletionAttempt(pending.clerkId, status === 404);
        if (status === 404) completedIdentityDeletions += 1;
      }
    }
    return NextResponse.json({
      purgedProductEvents: eventResult.count,
      purgedDeletionTombstones: expiredTombstones.count,
      completedIdentityDeletions
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError("Data-retention job failed", error);
    return NextResponse.json({ error: "Retention job failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
