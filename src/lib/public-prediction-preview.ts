import type { Course } from "@/types/swim";
import { clamp, round } from "@/lib/utils";

export const publicPredictionSeedStorageKey = "swimsight:50-free-preview:v1";
export const publicPredictionSeedTtlMs = 60 * 60 * 1000;

export interface PublicPredictionSeed {
  course: Course;
  currentTime: number;
  sessionsPerWeek: number;
  createdAt: number;
}

export interface PublicPredictionPreview {
  course: Course;
  currentTime: number;
  estimate: number;
  lowerBound: number;
  upperBound: number;
  improvementSeconds: number;
  improvementPercent: number;
  sessionsPerWeek: number;
}

const recordFloors: Record<Course, number> = {
  LCM: 20.91,
  SCM: 20.1,
  SCY: 17.6
};

const annualPriors: Record<Course, number> = {
  LCM: 0.0388,
  SCM: 0.0404,
  SCY: 0.039
};

function trainingMultiplier(sessionsPerWeek: number) {
  if (sessionsPerWeek <= 2) return 0.72;
  if (sessionsPerWeek === 3) return 0.84;
  if (sessionsPerWeek === 4) return 0.94;
  if (sessionsPerWeek === 5) return 1;
  if (sessionsPerWeek === 6) return 1.06;
  if (sessionsPerWeek === 7) return 1.1;
  return 1.12;
}

export function isCourse(value: unknown): value is Course {
  return value === "LCM" || value === "SCM" || value === "SCY";
}

export function minimumPublicPredictionTime(course: Course) {
  return recordFloors[course];
}

export function isValidPublicPredictionSeed(value: unknown, now = Date.now()): value is PublicPredictionSeed {
  if (!value || typeof value !== "object") return false;

  const seed = value as Partial<PublicPredictionSeed>;
  return isCourse(seed.course)
    && typeof seed.currentTime === "number"
    && Number.isFinite(seed.currentTime)
    && seed.currentTime >= recordFloors[seed.course]
    && seed.currentTime <= 180
    && typeof seed.sessionsPerWeek === "number"
    && Number.isInteger(seed.sessionsPerWeek)
    && seed.sessionsPerWeek >= 1
    && seed.sessionsPerWeek <= 14
    && typeof seed.createdAt === "number"
    && Number.isFinite(seed.createdAt)
    && seed.createdAt <= now + 60_000
    && now - seed.createdAt <= publicPredictionSeedTtlMs;
}

export function buildPublicPredictionPreview(seed: PublicPredictionSeed): PublicPredictionPreview {
  if (!isValidPublicPredictionSeed(seed)) {
    throw new Error("Invalid public prediction inputs.");
  }

  const floor = recordFloors[seed.course];
  const headroomRatio = clamp((seed.currentTime / floor - 1) / 0.75, 0, 1);
  const performanceAdjustment = 0.55 + headroomRatio * 0.55;
  const annualImprovementRate = clamp(
    annualPriors[seed.course] * trainingMultiplier(seed.sessionsPerWeek) * performanceAdjustment,
    0.008,
    0.062
  );
  const unconstrainedImprovement = seed.currentTime * annualImprovementRate;
  const recordBuffer = Math.max(0, seed.currentTime - floor);
  const improvementSeconds = Math.min(unconstrainedImprovement, recordBuffer * 0.32);
  const estimate = Math.max(floor, seed.currentTime - improvementSeconds);
  const uncertainty = Math.max(0.28, seed.currentTime * (0.009 + (14 - seed.sessionsPerWeek) * 0.00022));

  return {
    course: seed.course,
    currentTime: round(seed.currentTime, 2),
    estimate: round(estimate, 2),
    lowerBound: round(Math.max(floor, estimate - uncertainty), 2),
    upperBound: round(Math.min(seed.currentTime, estimate + uncertainty), 2),
    improvementSeconds: round(seed.currentTime - estimate, 2),
    improvementPercent: round(((seed.currentTime - estimate) / seed.currentTime) * 100, 1),
    sessionsPerWeek: seed.sessionsPerWeek
  };
}
