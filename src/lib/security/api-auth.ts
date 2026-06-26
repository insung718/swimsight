import { serviceUnavailable, unauthorized } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { logServerError } from "@/lib/security/logging";

export async function requireApiAccount() {
  let context;
  try {
    context = await getAuthContext();
  } catch (error) {
    logServerError("API account bootstrap failed", error);
    return { ok: false as const, response: databaseUnavailable() };
  }
  if (!context) return { ok: false as const, response: unauthorized() };
  if (!hasDatabaseConfig()) return { ok: false as const, response: serviceUnavailable("Database is not configured.") };
  return { ok: true as const, context };
}

export function databaseUnavailable() {
  return serviceUnavailable("Dashboard database is not ready. Please try again after the latest deploy finishes.");
}
