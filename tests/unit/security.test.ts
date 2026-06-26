import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { manualSwimSchema } from "@/lib/validation";
import { validateSwimCsv } from "@/lib/csv";
import { enforceApiRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import nextConfig from "../../next.config";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("API security", () => {
  it("rejects unexpected JSON fields", () => {
    const parsed = manualSwimSchema.safeParse({
      date: "2026-06-19",
      event: "50 Freestyle",
      course: "LCM",
      timeSeconds: 25.56,
      meetName: "City Meet",
      isAdmin: true
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects oversized JSON before parsing", async () => {
    const request = new Request("http://localhost/api/swims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(40_000) })
    });
    const parsed = await parseSecureJson(request, manualSwimSchema);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.response.status).toBe(413);
  });

  it("rejects malformed JSON and cross-origin writes", async () => {
    const malformed = await parseSecureJson(
      new Request("http://localhost/api/swims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      }),
      manualSwimSchema
    );
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.response.status).toBe(400);

    const blocked = enforceSameOrigin(new Request("https://swimsight.vercel.app/api/swims", {
      method: "POST",
      headers: { origin: "https://attacker.example" }
    }));
    expect(blocked?.status).toBe(403);
  });

  it("bounds CSV rows and rejects unknown headers", () => {
    const rows = Array.from({ length: 501 }, () => "2026-06-19,50 Free,25.56").join("\n");
    expect(validateSwimCsv(`Date,Event,Time\n${rows}`).errors[0].message).toContain("500");
    expect(validateSwimCsv("Date,Event,Time,Role\n2026-06-19,50 Free,25.56,admin").errors[0].message).toContain("unsupported");
  });

  it("returns a graceful 429 when the IP write quota is exceeded", async () => {
    const request = new NextRequest("http://localhost/api/swims", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.77" }
    });
    let response: Response | null = null;
    for (let index = 0; index < 31; index += 1) response = await enforceApiRateLimit(request);

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBeTruthy();
  });

  it("keeps production server errors sanitized in logs", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sensitiveError = new Error("database password leaked in stack");

    logServerError("Could not load profile", sensitiveError);

    expect(spy).toHaveBeenCalledWith("Could not load profile");
    expect(spy).not.toHaveBeenCalledWith("Could not load profile", sensitiveError);
  });

  it("ships strict browser and API cache security headers", async () => {
    const headers = await nextConfig.headers?.();
    const appHeaders = new Map(headers?.[0]?.headers.map((header) => [header.key.toLowerCase(), header.value]));
    const apiHeaders = new Map(headers?.[1]?.headers.map((header) => [header.key.toLowerCase(), header.value]));

    expect(appHeaders.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(appHeaders.get("strict-transport-security")).toContain("includeSubDomains");
    expect(appHeaders.get("x-content-type-options")).toBe("nosniff");
    expect(apiHeaders.get("cache-control")).toContain("no-store");
    expect(apiHeaders.get("vary")).toContain("Authorization");
  });
});
