import "server-only";
import { createHmac } from "node:crypto";
import type { ConsentAction, ConsentPurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromPrismaEvent } from "@/lib/prisma-mappers";
import { assessPredictionDataQuality } from "@/lib/prediction-governance";
import type { SwimResult } from "@/types/swim";

export const CONSENT_POLICY_VERSIONS: Record<ConsentPurpose, string> = {
  PERSONAL_ANALYTICS: "analytics-v1",
  MODEL_TRAINING: "training-v1",
  PUBLIC_RESEARCH: "research-v1",
  GUARDIAN: "guardian-v1"
};

export const PUBLIC_RESEARCH_MINIMUM_COHORT = 25;

type ConsentUser = {
  age: number | null;
  personalAnalyticsConsentVersion: string | null;
  personalAnalyticsConsentedAt: Date | null;
  personalAnalyticsWithdrawnAt: Date | null;
  trainingConsentVersion: string | null;
  trainingConsentedAt: Date | null;
  trainingConsentWithdrawnAt: Date | null;
  researchConsentVersion: string | null;
  researchConsentedAt: Date | null;
  researchConsentWithdrawnAt: Date | null;
  guardianConsentVersion: string | null;
  guardianConsentedAt: Date | null;
  guardianConsentWithdrawnAt: Date | null;
  trainingDataExcludedAt: Date | null;
};

function active(granted: Date | null, withdrawn: Date | null) {
  return Boolean(granted && (!withdrawn || granted > withdrawn));
}

export function consentState(user: ConsentUser) {
  const guardianRequired = user.age === null || user.age < 18;
  const guardianActive = active(user.guardianConsentedAt, user.guardianConsentWithdrawnAt)
    && user.guardianConsentVersion === CONSENT_POLICY_VERSIONS.GUARDIAN;
  return {
    policyVersions: CONSENT_POLICY_VERSIONS,
    personalAnalytics: {
      active: active(user.personalAnalyticsConsentedAt, user.personalAnalyticsWithdrawnAt)
        && user.personalAnalyticsConsentVersion === CONSENT_POLICY_VERSIONS.PERSONAL_ANALYTICS,
      version: user.personalAnalyticsConsentVersion,
      grantedAt: user.personalAnalyticsConsentedAt,
      withdrawnAt: user.personalAnalyticsWithdrawnAt
    },
    modelTraining: {
      active: active(user.trainingConsentedAt, user.trainingConsentWithdrawnAt)
        && user.trainingConsentVersion === CONSENT_POLICY_VERSIONS.MODEL_TRAINING
        && !user.trainingDataExcludedAt
        && (!guardianRequired || guardianActive),
      version: user.trainingConsentVersion,
      grantedAt: user.trainingConsentedAt,
      withdrawnAt: user.trainingConsentWithdrawnAt,
      excludedAt: user.trainingDataExcludedAt
    },
    publicResearch: {
      active: active(user.researchConsentedAt, user.researchConsentWithdrawnAt)
        && user.researchConsentVersion === CONSENT_POLICY_VERSIONS.PUBLIC_RESEARCH
        && (!guardianRequired || guardianActive),
      version: user.researchConsentVersion,
      grantedAt: user.researchConsentedAt,
      withdrawnAt: user.researchConsentWithdrawnAt
    },
    guardian: {
      required: guardianRequired,
      active: guardianActive,
      version: user.guardianConsentVersion,
      grantedAt: user.guardianConsentedAt,
      withdrawnAt: user.guardianConsentWithdrawnAt
    }
  };
}

const consentSelect = {
  age: true,
  personalAnalyticsConsentVersion: true,
  personalAnalyticsConsentedAt: true,
  personalAnalyticsWithdrawnAt: true,
  trainingConsentVersion: true,
  trainingConsentedAt: true,
  trainingConsentWithdrawnAt: true,
  researchConsentVersion: true,
  researchConsentedAt: true,
  researchConsentWithdrawnAt: true,
  guardianConsentVersion: true,
  guardianConsentedAt: true,
  guardianConsentWithdrawnAt: true,
  trainingDataExcludedAt: true
} satisfies Prisma.UserSelect;

export async function getConsentState(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: consentSelect });
  return consentState(user);
}

function updateForConsent(purpose: ConsentPurpose, action: ConsentAction, policyVersion: string, now: Date): Prisma.UserUpdateInput {
  const granted = action === "GRANTED";
  switch (purpose) {
    case "PERSONAL_ANALYTICS":
      return granted
        ? { personalAnalyticsConsentVersion: policyVersion, personalAnalyticsConsentedAt: now, personalAnalyticsWithdrawnAt: null }
        : { personalAnalyticsWithdrawnAt: now };
    case "MODEL_TRAINING":
      return granted
        ? { trainingConsentVersion: policyVersion, trainingConsentedAt: now, trainingConsentWithdrawnAt: null, trainingDataExcludedAt: null }
        : { trainingConsentWithdrawnAt: now, trainingDataExcludedAt: now };
    case "PUBLIC_RESEARCH":
      return granted
        ? { researchConsentVersion: policyVersion, researchConsentedAt: now, researchConsentWithdrawnAt: null }
        : { researchConsentWithdrawnAt: now };
    case "GUARDIAN":
      return granted
        ? { guardianConsentVersion: policyVersion, guardianConsentedAt: now, guardianConsentWithdrawnAt: null }
        : { guardianConsentWithdrawnAt: now };
  }
}

