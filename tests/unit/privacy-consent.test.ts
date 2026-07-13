import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const transaction = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn()
  },
  consentEvent: {
    create: vi.fn()
  }
}));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  user: {
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  CONSENT_POLICY_VERSIONS,
  changeConsent,
  consentState,
  getConsentedTrainingRows,
  pseudonymizeTrainingIdentifier,
  suppressSmallCohort
} from "@/lib/services/privacy-service";

const emptyConsent = {
  age: 16,
  personalAnalyticsConsentVersion: null,
  personalAnalyticsConsentedAt: null,
  personalAnalyticsWithdrawnAt: null,
  trainingConsentVersion: null,
  trainingConsentedAt: null,
  trainingConsentWithdrawnAt: null,
  researchConsentVersion: null,
  researchConsentedAt: null,
  researchConsentWithdrawnAt: null,
  guardianConsentVersion: null,
  guardianConsentedAt: null,
  guardianConsentWithdrawnAt: null,
  trainingDataExcludedAt: null
};

describe("privacy and consent foundations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires guardian consent before a minor joins model training", async () => {
    transaction.user.findUniqueOrThrow.mockResolvedValueOnce(emptyConsent);
    await expect(changeConsent({
      userId: "minor-1",
      purpose: "MODEL_TRAINING",
      action: "GRANTED",
      policyVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING
    })).rejects.toThrow("GUARDIAN_CONSENT_REQUIRED");
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.consentEvent.create).not.toHaveBeenCalled();
  });

  it("does not allow a minor account to self-certify guardian consent", async () => {
    await expect(changeConsent({
      userId: "minor-1",
      purpose: "GUARDIAN",
      action: "GRANTED",
      policyVersion: CONSENT_POLICY_VERSIONS.GUARDIAN
    })).rejects.toThrow("GUARDIAN_VERIFICATION_REQUIRED");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("records withdrawal and future training exclusion without removing personal analytics", async () => {
    const now = new Date("2026-07-01T00:00:00.000Z");
    transaction.user.findUniqueOrThrow.mockResolvedValueOnce({
      ...emptyConsent,
      trainingConsentVersion: "training-v1",
      trainingConsentedAt: now,
      guardianConsentVersion: "guardian-v1",
      guardianConsentedAt: now
    });
    transaction.user.update.mockResolvedValueOnce({
      ...emptyConsent,
      trainingConsentVersion: "training-v1",
      trainingConsentedAt: now,
      trainingConsentWithdrawnAt: new Date("2026-07-02T00:00:00.000Z"),
      trainingDataExcludedAt: new Date("2026-07-02T00:00:00.000Z")
    });

    const state = await changeConsent({
      userId: "minor-1",
      purpose: "MODEL_TRAINING",
      action: "WITHDRAWN",
      policyVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING
    });
    expect(state.modelTraining.active).toBe(false);
    expect(transaction.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "minor-1" },
      data: expect.objectContaining({ trainingConsentWithdrawnAt: expect.any(Date), trainingDataExcludedAt: expect.any(Date) })
    }));
    expect(transaction.consentEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "WITHDRAWN" }) }));
  });

  it("filters revoked consent at the training extraction query", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([]);
    await expect(getConsentedTrainingRows()).resolves.toEqual([]);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ trainingConsentWithdrawnAt: null, trainingDataExcludedAt: null })
    }));
  });

  it("excludes provisional low-quality event history from training rows", async () => {
    process.env.TRAINING_PSEUDONYM_SECRET = "a-secure-test-secret-that-is-at-least-32-characters";
    prismaMock.user.findMany.mockResolvedValueOnce([{
      id: "user-1",
      age: 16,
      sex: "FEMALE",
      taperDays: null,
      swimSessionsPerWeek: null,
      swims: [{
        id: "result-1",
        date: new Date("2020-01-01T00:00:00.000Z"),
        event: "ONE_HUNDRED_FREESTYLE",
        course: "LCM",
        timeSeconds: 62,
        meetName: "Meet",
        source: "MANUAL",
        resultKind: "OFFICIAL",
        raceType: "INDIVIDUAL",
        createdAt: new Date()
      }]
    }]);
    const rows = await getConsentedTrainingRows();
    expect(rows[0].results).toEqual([]);
    expect(rows[0].qualityAssessments[0].decision).toBe("PROVISIONAL_ONLY");
  });

  it("uses a keyed pseudonym and suppresses small public cohorts", () => {
    process.env.TRAINING_PSEUDONYM_SECRET = "a-secure-test-secret-that-is-at-least-32-characters";
    const pseudonym = pseudonymizeTrainingIdentifier("user-123");
    expect(pseudonym).toHaveLength(64);
    expect(pseudonym).not.toContain("user-123");
    expect(suppressSmallCohort(4, { average: 1.2 })).toMatchObject({ suppressed: true, value: null });
  });

  it("reports each purpose independently", () => {
    const state = consentState({ ...emptyConsent, personalAnalyticsConsentVersion: "analytics-v1", personalAnalyticsConsentedAt: new Date() });
    expect(state.personalAnalytics.active).toBe(true);
    expect(state.modelTraining.active).toBe(false);
    expect(state.publicResearch.active).toBe(false);
  });

  it("does not treat consent to an obsolete analytics policy as active", () => {
    const state = consentState({
      ...emptyConsent,
      personalAnalyticsConsentVersion: "analytics-v0",
      personalAnalyticsConsentedAt: new Date()
    });
    expect(state.personalAnalytics.active).toBe(false);
  });
});
