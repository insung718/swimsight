import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { enforceApiRateLimit } from "@/lib/security/rate-limit";
import { isMiddlewareBypassAttempt } from "@/lib/security/request";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const middleware = clerkEnabled
  ? clerkMiddleware(async (auth, request) => {
      if (isMiddlewareBypassAttempt(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      const { userId } = await auth();
      const limited = await enforceApiRateLimit(request, userId);
      return limited ?? NextResponse.next();
    })
  : async function publicMiddleware(request: NextRequest) {
      if (isMiddlewareBypassAttempt(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      const limited = await enforceApiRateLimit(request);
      return limited ?? NextResponse.next();
    };

export default middleware;

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|webp|ico|woff2?|ttf|map)).*)"]
};