export async function changeConsent({
  action,
  policyVersion,
  purpose,
  userId,
  verifiedGuardian = false
}: {
  action: ConsentAction;
  policyVersion: string;
  purpose: ConsentPurpose;
  userId: string;
  verifiedGuardian?: boolean;
}) {
  if (policyVersion !== CONSENT_POLICY_VERSIONS[purpose]) throw new Error("CONSENT_POLICY_VERSION_MISMATCH");
  if (purpose === "GUARDIAN" && action === "GRANTED" && !verifiedGuardian) throw new Error("GUARDIAN_VERIFICATION_REQUIRED");
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUniqueOrThrow({ where: { id: userId }, select: consentSelect });
    const state = consentState(user);
    if (action === "GRANTED" && (purpose === "MODEL_TRAINING" || purpose === "PUBLIC_RESEARCH") && state.guardian.required && !state.guardian.active) {
      throw new Error("GUARDIAN_CONSENT_REQUIRED");
    }
    const now = new Date();
    const updated = await transaction.user.update({
      where: { id: userId },
      data: updateForConsent(purpose, action, policyVersion, now),
      select: consentSelect
    });
    await transaction.consentEvent.create({
      data: {
        userId,
        purpose,
        action,
        policyVersion,
        metadata: { source: "ACCOUNT_PRIVACY_API" }
      }
    });
    return consentState(updated);
  }, { isolationLevel: "Serializable" });
}

export async function excludeTrainingData(userId: string) {
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: userId },
      data: { trainingDataExcludedAt: now, trainingConsentWithdrawnAt: now },
      select: consentSelect
    });
    await transaction.consentEvent.create({
      data: {
        userId,
        purpose: "MODEL_TRAINING",
        action: "WITHDRAWN",
        policyVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING,
        metadata: { source: "TRAINING_DATA_EXCLUSION" }
      }
    });
    return consentState(updated);
  }, { isolationLevel: "Serializable" });
}

export function pseudonymizeTrainingIdentifier(userId: string) {
  const secret = process.env.TRAINING_PSEUDONYM_SECRET;
  if (!secret || secret.length < 32) throw new Error("TRAINING_PSEUDONYM_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(userId).digest("hex");
}

export function suppressSmallCohort<T>(count: number, value: T) {
  return count >= PUBLIC_RESEARCH_MINIMUM_COHORT
    ? { suppressed: false as const, count, value }
    : { suppressed: true as const, count: null, value: null, minimumCohort: PUBLIC_RESEARCH_MINIMUM_COHORT };
}

export async function getConsentedTrainingRows() {
  const users = await prisma.user.findMany({
    where: {
      trainingConsentedAt: { not: null },
      trainingConsentVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING,
      trainingConsentWithdrawnAt: null,
      trainingDataExcludedAt: null,
      OR: [
        { age: { gte: 18 } },
        {
          age: { lt: 18 },
          guardianConsentVersion: CONSENT_POLICY_VERSIONS.GUARDIAN,
          guardianConsentedAt: { not: null },
          guardianConsentWithdrawnAt: null
        }
      ]
    },
    select: {
      id: true,
      age: true,
      sex: true,
      taperDays: true,
      swimSessionsPerWeek: true,
      swims: {
        where: { resultKind: "OFFICIAL", raceType: "INDIVIDUAL" },
        select: { id: true, date: true, event: true, course: true, timeSeconds: true, meetName: true, source: true, resultKind: true, raceType: true, provenance: true, createdAt: true }
      }
    }
  });
  return users.map((user) => {
    const mapped: SwimResult[] = user.swims.map((result) => ({
      id: result.id,
      userId: user.id,
      date: result.date.toISOString().slice(0, 10),
      event: fromPrismaEvent(result.event),
      course: result.course,
      timeSeconds: result.timeSeconds,
      meetName: result.meetName,
      source: result.source,
      resultKind: result.resultKind,
      raceType: result.raceType
    }));
    const groups = new Map<string, SwimResult[]>();
    for (const result of mapped) {
      const key = `${result.event}__${result.course}`;
      groups.set(key, [...(groups.get(key) ?? []), result]);
    }
    const qualityAssessments = [...groups.entries()].map(([key, results]) => ({
      key,
      assessment: assessPredictionDataQuality({
        swims: mapped,
        event: results[0].event,
        course: results[0].course,
        profile: {
          age: user.age,
          sex: user.sex,
          taperDays: user.taperDays,
          swimSessionsPerWeek: user.swimSessionsPerWeek
        }
      })
    }));
    const eligibleGroups = new Set(qualityAssessments
      .filter(({ assessment }) => assessment.decision === "FULL_PREDICTION" || assessment.decision === "CONSERVATIVE_ESTIMATE")
      .map(({ key }) => key));
    const resultProvenance = user.swims
      .filter((result) => eligibleGroups.has(`${fromPrismaEvent(result.event)}__${result.course}`))
      .map((result) => ({
        date: result.date,
        event: result.event,
        course: result.course,
        timeSeconds: result.timeSeconds,
        source: result.source,
        resultKind: result.resultKind,
        raceType: result.raceType,
        provenance: result.provenance,
        createdAt: result.createdAt
      }));

    return {
      athletePseudonym: pseudonymizeTrainingIdentifier(user.id),
      age: user.age,
      category: user.sex,
      taperDays: user.taperDays,
      swimSessionsPerWeek: user.swimSessionsPerWeek,
      qualityAssessments: qualityAssessments.map(({ key, assessment }) => ({ key, ...assessment })),
      results: resultProvenance
    };
  });
}
