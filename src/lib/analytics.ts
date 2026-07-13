import type {
  DashboardAnalytics,
  Course,
  EventRanking,
  GymWorkout,
  Goal,
  GoalProjection,
  PersonalBest,
  Prediction,
  PredictionProfile,
  SwimEvent,
  SwimPowerIndex,
  SwimResult,
  StrokeSpecialty,
  TrendLabel
} from "@/types/swim";
import { clamp, dateToDays, round } from "@/lib/utils";
import { getPredictionPrior, type PredictionPrior } from "@/lib/trained-prediction-model";
import { buildHundredFreeFeatures, hundredFreeDataSufficiency } from "@/lib/prediction-features";
import {
  buildDeterministicExplanation,
  buildProbabilitySet,
  buildTreeShapExplanation,
  probabilityFromForecast
} from "@/lib/prediction-intelligence";
import { projectPredictionToDate } from "@/lib/prediction-evaluation";
import { assessPredictionDataQuality, buildActionablePredictionInsights } from "@/lib/prediction-governance";
import { predictWithHundredFreeXgboost, type ApprovedLearnedModelRelease } from "@/lib/xgboost-runtime";

const predictionHorizons = [30, 90, 180, 365] as const;

type TrainingLoadSignal = {
  weeklyLoad: number;
  sessionsLast28Days: number;
  loadRatio: number;
  adjustmentMultiplier: number;
  confidenceAdjustment: number;
  label: Prediction["trainingImpact"]["label"];
};

type EventCourseKey = `${SwimEvent}__${Course}`;

export interface PredictionReleaseContext {
  hundredFreeChampionReleases?: Partial<Record<Course, ApprovedLearnedModelRelease>>;
}

const neutralTrainingSignal: TrainingLoadSignal = {
  weeklyLoad: 0,
  sessionsLast28Days: 0,
  loadRatio: 1,
  adjustmentMultiplier: 1,
  confidenceAdjustment: 0,
  label: "No gym data"
};

function byDateAsc(a: SwimResult, b: SwimResult) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

export function isOfficialResult(swim: Pick<SwimResult, "resultKind" | "raceType">) {
  return (swim.resultKind ?? "OFFICIAL") === "OFFICIAL" &&
    (swim.raceType ?? "INDIVIDUAL") === "INDIVIDUAL";
}

function eventCourseKey(swim: Pick<SwimResult, "event" | "course">): EventCourseKey {
  return `${swim.event}__${swim.course}`;
}

function groupByEventCourse(swims: SwimResult[]) {
  return swims.reduce<Map<EventCourseKey, SwimResult[]>>((groups, swim) => {
    const key = eventCourseKey(swim);
    const existing = groups.get(key) ?? [];
    existing.push(swim);
    groups.set(key, existing);
    return groups;
  }, new Map());
}

function groupByEvent(swims: SwimResult[]) {
  return swims.reduce<Map<SwimEvent, SwimResult[]>>((groups, swim) => {
    const existing = groups.get(swim.event) ?? [];
    existing.push(swim);
    groups.set(swim.event, existing);
    return groups;
  }, new Map());
}

// Conservative public-record floors. LCM/SCM are based on World Aquatics record
// territory; SCY uses all-time yards territory. Values include a small safety
// buffer so SwimSight avoids predicting below elite record lines.
const recordFloorSeconds: Partial<Record<Course, Partial<Record<SwimEvent, number>>>> = {
  LCM: {
    "50 Freestyle": 20.91,
    "100 Freestyle": 46.4,
    "200 Freestyle": 101.8,
    "400 Freestyle": 220.0,
    "800 Freestyle": 452.0,
    "1500 Freestyle": 870.0,
    "50 Butterfly": 22.2,
    "100 Butterfly": 49.0,
    "200 Butterfly": 110.0,
    "50 Backstroke": 23.4,
    "100 Backstroke": 51.5,
    "200 Backstroke": 111.0,
    "50 Breaststroke": 25.8,
    "100 Breaststroke": 56.8,
    "200 Breaststroke": 125.5,
    "100 IM": 50.5,
    "200 IM": 113.0,
    "400 IM": 242.5
  },
  SCM: {
    "50 Freestyle": 20.1,
    "100 Freestyle": 44.8,
    "200 Freestyle": 99.0,
    "400 Freestyle": 212.0,
    "800 Freestyle": 443.0,
    "1500 Freestyle": 846.0,
    "50 Butterfly": 21.5,
    "100 Butterfly": 47.0,
    "200 Butterfly": 107.0,
    "50 Backstroke": 22.2,
    "100 Backstroke": 48.4,
    "200 Backstroke": 105.5,
    "50 Breaststroke": 24.7,
    "100 Breaststroke": 54.9,
    "200 Breaststroke": 120.0,
    "100 IM": 49.0,
    "200 IM": 108.0,
    "400 IM": 237.0
  },
  SCY: {
    "50 Freestyle": 17.6,
    "100 Freestyle": 39.8,
    "200 Freestyle": 88.5,
    "400 Freestyle": 193.0,
    "800 Freestyle": 398.0,
    "1500 Freestyle": 750.0,
    "50 Butterfly": 19.0,
    "100 Butterfly": 42.8,
    "200 Butterfly": 98.5,
    "50 Backstroke": 20.0,
    "100 Backstroke": 43.3,
    "200 Backstroke": 96.0,
    "50 Breaststroke": 22.2,
    "100 Breaststroke": 48.0,
    "200 Breaststroke": 106.0,
    "100 IM": 46.0,
    "200 IM": 97.5,
    "400 IM": 211.5
  }
};

