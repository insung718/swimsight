import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  productAnalyticsEvent: { deleteMany: vi.fn() }
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  PRODUCT_ANALYTICS_RETENTION_DAYS,
  purgeExpiredProductEvents,
  recordProductEvent
} from "@/lib/services/product-analytics-service";

function clientWithConsent(active: boolean) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        personalAnalyticsConsentedAt: active ? new Date("2026-01-02T00:00:00.000Z") : null,
        personalAnalyticsWithdrawnAt: null
      })
    },
    productAnalyticsEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "event-1", ...data }))
    }
  };
}

describe("privacy-safe product analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not write any event without active personal analytics consent", async () => {
    const client = clientWithConsent(false);
    await expect(recordProductEvent({
      client: client as never,
      userId: "user-1",
      eventName: "PREDICTION_VIEWED",
      properties: { course: "LCM" }
    })).resolves.toBeNull();
    expect(client.productAnalyticsEvent.create).not.toHaveBeenCalled();
  });

  it("stores only allowlisted categorical metadata with a 90-day expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
    const client = clientWithConsent(true);
    await recordProductEvent({
      client: client as never,
      userId: "user-1",
      eventName: "PREDICTION_VIEWED",
      properties: { course: "LCM", horizonBand: "90d", modelSource: "DETERMINISTIC", hasExplanation: true }
    });
    expect(client.productAnalyticsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        properties: { course: "LCM", horizonBand: "90d", modelSource: "DETERMINISTIC", hasExplanation: true },
        occurredAt: new Date("2026-07-15T00:00:00.000Z"),
        expiresAt: new Date("2026-10-13T00:00:00.000Z")
      })
    });
    expect(PRODUCT_ANALYTICS_RETENTION_DAYS).toBe(90);
  });

  it("rejects PII-shaped and unexpected properties instead of silently retaining them", async () => {
    const client = clientWithConsent(true);
    await expect(recordProductEvent({
      client: client as never,
      userId: "user-1",
      eventName: "PREDICTION_VIEWED",
      properties: { email: "athlete@example.com" }
    })).rejects.toThrow("PRODUCT_EVENT_PROPERTY_NOT_ALLOWED");
    expect(client.productAnalyticsEvent.create).not.toHaveBeenCalled();
  });

  it("deduplicates high-frequency events within the requested interval", async () => {
    const client = clientWithConsent(true);
    client.productAnalyticsEvent.findFirst.mockResolvedValueOnce({ id: "existing" });
    await expect(recordProductEvent({
      client: client as never,
      userId: "user-1",
      eventName: "RETURN_VISIT",
      minimumIntervalMinutes: 60
    })).resolves.toBeNull();
    expect(client.productAnalyticsEvent.create).not.toHaveBeenCalled();
  });

  it("purges events only after their retention timestamp", async () => {
    const now = new Date("2026-07-15T00:00:00.000Z");
    prismaMock.productAnalyticsEvent.deleteMany.mockResolvedValueOnce({ count: 4 });
    await expect(purgeExpiredProductEvents(now)).resolves.toEqual({ count: 4 });
    expect(prismaMock.productAnalyticsEvent.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
  });
});
