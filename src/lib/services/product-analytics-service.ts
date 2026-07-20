import "server-only";
import type { Prisma } from "@prisma/client";
import { CONSENT_POLICY_VERSIONS } from "@/lib/consent-policy";
import { prisma } from "@/lib/prisma";

export const PRODUCT_ANALYTICS_RETENTION_DAYS = 90;

export const productEventNames = [
  "ONBOARDING_COMPLETED",
  "IMPORT_PREVIEWED",
  "IMPORT_COMPLETED",
  "FIRST_INSIGHT",
  "PREDICTION_ELIGIBLE",
  "PREDICTION_VIEWED",
  "RETURN_VISIT",
  "POST_MEET_MATCHED",
  "FEEDBACK_COMPLETED",
  "CONSENT_CHANGED",
  "PILOT_ENROLLED",
  "PILOT_WITHDRAWN"
] as const;

export type ProductEventName = (typeof productEventNames)[number];
type ProductProperty = string | number | boolean | null;
type ProductProperties = Record<string, ProductProperty>;
type DatabaseClient = Prisma.TransactionClient | typeof prisma;

const allowedProperties: Record<ProductEventName, ReadonlySet<string>> = {
  ONBOARDING_COMPLETED: new Set(["role", "entryMethod", "elapsedSecondsBucket"]),
  IMPORT_PREVIEWED: new Set(["adapter", "rowCountBucket", "validCountBucket", "hasReviewRows"]),
  IMPORT_COMPLETED: new Set(["adapter", "rowCountBucket", "validCountBucket", "partial", "firstImport"]),
  FIRST_INSIGHT: new Set(["insightType", "elapsedSecondsBucket"]),
  PREDICTION_ELIGIBLE: new Set(["eligible", "eventGroupCountBucket"]),
  PREDICTION_VIEWED: new Set(["course", "horizonBand", "modelSource", "hasExplanation"]),
  RETURN_VISIT: new Set(["dayBand"]),
  POST_MEET_MATCHED: new Set(["course", "targetType", "modelSource", "withinInterval"]),
  FEEDBACK_COMPLETED: new Set(["predictionUsefulAnswered"]),
  CONSENT_CHANGED: new Set(["purpose", "action"]),
  PILOT_ENROLLED: new Set(["audience", "clubLinked"]),
  PILOT_WITHDRAWN: new Set(["clubLinked"])
};

function activePersonalAnalytics(user: {
  personalAnalyticsConsentVersion: string | null;
  personalAnalyticsConsentedAt: Date | null;
  personalAnalyticsWithdrawnAt: Date | null;
}) {
  return Boolean(user.personalAnalyticsConsentedAt
    && user.personalAnalyticsConsentVersion === CONSENT_POLICY_VERSIONS.PERSONAL_ANALYTICS
    && (!user.personalAnalyticsWithdrawnAt || user.personalAnalyticsConsentedAt > user.personalAnalyticsWithdrawnAt));
}

function returnVisitBand(createdAt: Date, now: Date) {
  const days = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
  if (days < 7) return "under-7d";
  if (days < 30) return "7-29d";
  return "30d+";
}

function safeProperties(eventName: ProductEventName, properties: ProductProperties) {
  const entries = Object.entries(properties);
  if (entries.length > 12) throw new Error("PRODUCT_EVENT_TOO_MANY_PROPERTIES");
  const allowed = allowedProperties[eventName];
  const output: ProductProperties = {};
  for (const [key, value] of entries) {
    if (!allowed.has(key)) throw new Error("PRODUCT_EVENT_PROPERTY_NOT_ALLOWED");
    if (!/^[a-z][a-zA-Z0-9]{0,39}$/.test(key)) throw new Error("PRODUCT_EVENT_PROPERTY_INVALID");
    if (typeof value === "string" && value.length > 80) throw new Error("PRODUCT_EVENT_VALUE_TOO_LONG");
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("PRODUCT_EVENT_VALUE_INVALID");
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) throw new Error("PRODUCT_EVENT_VALUE_INVALID");
    output[key] = value;
  }
  return output as Prisma.InputJsonValue;
}

export async function recordProductEvent(input: {
  userId: string;
  eventName: ProductEventName;
  properties?: ProductProperties;
  sessionId?: string;
  client?: DatabaseClient;
  consentKnownActive?: boolean;
  minimumIntervalMinutes?: number;
}) {
  const client = input.client ?? prisma;
  let eventProperties = { ...(input.properties ?? {}) };
  if (!input.consentKnownActive) {
    const user = await client.user.findUnique({
      where: { id: input.userId },
      select: {
        createdAt: true,
        personalAnalyticsConsentVersion: true,
        personalAnalyticsConsentedAt: true,
        personalAnalyticsWithdrawnAt: true
      }
    });
    if (!user || !activePersonalAnalytics(user)) return null;
    if (input.eventName === "RETURN_VISIT") {
      eventProperties = { dayBand: returnVisitBand(user.createdAt, new Date()) };
    }
  }
  if (input.minimumIntervalMinutes && input.minimumIntervalMinutes > 0) {
    const since = new Date(Date.now() - input.minimumIntervalMinutes * 60_000);
    const existing = await client.productAnalyticsEvent.findFirst({
      where: { userId: input.userId, eventName: input.eventName, occurredAt: { gte: since } },
      select: { id: true }
    });
    if (existing) return null;
  }
  const occurredAt = new Date();
  const expiresAt = new Date(occurredAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + PRODUCT_ANALYTICS_RETENTION_DAYS);
  return client.productAnalyticsEvent.create({
    data: {
      userId: input.userId,
      eventName: input.eventName,
      sessionId: input.sessionId,
      properties: safeProperties(input.eventName, eventProperties),
      occurredAt,
      expiresAt
    }
  });
}

export async function markFirstInsight(
  client: Prisma.TransactionClient,
  userId: string,
  insightType: "MANUAL_RESULT" | "IMPORT"
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      firstInsightAt: true,
      onboardingStartedAt: true,
      personalAnalyticsConsentVersion: true,
      personalAnalyticsConsentedAt: true,
      personalAnalyticsWithdrawnAt: true
    }
  });
  if (!user || user.firstInsightAt) return false;
  const now = new Date();
  const claimed = await client.user.updateMany({
    where: { id: userId, firstInsightAt: null },
    data: { firstInsightAt: now }
  });
  if (claimed.count !== 1) return false;
  if (activePersonalAnalytics(user)) {
    const elapsedSeconds = user.onboardingStartedAt
      ? Math.max(0, Math.round((now.getTime() - user.onboardingStartedAt.getTime()) / 1_000))
      : 0;
    await recordProductEvent({
      client,
      consentKnownActive: true,
      userId,
      eventName: "FIRST_INSIGHT",
      properties: { insightType, elapsedSecondsBucket: elapsedSecondsBucket(elapsedSeconds) }
    });
  }
  return true;
}

export async function purgeExpiredProductEvents(now = new Date()) {
  return prisma.productAnalyticsEvent.deleteMany({ where: { expiresAt: { lte: now } } });
}

export function countBucket(value: number) {
  if (value <= 0) return "0";
  if (value <= 5) return "1-5";
  if (value <= 20) return "6-20";
  if (value <= 100) return "21-100";
  if (value <= 500) return "101-500";
  return "501+";
}

export function elapsedSecondsBucket(value: number) {
  if (value < 60) return "under-1m";
  if (value < 180) return "1-3m";
  if (value < 600) return "3-10m";
  return "10m+";
}
