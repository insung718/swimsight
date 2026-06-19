import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { enforceApiRateLimit } from "@/lib/security/rate-limit";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const middleware = clerkEnabled
  ? clerkMiddleware(async (auth, request) => {
      const { userId } = await auth();
      const limited = await enforceApiRateLimit(request, userId);
      return limited ?? NextResponse.next();
    })
  : async function publicMiddleware(request: NextRequest) {
      const limited = await enforceApiRateLimit(request);
      return limited ?? NextResponse.next();
    };

export default middleware;

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|webp|ico|woff2?|ttf|map)).*)"]
};
