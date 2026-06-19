import { serviceUnavailable, unauthorized } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";

export async function requireApiAccount() {
  const context = await getAuthContext();
  if (!context) return { ok: false as const, response: unauthorized() };
  if (!hasDatabaseConfig()) return { ok: false as const, response: serviceUnavailable("Database is not configured.") };
  return { ok: true as const, context };
}
