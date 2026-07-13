import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

const predictionArtifact = JSON.parse(readFileSync(join(process.cwd(), "src/lib/models/100-free-xgboost.json"), "utf8"));
const predictionArtifactHash = createHash("sha256").update(JSON.stringify(predictionArtifact)).digest("hex");

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? "'unsafe-eval'" : "",
  "https://*.clerk.accounts.dev",
  "https://*.clerk.dev",
  "https://va.vercel-scripts.com"
].filter(Boolean).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://api.clerk.com https://*.upstash.io https://vitals.vercel-insights.com",
  `script-src ${scriptSources}`,
  "style-src 'self' 'unsafe-inline'",
  "frame-src https://*.clerk.accounts.dev https://*.clerk.dev",
  "worker-src 'self' blob:",
  process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : ""
].filter(Boolean).join("; ");

const nextConfig: NextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1"],
  env: {
    SWIMSIGHT_100_FREE_ARTIFACT_SHA256: predictionArtifactHash
  },
  images: {
    qualities: [75, 88]
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" }
        ]
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Vary", value: "Cookie, Authorization" }
        ]
      }
    ];
  }
};

export default nextConfig;
