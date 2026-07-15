import { createHash, createHmac } from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value instanceof Date ? value.toISOString() : value;
}

export function stableJson(value: unknown) {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function operationalPseudonym(namespace: string, identifier?: string | null) {
  if (!identifier) return null;
  const secret = process.env.AUDIT_PSEUDONYM_SECRET ?? process.env.TRAINING_PSEUDONYM_SECRET;
  return secret && secret.length >= 32
    ? hmacSha256(secret, `${namespace}|${identifier}`)
    : sha256(`swimsight-operational-pseudonym-v1|${namespace}|${identifier}`);
}