function getRecordFloor(event: SwimEvent, course: Course) {
  return recordFloorSeconds[course]?.[event] ?? 0;
}

function ageBenchmarkMultiplier(age?: number | null) {
  if (!age) return 1.18;
  if (age <= 10) return 1.72;
  if (age === 11) return 1.6;
  if (age === 12) return 1.48;
  if (age === 13) return 1.36;
  if (age === 14) return 1.27;
  if (age === 15) return 1.2;
  if (age === 16) return 1.14;
  if (age === 17) return 1.09;
  if (age === 18) return 1.05;
  return 1;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

export function linearRegression(points: { x: number; y: number }[]) {
  if (points.length < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0 };
  }

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX ** 2;

  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function weightedLinearRegression(points: { x: number; y: number; weight: number }[]) {
  if (points.length < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0 };
  }

  const sumWeight = points.reduce((sum, point) => sum + point.weight, 0);
  const sumX = points.reduce((sum, point) => sum + point.x * point.weight, 0);
  const sumY = points.reduce((sum, point) => sum + point.y * point.weight, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y * point.weight, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x * point.weight, 0);
  const denominator = sumWeight * sumXX - sumX ** 2;

  if (denominator === 0) {
    return { slope: 0, intercept: sumY / sumWeight };
  }

  const slope = (sumWeight * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / sumWeight;

  return { slope, intercept };
}

function eventRegression(swims: SwimResult[]) {
  const sorted = [...swims].sort(byDateAsc);
  const startDay = dateToDays(sorted[0].date);
  const latestDay = dateToDays(sorted[sorted.length - 1].date);
  const points = sorted.map((swim, index) => {
    const ageDays = latestDay - dateToDays(swim.date);
    const orderWeight = sorted.length <= 1 ? 1 : 0.72 + (index / (sorted.length - 1)) * 0.56;
    const recencyWeight = clamp(1 - ageDays / 730, 0.42, 1);
    const previous = sorted[index - 1];
    const jumpPercent = previous ? Math.abs(swim.timeSeconds - previous.timeSeconds) / previous.timeSeconds : 0;
    const qualityWeight = jumpPercent > 0.16 ? 0.42 : jumpPercent > 0.1 ? 0.7 : 1;

    return {
      x: dateToDays(swim.date) - startDay,
      y: swim.timeSeconds,
      weight: orderWeight * recencyWeight * qualityWeight
    };
  });

  return weightedLinearRegression(points);
}

function predictionConfidence(sampleSize: number, consistencyScore: number, slope: number) {
  const sampleConfidence = clamp(sampleSize * 15, 30, 90);
  const trendPenalty = Math.abs(slope) > 0.16 ? 8 : Math.abs(slope) > 0.08 ? 3 : 0;

  return round(clamp(sampleConfidence * 0.45 + consistencyScore * 0.55 - trendPenalty), 1);
}

function maxForecastImprovement(currentTime: number, days: number, confidence: number, prior?: PredictionPrior) {
  const baseFraction = days <= 30 ? 0.018 : days <= 90 ? 0.045 : days <= 180 ? 0.075 : 0.12;
  const confidenceMultiplier = clamp(0.56 + confidence / 100, 0.72, 1.18);
  const genericCap = baseFraction * confidenceMultiplier;
  const trainedCap = prior ? prior.annualImprovementCap * (days / 365) : genericCap;
  const minimumMovement = days <= 30 ? 0.004 : days <= 90 ? 0.012 : days <= 180 ? 0.02 : 0.028;
  const capFraction = prior ? clamp(Math.min(genericCap, trainedCap), minimumMovement, genericCap) : genericCap;

  return currentTime * capFraction;
}

function priorConfidenceAdjustment(prior?: PredictionPrior) {
  if (!prior) return 0;
  if (prior.sampleCount >= 8) return 4;
  if (prior.sampleCount >= 4) return 2;
  if (prior.sampleCount >= 3) return 1;
  return -2;
}

function priorProjectedSlope(prior: PredictionPrior | undefined, currentTime: number) {
  if (!prior || prior.annualImprovementCap <= 0 || prior.slopeSecondsPerDay >= 0) {
    return 0;
  }

  const annualFraction = clamp(prior.annualImprovementCap * 0.72, 0.006, 0.075);
  return -(currentTime * annualFraction) / 365;
}

function dampedSlope(slope: number, confidence: number, trainingSignal: TrainingLoadSignal) {
  const reliability = clamp((confidence - 28) / 64, 0, 1);

  if (slope < 0) {
    return slope * reliability * trainingSignal.adjustmentMultiplier;
  }

  return slope * clamp(0.25 + reliability * 0.35, 0.25, 0.6);
}

function blendedPredictionSlope({
  confidence,
  currentTime,
  personalSlope,
  prior,
  sampleSize,
  trainingSignal
}: {
  confidence: number;
  currentTime: number;
  personalSlope: number;
  prior?: PredictionPrior;
  sampleSize: number;
  trainingSignal: TrainingLoadSignal;
}) {
  const personal = dampedSlope(personalSlope, confidence, trainingSignal);
  const priorSlope = priorProjectedSlope(prior, currentTime);

  if (priorSlope >= 0) {
    return personal;
  }

  const sampleWeight =
    sampleSize <= 1 ? 0.16 : sampleSize === 2 ? 0.24 : sampleSize <= 4 ? 0.16 : 0.06;
  const confidenceWeight = clamp(confidence / 72, 0.35, 1);
  const priorWeight = sampleWeight * confidenceWeight;

  return personal * (1 - priorWeight) + priorSlope * priorWeight;
}

export function calculateConsistencyScore(swims: SwimResult[]) {
  const recent = [...swims].sort(byDateAsc).slice(-6);
  const times = recent.map((swim) => swim.timeSeconds);

  if (times.length < 2) {
    return 50;
  }

  const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
  const coefficientOfVariation = standardDeviation(times) / mean;

  return round(clamp(100 - coefficientOfVariation * 700), 1);
}

export function detectTrend(swims: SwimResult[]): TrendLabel {
  if (swims.length < 3) {
    return "Plateauing";
  }

  const { slope } = eventRegression(swims);

  if (slope < -0.01) {
    return "Improving";
  }

  if (slope > 0.01) {
    return "Declining";
  }

  return "Plateauing";
}

function trendScore(swims: SwimResult[]) {
  const { slope } = eventRegression(swims);

  if (slope < 0) {
    return round(clamp(62 + Math.abs(slope) * 1_000), 1);
  }

  return round(clamp(55 - slope * 1_200), 1);
}

function improvementScore(improvementPercent: number) {
  return round(clamp(improvementPercent * 11), 1);
}

function performanceScore(timeSeconds: number, event: SwimEvent, course: Course, athleteAge?: number | null) {
  const recordFloor = getRecordFloor(event, course);
  if (!recordFloor) {
    return 50;
  }

  const benchmark = recordFloor * ageBenchmarkMultiplier(athleteAge);
  const benchmarkRatio = timeSeconds / benchmark;
  return round(clamp(100 - Math.max(0, benchmarkRatio - 1) * 85, 18, 100), 1);
}

function recentProgressPercent(swims: SwimResult[]) {
  const sorted = [...swims].sort(byDateAsc);
  const latestDay = dateToDays(sorted[sorted.length - 1].date);
  const recent = sorted.filter((swim) => latestDay - dateToDays(swim.date) <= 180);

  if (recent.length < 2) {
    return 0;
  }

  const first = recent[0].timeSeconds;
  const latest = recent[recent.length - 1].timeSeconds;

  return round(((first - latest) / first) * 100, 2);
}

export function getPersonalBests(swims: SwimResult[]) {
  const groups = groupByEventCourse(swims);
  const personalBests: PersonalBest[] = [];

  groups.forEach((eventSwims) => {
    const sorted = [...eventSwims].sort(byDateAsc);
    let currentBest = sorted[0];
    let previousBest: SwimResult | undefined;

    for (const swim of sorted) {
      if (swim.timeSeconds <= currentBest.timeSeconds) {
        previousBest = currentBest.id === swim.id ? previousBest : currentBest;
        currentBest = swim;
      }
    }

    const improvementSeconds = previousBest
      ? round(previousBest.timeSeconds - currentBest.timeSeconds, 2)
      : 0;
    const improvementPercent = previousBest
      ? round((improvementSeconds / previousBest.timeSeconds) * 100, 2)
      : 0;

    personalBests.push({
      event: currentBest.event,
      course: currentBest.course,
      currentPb: currentBest.timeSeconds,
      dateAchieved: currentBest.date,
      meetName: currentBest.meetName,
      previousPb: previousBest?.timeSeconds,
      improvementSeconds,
      improvementPercent
    });
  });

  return personalBests.sort((a, b) => a.event.localeCompare(b.event) || a.course.localeCompare(b.course));
}

export function rankEvents(swims: SwimResult[], athleteAge?: number | null) {
  const rankings: EventRanking[] = [];

  groupByEventCourse(swims).forEach((eventSwims) => {
    const sorted = [...eventSwims].sort(byDateAsc);
    const first = sorted[0];
    const best = sorted.reduce((fastest, swim) =>
      swim.timeSeconds < fastest.timeSeconds ? swim : fastest
    );
    const improvementPercent = round(((first.timeSeconds - best.timeSeconds) / first.timeSeconds) * 100, 2);
    const eventPerformanceScore = performanceScore(best.timeSeconds, first.event, first.course, athleteAge);
    const consistencyScore = calculateConsistencyScore(sorted);
    const eventTrendScore = trendScore(sorted);
    const eventRecentProgress = recentProgressPercent(sorted);
    const developmentScore = round(
      improvementScore(improvementPercent) * 0.4 +
        consistencyScore * 0.3 +
        eventTrendScore * 0.3,
      1
    );
    const score = round(
      eventPerformanceScore * 0.62 +
        developmentScore * 0.38,
      1
    );

    rankings.push({
      event: first.event,
      course: first.course,
      score,
      performanceScore: eventPerformanceScore,
      improvementPercent,
      consistencyScore,
      trend: detectTrend(sorted),
      trendScore: eventTrendScore,
      recentProgressPercent: eventRecentProgress
    });
  });

  return rankings.sort((a, b) => b.score - a.score);
}

function averageWindowImprovement(swims: SwimResult[], days: number) {
  const improvements: number[] = [];
  const latestDay = Math.max(...swims.map((swim) => dateToDays(swim.date)));

  groupByEvent(swims).forEach((eventSwims) => {
    const recent = [...eventSwims]
      .sort(byDateAsc)
      .filter((swim) => latestDay - dateToDays(swim.date) <= days);

    if (recent.length < 2) {
      return;
    }

    const first = recent[0].timeSeconds;
    const latest = recent[recent.length - 1].timeSeconds;
    improvements.push(((first - latest) / first) * 100);
  });

  if (!improvements.length) {
    return 0;
  }

  return round(improvements.reduce((sum, value) => sum + value, 0) / improvements.length, 2);
}

export function calculateTrainingLoadSignal(workouts: GymWorkout[]): TrainingLoadSignal {
  if (!workouts.length) {
    return neutralTrainingSignal;
  }

  const sorted = [...workouts].sort((a, b) => dateToDays(a.date) - dateToDays(b.date));
  const latestDay = dateToDays(sorted[sorted.length - 1].date);
  const recent = sorted.filter((workout) => latestDay - dateToDays(workout.date) <= 42);
  const baseline = sorted.filter((workout) => latestDay - dateToDays(workout.date) <= 180);
  const last28 = sorted.filter((workout) => latestDay - dateToDays(workout.date) <= 28);
  const recentWeeklyLoad = recent.reduce((sum, workout) => sum + workout.trainingLoad, 0) / 6;
  const baselineStartDay = dateToDays(baseline[0]?.date ?? sorted[0].date);
  const baselineWeeks = Math.max(1, (latestDay - baselineStartDay + 1) / 7);
  const baselineWeeklyLoad = baseline.reduce((sum, workout) => sum + workout.trainingLoad, 0) / baselineWeeks;
  const loadRatio = baselineWeeklyLoad > 0 ? recentWeeklyLoad / baselineWeeklyLoad : 1;
  const averageIntensity = recent.reduce((sum, workout) => sum + workout.intensity, 0) / Math.max(recent.length, 1);
  const hasStrengthSupport = last28.length >= 4 && averageIntensity <= 8.2;
  const fatigueRisk = loadRatio > 1.45 || averageIntensity >= 8.7;
  const adjustmentMultiplier = fatigueRisk ? 0.93 : hasStrengthSupport ? 1.06 : 1.02;
  const confidenceAdjustment = fatigueRisk ? -8 : hasStrengthSupport ? 5 : 2;
  const label: TrainingLoadSignal["label"] = fatigueRisk
    ? "Fatigue risk"
    : hasStrengthSupport
      ? "Strength supported"
      : "Balanced load";

  return {
    weeklyLoad: round(recentWeeklyLoad, 1),
    sessionsLast28Days: last28.length,
    loadRatio: round(loadRatio, 2),
    adjustmentMultiplier,
    confidenceAdjustment,
    label
  };
}

function normalizePredictionProfile(profile?: PredictionProfile | number | null): PredictionProfile {
  if (typeof profile === "number") return { age: profile };
  return profile ?? {};
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function profileConfidenceAdjustment(profile: PredictionProfile) {
  return (profile.age ? 2 : 0) + (profile.sex ? 2 : 0) + (profile.taperDays !== null && profile.taperDays !== undefined ? 2 : 0) + (profile.swimSessionsPerWeek !== null && profile.swimSessionsPerWeek !== undefined ? 3 : 0);
}

function frequencySlopeMultiplier(profile: PredictionProfile) {
  const frequency = profile.swimSessionsPerWeek;
  return frequency === null || frequency === undefined
    ? 1
    : frequency >= 4 && frequency <= 9
      ? 1.03
      : frequency < 2 || frequency > 11
        ? 0.96
        : 1;
}

function taperSlopeMultiplier(profile: PredictionProfile) {
  const taper = profile.taperDays;
  return taper === null || taper === undefined
    ? 1
    : taper >= 5 && taper <= 14
      ? 1.02
      : taper > 21
        ? 0.97
        : 1;
}

function predictionFactors(history: SwimResult[], profile: PredictionProfile, trainingSignal: TrainingLoadSignal, slope: number): Prediction["model"]["factors"] {
  const factors: Prediction["model"]["factors"] = [
    {
      label: "Race history",
      impact: history.length >= 10 ? "positive" : history.length >= 4 ? "neutral" : "caution",
      detail: history.length >= 10 ? "Strong race history coverage." : history.length >= 4 ? "Some race history is available." : "More official races will improve reliability."
    },
    {
      label: "Recent trend",
      impact: slope < -0.01 ? "positive" : slope > 0.01 ? "caution" : "neutral",
      detail: slope < -0.01 ? "Recent times are trending faster" : slope > 0.01 ? "Recent times are trending slower" : "Recent times are broadly stable"
    },
    {
      label: "Age and category",
      impact: profile.age && profile.sex ? "neutral" : "caution",
      detail: profile.age && profile.sex ? "Development context is available" : "Complete the athlete profile for better calibration"
    },
    {
      label: "Taper plan",
      impact: profile.taperDays === null || profile.taperDays === undefined ? "caution" : "neutral",
      detail: profile.taperDays === null || profile.taperDays === undefined ? "No taper duration entered" : "Taper duration is included."
    },
    {
      label: "Training frequency",
      impact: profile.swimSessionsPerWeek === null || profile.swimSessionsPerWeek === undefined ? "caution" : "neutral",
      detail: profile.swimSessionsPerWeek === null || profile.swimSessionsPerWeek === undefined ? "No weekly swim frequency entered" : "Weekly swim frequency is included."
    }
  ];

  if (trainingSignal.sessionsLast28Days > 0) {
    factors.push({
      label: "Dryland load",
      impact: trainingSignal.label === "Fatigue risk" ? "caution" : "neutral",
      detail: "Recent dryland load is included."
    });
  }

  return factors;
}

function likelyRange({
  confidence,
  consistencyScore,
  course,
  days,
  event,
  point,
  residualP80,
  dataSufficiency,
  daysSinceLastRace,
  outOfDistribution
}: {
  confidence: number;
  consistencyScore: number;
  course: Course;
  days: number;
  event: SwimEvent;
  point: number;
  residualP80?: number;
  dataSufficiency: Prediction["model"]["dataSufficiency"];
  daysSinceLastRace: number;
  outOfDistribution: boolean;
}) {
  const inferredResidual = Math.max(0.25, point * (1 - consistencyScore / 100) * 0.028);
  const horizonMultiplier = 0.72 + Math.sqrt(days / 90) * 0.32;
  const confidenceMultiplier = 1 + Math.max(0, 70 - confidence) / 100;
  const sufficiencyMultiplier = dataSufficiency === "High" ? 0.88 : dataSufficiency === "Moderate" ? 1.12 : 1.45;
  const stalenessMultiplier = 1 + clamp((daysSinceLastRace - 60) / 365, 0, 0.7);
  const distributionMultiplier = outOfDistribution ? 1.2 : 1;
  const width = Math.max(0.18, (residualP80 ?? inferredResidual) * horizonMultiplier * confidenceMultiplier * sufficiencyMultiplier * stalenessMultiplier * distributionMultiplier);
  return {
    low: round(Math.max(getRecordFloor(event, course), point - width), 2),
    high: round(point + width, 2)
  };
}

function distributionWarnings(history: SwimResult[], profile: PredictionProfile) {
  const latest = history[history.length - 1];
  const daysSinceLastRace = Math.max(0, dateToDays(new Date().toISOString().slice(0, 10)) - dateToDays(latest.date));
  const warnings: string[] = [];
  if (history.length < 3) warnings.push("Fewer than three eligible races");
  if (daysSinceLastRace > 365) warnings.push("Latest eligible race is more than one year old");
  if (!profile.age || !profile.sex) warnings.push("Age or performance category is missing");
  if (profile.age && (profile.age < 10 || profile.age > 18)) warnings.push("Age is outside the current youth training distribution");
  if (profile.taperDays !== null && profile.taperDays !== undefined && profile.taperDays > 21) warnings.push("Taper duration is outside the common training range");
  if (profile.swimSessionsPerWeek !== null && profile.swimSessionsPerWeek !== undefined && profile.swimSessionsPerWeek > 10) warnings.push("Training frequency is outside the common training range");
  return { daysSinceLastRace, warnings };
}

function sufficiencyChecklist(history: SwimResult[], profile: PredictionProfile, daysSinceLastRace: number) {
  const checklist: string[] = [];
  if (history.length < 10) checklist.push("Add more recent official races in this event and course");
  if (!profile.age) checklist.push("Add athlete age");
  if (!profile.sex) checklist.push("Add performance category");
  if (profile.taperDays === null || profile.taperDays === undefined) checklist.push("Confirm taper duration");
  if (profile.swimSessionsPerWeek === null || profile.swimSessionsPerWeek === undefined) checklist.push("Add weekly swim frequency");
  if (daysSinceLastRace > 90) checklist.push("Record a recent official race");
  return checklist;
}

export function predictEvent(
  swims: SwimResult[],
  trainingSignal: TrainingLoadSignal = neutralTrainingSignal,
  rawProfile: PredictionProfile | number | null = {},
  goal?: Goal,
  qualityInputSwims: SwimResult[] = swims,
  releaseContext: PredictionReleaseContext = {}
): Prediction {
  if (new Set(swims.map((swim) => swim.userId)).size > 1) {
    throw new Error("Prediction history must belong to one athlete.");
  }
  const profile = normalizePredictionProfile(rawProfile);
  const sorted = [...swims].sort(byDateAsc).slice(-20);
  const latest = sorted[sorted.length - 1];
  const dataQuality = assessPredictionDataQuality({
    swims: qualityInputSwims,
    event: latest.event,
    course: latest.course,
    profile
  });
  const { slope } = eventRegression(sorted);
  const consistencyScore = calculateConsistencyScore(sorted);
  const prior = getPredictionPrior(latest.event, latest.course);
  const baseConfidence = predictionConfidence(sorted.length, consistencyScore, slope);
  const qualityConfidenceAdjustment = dataQuality.score >= 75 ? 0 : -(75 - dataQuality.score) * 0.25;
  const confidence = round(clamp(baseConfidence + trainingSignal.confidenceAdjustment + priorConfidenceAdjustment(prior) + profileConfidenceAdjustment(profile) + qualityConfidenceAdjustment, 0, 100), 1);
  const baseAdjustedSlope = blendedPredictionSlope({
    confidence,
    currentTime: latest.timeSeconds,
    personalSlope: slope,
    prior,
    sampleSize: sorted.length,
    trainingSignal
  });
  const neutralSlope = blendedPredictionSlope({
    confidence,
    currentTime: latest.timeSeconds,
    personalSlope: slope,
    prior,
    sampleSize: sorted.length,
    trainingSignal: neutralTrainingSignal
  });
  const frequencyAdjustedSlope = baseAdjustedSlope < 0 ? baseAdjustedSlope * frequencySlopeMultiplier(profile) : baseAdjustedSlope;
  const adjustedSlope = frequencyAdjustedSlope < 0 ? frequencyAdjustedSlope * taperSlopeMultiplier(profile) : frequencyAdjustedSlope;

  const project = (days: number) => {
    const targetDate = addDays(latest.date, days);
    const features = latest.event === "100 Freestyle"
      ? buildHundredFreeFeatures({ course: latest.course, profile, swims: sorted, targetDate })
      : null;
    const xgboost = features && dataQuality.decision === "FULL_PREDICTION"
      ? predictWithHundredFreeXgboost(latest.course, features.vector, releaseContext.hundredFreeChampionReleases?.[latest.course])
      : null;
    const deterministicPredicted = latest.timeSeconds + adjustedSlope * days;
    const predicted = xgboost?.predictedTime ?? deterministicPredicted;
    const fastestAllowed = latest.timeSeconds - maxForecastImprovement(latest.timeSeconds, days, confidence, prior);
    const recordFloor = getRecordFloor(latest.event, latest.course);
    const slowestAllowed = latest.timeSeconds * 1.08;

    const time = round(clamp(predicted, Math.max(fastestAllowed, recordFloor), slowestAllowed), 2);
    const deterministicTime = round(clamp(deterministicPredicted, Math.max(fastestAllowed, recordFloor), slowestAllowed), 2);
    const explanation = xgboost
      ? buildTreeShapExplanation({
          expectedValue: xgboost.explanation.expectedValue,
          featureContributions: xgboost.explanation.contributions,
          finalTime: time,
          rawPredictedTime: xgboost.predictedTime
        })
      : buildDeterministicExplanation({
          baseTime: latest.timeSeconds,
          finalTime: time,
          components: [
            { label: "Recent trend and population prior", secondsImpact: neutralSlope * days },
            { label: "Recent dryland load", secondsImpact: (baseAdjustedSlope - neutralSlope) * days },
            { label: "Training frequency", secondsImpact: (frequencyAdjustedSlope - baseAdjustedSlope) * days },
            { label: "Taper duration", secondsImpact: (adjustedSlope - frequencyAdjustedSlope) * days },
            { label: "Safety guardrail", secondsImpact: time - (latest.timeSeconds + adjustedSlope * days) }
          ]
        });

    return {
      time,
      deterministicTime,
      xgboost,
      features,
      explanation
    };
  };
  const projections = {
    days30: project(predictionHorizons[0]),
    days90: project(predictionHorizons[1]),
    days180: project(predictionHorizons[2]),
    days365: project(predictionHorizons[3])
  };
  const activeXgboost = projections.days90.xgboost ?? projections.days30.xgboost ?? projections.days180.xgboost ?? projections.days365.xgboost;
  const hundredFreeFeatures = projections.days90.features;
  const dataSufficiency = hundredFreeFeatures
    ? hundredFreeDataSufficiency(hundredFreeFeatures)
    : sorted.length >= 10 && profile.age
      ? "High"
      : sorted.length >= 4
        ? "Moderate"
        : "Low";
  const distribution = distributionWarnings(sorted, profile);
  const checklist = sufficiencyChecklist(sorted, profile, distribution.daysSinceLastRace);
  const rangeFor = (key: keyof typeof projections, days: number) => {
    const point = projections[key].time;
    const baseRange = likelyRange({
      confidence,
      consistencyScore,
      course: latest.course,
      days,
      event: latest.event,
      point,
      residualP80: projections[key].xgboost?.metrics.residualP80,
      dataSufficiency,
      daysSinceLastRace: distribution.daysSinceLastRace,
      outOfDistribution: distribution.warnings.length > 0
    });
    const multiplier = dataQuality.decision === "PROVISIONAL_ONLY" ? 1.55 : dataQuality.decision === "CONSERVATIVE_ESTIMATE" ? 1.25 : 1;
    return {
      low: round(Math.max(getRecordFloor(latest.event, latest.course), point - (point - baseRange.low) * multiplier), 2),
      high: round(point + (baseRange.high - point) * multiplier, 2)
    };
  };
  const ranges = {
    days30: rangeFor("days30", 30),
    days90: rangeFor("days90", 90),
    days180: rangeFor("days180", 180),
    days365: rangeFor("days365", 365)
  };
  const personalBest = Math.min(...sorted.map((swim) => swim.timeSeconds));
  const matchingGoal = goal?.event === latest.event && goal.course === latest.course ? goal : undefined;
  const probabilityFor = (key: keyof typeof projections) => buildProbabilitySet({
    point: projections[key].time,
    low: ranges[key].low,
    high: ranges[key].high,
    pbTime: personalBest,
    goalTime: matchingGoal?.targetTime,
    qualifyingTime: matchingGoal?.qualifyingTime,
    residualQuantiles: projections[key].xgboost?.metrics.residualQuantiles
  });

  return {
    event: latest.event,
    course: latest.course,
    currentTime: latest.timeSeconds,
    predictionDate: latest.date,
    predictedTimes: {
      days30: projections.days30.time,
      days90: projections.days90.time,
      days180: projections.days180.time,
      days365: projections.days365.time
    },
    deterministicBaselineTimes: {
      days30: projections.days30.deterministicTime,
      days90: projections.days90.deterministicTime,
      days180: projections.days180.deterministicTime,
      days365: projections.days365.deterministicTime
    },
    confidence,
    likelyRanges: ranges,
    explanations: {
      days30: projections.days30.explanation,
      days90: projections.days90.explanation,
      days180: projections.days180.explanation,
      days365: projections.days365.explanation
    },
    probabilities: {
      days30: probabilityFor("days30"),
      days90: probabilityFor("days90"),
      days180: probabilityFor("days180"),
      days365: probabilityFor("days365")
    },
    model: {
      kind: activeXgboost ? "XGBOOST" : "CONSERVATIVE_ENSEMBLE",
      version: activeXgboost?.version ?? "conservative-ensemble-2026-07-13",
      validationMae: activeXgboost?.metrics.rollingMae,
      trainingDate: activeXgboost?.trainingDate,
      trainingDatasetSize: activeXgboost?.metrics.trainingRows,
      calibrationResidualQuantiles: activeXgboost?.metrics.residualQuantiles,
      historyUsed: sorted.length,
      dataSufficiency,
      factors: predictionFactors(sorted, profile, trainingSignal, slope),
      featuresUsed: [
        "Up to 20 prior race times",
        "Race recency",
        "Recent best and average",
        "Consistency and trend",
        "Age and performance category",
        "Taper duration",
        "Weekly swim frequency",
        "Recent dryland load"
      ],
      eligibilityRules: [
        "Official individual results only",
        "Same event and course only",
        "At least one prior eligible race",
        ...(activeXgboost ? ["Validated model artifact and exact feature contract"] : ["Conservative ensemble used until a validated model beats all baselines"])
      ],
      outOfDistribution: distribution.warnings.length > 0,
      outOfDistributionReasons: distribution.warnings,
      sufficiencyChecklist: checklist,
      dataQuality: {
        version: dataQuality.version,
        score: dataQuality.score,
        level: dataQuality.level,
        decision: dataQuality.decision,
        eligibleRaceCount: dataQuality.eligibleRaceCount,
        reasons: dataQuality.reasons,
        userExplanation: dataQuality.userExplanation
      }
    },
    trainingImpact: {
      label: trainingSignal.label,
      adjustmentMultiplier: trainingSignal.adjustmentMultiplier,
      weeklyLoad: trainingSignal.weeklyLoad,
      sessionsLast28Days: trainingSignal.sessionsLast28Days
    },
    actionableInsights: buildActionablePredictionInsights(sorted, profile)
  };
}

export function generatePredictions(
  swims: SwimResult[],
  workouts: GymWorkout[] = [],
  profile: PredictionProfile | number | null = {},
  goal?: Goal,
  releaseContext: PredictionReleaseContext = {}
) {
  const predictions: Prediction[] = [];
  const trainingSignal = calculateTrainingLoadSignal(workouts);

  groupByEventCourse(swims).forEach((eventSwims) => {
    const eligibleSwims = eventSwims.filter(isOfficialResult);
    if (!eligibleSwims.length) return;
    const prediction = predictEvent(eligibleSwims, trainingSignal, profile, goal, eventSwims, releaseContext);
    if (prediction.model.dataQuality.decision !== "NO_PREDICTION") predictions.push(prediction);
  });

  return predictions.sort((a, b) => a.event.localeCompare(b.event) || a.course.localeCompare(b.course));
}

export function calculateGoalProjection(swims: SwimResult[], goal: Goal, prediction?: Prediction): GoalProjection {
  const eventSwims = swims.filter((swim) => swim.event === goal.event && swim.course === goal.course).sort(byDateAsc);
  const latest = eventSwims[eventSwims.length - 1];
  if (!latest) {
    throw new Error("Goal projection requires at least one swim for the goal event.");
  }
  const best = eventSwims.reduce((fastest, swim) =>
    swim.timeSeconds < fastest.timeSeconds ? swim : fastest
  );
  const { slope } = eventRegression(eventSwims);
  const consistencyScore = calculateConsistencyScore(eventSwims);
  const prior = getPredictionPrior(latest.event, latest.course);
  const confidence = clamp(predictionConfidence(eventSwims.length, consistencyScore, slope) + priorConfidenceAdjustment(prior), 0, 100);
  const adjustedSlope = blendedPredictionSlope({
    confidence,
    currentTime: latest.timeSeconds,
    personalSlope: slope,
    prior,
    sampleSize: eventSwims.length,
    trainingSignal: neutralTrainingSignal
  });
  const daysRemaining = Math.max(dateToDays(goal.targetDate) - dateToDays(latest.date), 1);
  const weeksRemaining = daysRemaining / 7;
  const monthsRemaining = daysRemaining / 30.44;
  const requiredTotalImprovement = Math.max(best.timeSeconds - goal.targetTime, 0);
  const forecastProjection = prediction?.event === goal.event && prediction.course === goal.course
    ? projectPredictionToDate(prediction, goal.targetDate)
    : null;
  const predictedFromLatest = latest.timeSeconds + adjustedSlope * daysRemaining;
  const fastestAllowed = latest.timeSeconds - maxForecastImprovement(latest.timeSeconds, daysRemaining, confidence, prior);
  const recordFloor = getRecordFloor(latest.event, latest.course);
  const fallbackPrediction = round(clamp(predictedFromLatest, Math.max(fastestAllowed, recordFloor), latest.timeSeconds * 1.08), 2);
  const predictedAtGoalDate = forecastProjection?.predictedTime ?? fallbackPrediction;
  const currentMonthlyPace = round(Math.max(-adjustedSlope * 30.44, 0), 2);
  const fallbackRange = likelyRange({
    confidence,
    consistencyScore,
    course: latest.course,
    days: daysRemaining,
    event: latest.event,
    point: predictedAtGoalDate,
    dataSufficiency: eventSwims.length >= 10 ? "High" : eventSwims.length >= 4 ? "Moderate" : "Low",
    daysSinceLastRace: Math.max(0, dateToDays(new Date().toISOString().slice(0, 10)) - dateToDays(latest.date)),
    outOfDistribution: eventSwims.length < 3
  });
  const low = forecastProjection?.lowerBound ?? fallbackRange.low;
  const high = forecastProjection?.upperBound ?? fallbackRange.high;
  const residualQuantiles = prediction?.model.kind === "XGBOOST" ? prediction.model.calibrationResidualQuantiles : undefined;
  const goalProbability = probabilityFromForecast({ point: predictedAtGoalDate, low, high, residualQuantiles, thresholdTime: goal.targetTime });
  const qualifyingProbability = goal.qualifyingTime === null || goal.qualifyingTime === undefined
    ? undefined
    : probabilityFromForecast({ point: predictedAtGoalDate, low, high, residualQuantiles, thresholdTime: goal.qualifyingTime });
  const likelihood = goalProbability.probability >= 70 ? "High" : goalProbability.probability >= 35 ? "Medium" : "Low";
  const feasibility = goalProbability.probability >= 65 ? "On track" : goalProbability.probability >= 30 ? "Within reach" : "Stretch goal";

  return {
    event: goal.event,
    course: goal.course,
    currentTime: best.timeSeconds,
    targetTime: goal.targetTime,
    qualifyingTime: goal.qualifyingTime,
    targetDate: goal.targetDate,
    weeksRemaining: round(weeksRemaining, 1),
    requiredWeeklyImprovement: round(requiredTotalImprovement / weeksRemaining, 2),
    requiredMonthlyImprovement: round(requiredTotalImprovement / monthsRemaining, 2),
    currentMonthlyPace,
    predictedAtGoalDate,
    likelihood,
    goalProbability,
    qualifyingProbability,
    confidence: round(confidence, 1),
    paceGap: round(requiredTotalImprovement / monthsRemaining - currentMonthlyPace, 2),
    feasibility
  };
}

function calculateSwimPowerIndex(rankings: EventRanking[]): SwimPowerIndex {
  const strongest = rankings[0];
  const averageConsistency =
    rankings.reduce((sum, ranking) => sum + ranking.consistencyScore, 0) / rankings.length;
  const averageTrend = rankings.reduce((sum, ranking) => sum + ranking.trendScore, 0) / rankings.length;
  const bestImprovement = Math.max(...rankings.map((ranking) => ranking.improvementPercent));
  const improvementComponent = bestImprovement > 0 ? improvementScore(bestImprovement) : 58;
  const score = round(
    strongest.performanceScore * 0.58 +
      improvementComponent * 0.12 +
      averageConsistency * 0.16 +
      averageTrend * 0.14,
    1
  );

  if (score >= 88) {
    return { score, level: "National Level" };
  }

  if (score >= 76) {
    return { score, level: "Elite" };
  }

  if (score >= 56) {
    return { score, level: "Competitive" };
  }

  if (score >= 34) {
    return { score, level: "Developing" };
  }

  return { score, level: "Beginner" };
}

function strokeForEvent(event: SwimEvent): StrokeSpecialty["stroke"] {
  if (event.includes("Butterfly")) return "Butterfly";
  if (event.includes("Backstroke")) return "Backstroke";
  if (event.includes("Breaststroke")) return "Breaststroke";
  if (event.includes("IM")) return "IM";
  return "Freestyle";
}

function calculateSpecialtyProfile(rankings: EventRanking[]): StrokeSpecialty[] {
  const strokes: StrokeSpecialty["stroke"][] = ["Freestyle", "Butterfly", "Backstroke", "Breaststroke", "IM"];

  return strokes.map((stroke) => {
    const strokeRankings = rankings.filter((ranking) => strokeForEvent(ranking.event) === stroke);
    const score = strokeRankings.length
      ? round(strokeRankings.reduce((sum, ranking) => sum + ranking.score, 0) / strokeRankings.length, 1)
      : 0;

    return {
      stroke,
      score,
      eventCount: strokeRankings.length
    };
  });
}

export function buildDashboardAnalytics(
  swims: SwimResult[],
  goal?: Goal,
  workouts: GymWorkout[] = [],
  rawProfile: PredictionProfile | number | null = {},
  releaseContext: PredictionReleaseContext = {}
): DashboardAnalytics {
  const profile = normalizePredictionProfile(rawProfile);
  const trainingSignal = calculateTrainingLoadSignal(workouts);
  const officialSwims = swims.filter(isOfficialResult);

  if (!officialSwims.length) {
    return {
      overview: {
        totalSwims: swims.length,
        personalBestCount: 0,
        bestEvent: undefined,
        mostImprovedEvent: undefined,
        weeklyImprovement: 0,
        monthlyImprovement: 0,
        yearlyImprovement: 0
      },
      personalBests: [],
      rankings: [],
      strongestEvents: [],
      weakestEvents: [],
      predictions: [],
      goalProjection: undefined,
      swimPowerIndex: { score: 0, level: "Beginner" },
      specialtyProfile: calculateSpecialtyProfile([]),
      trainingLoad: {
        weeklyLoad: trainingSignal.weeklyLoad,
        sessionsLast28Days: trainingSignal.sessionsLast28Days,
        loadRatio: trainingSignal.loadRatio,
        label: trainingSignal.label
      }
    };
  }

  const rankings = rankEvents(officialSwims, profile.age);
  const personalBests = getPersonalBests(officialSwims);
  const mostImproved = [...rankings].sort((a, b) => b.improvementPercent - a.improvementPercent)[0];
  const predictions = generatePredictions(swims, workouts, profile, goal, releaseContext);
  const goalPrediction = goal ? predictions.find((prediction) => prediction.event === goal.event && prediction.course === goal.course) : undefined;

  return {
    overview: {
      totalSwims: swims.length,
      personalBestCount: personalBests.length,
      bestEvent: rankings[0].event,
      mostImprovedEvent: mostImproved.event,
      weeklyImprovement: averageWindowImprovement(officialSwims, 7),
      monthlyImprovement: averageWindowImprovement(officialSwims, 30),
      yearlyImprovement: averageWindowImprovement(officialSwims, 365)
    },
    personalBests,
    rankings,
    strongestEvents: rankings.slice(0, 3),
    weakestEvents: rankings.slice(-3).reverse(),
    predictions,
    goalProjection: goal && officialSwims.some((swim) => swim.event === goal.event && swim.course === goal.course) ? calculateGoalProjection(officialSwims, goal, goalPrediction) : undefined,
    swimPowerIndex: calculateSwimPowerIndex(rankings),
    specialtyProfile: calculateSpecialtyProfile(rankings),
    trainingLoad: {
      weeklyLoad: trainingSignal.weeklyLoad,
      sessionsLast28Days: trainingSignal.sessionsLast28Days,
      loadRatio: trainingSignal.loadRatio,
      label: trainingSignal.label
    }
  };
}
