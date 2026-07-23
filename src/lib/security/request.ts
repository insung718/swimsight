import { NextResponse } from "next/server";
import type { z } from "zod";

const DEFAULT_MAX_BODY_BYTES = 32_768;

async function readBoundedBody(request: Request, maxBytes: number) {
  if (!request.body) return { ok: true as const, raw: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    let finished = false;
    while (!finished) {
      const { done, value } = await reader.read();
      finished = done;
      if (finished || !value) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false as const };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true as const, raw: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: true as const, raw: "" };
  }
}

function addAllowedOrigin(allowed: Set<string>, value?: string) {
  if (!value) return;

  try {
    const candidate = new URL(value.includes("://") ? value : `https://${value}`);
    if (candidate.protocol === "http:" || candidate.protocol === "https:") {
      allowed.add(candidate.origin);
    }
  } catch {
    // Ignore malformed deployment configuration instead of trusting it.
  }
}

export async function parseSecureJson<T>(request: Request, schema: z.ZodType<T>, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false as const, response: NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 }) };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    return { ok: false as const, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }

  const bodyRead = await readBoundedBody(request, maxBytes);
  if (!bodyRead.ok) {
    return { ok: false as const, response: NextResponse.json({ error: "Request body is too large." }, { status: 413 }) };
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyRead.raw);
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json({
        error: "Validation failed.",
        details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      }, { status: 400 })
    };
  }

  return { ok: true as const, data: parsed.data };
}

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "Origin header is required." }, { status: 403 });

  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([requestOrigin]);
  addAllowedOrigin(allowed, process.env.NEXT_PUBLIC_APP_URL);
  addAllowedOrigin(allowed, process.env.VERCEL_URL);

  return allowed.has(origin)
    ? null
    : NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
}

export function isMiddlewareBypassAttempt(request: Pick<Request, "headers">) {
  return request.headers.has("x-middleware-subrequest");
}
