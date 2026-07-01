import { cookies } from "next/headers";
import { ok } from "@/lib/api";
import { dashboardViewModeCookie } from "@/lib/dashboard-view-mode";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { dashboardViewModeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  const parsed = await parseSecureJson(request, dashboardViewModeSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const cookieStore = await cookies();
    cookieStore.set(dashboardViewModeCookie, parsed.data.viewMode, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return ok({ viewMode: parsed.data.viewMode });
  } catch (error) {
    logServerError("Could not switch dashboard view", error);
    return databaseUnavailable();
  }
}
