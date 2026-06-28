import type { AuthContext } from "@/lib/auth-context";

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isTrustedAdminEmail(email: string) {
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

export function resolveTrustedRole(role: AuthContext["role"], email: string): AuthContext["role"] {
  if (isTrustedAdminEmail(email)) return "ADMIN";
  if (role === "ADMIN") return "ATHLETE";
  return role;
}
