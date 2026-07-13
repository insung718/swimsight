import type { Course, PredictionProfile, SwimResult } from "@/types/swim";
import { dateToDays, round } from "@/lib/utils";

const raceHistorySize = 20;

const lagFeatureNames = Array.from({ length: raceHistorySize }, (_, index) => `time_lag_${index + 1}`);
const recencyFeatureNames = Array.from({ length: raceHistorySize }, (_, index) => `days_ago_lag_${index + 1}`);

export const hundredFreeFeatureNames = [
  ...lagFeatureNames,
  ...recencyFeatureNames,
  "history_count",
  "forecast_days",
  "latest_time",
  "days_since_last_race",
  "best_3",
  "mean_3",
  "best_5",
  "mean_5",
  "std_5",
  "slope_5",
  "best_10",
  "mean_10",
  "std_10",
  "slope_10",
  "best_20",
  "mean_20",
  "std_20",
  "slope_20",
  "age",
  "sex_female",
  "sex_male",
  "taper_days",
  "swim_sessions_per_week"
] as const;

export type HundredFreeFeatureName = (typeof hundredFreeFeatureNames)[number];
export type HundredFreeFeatureVector = Record<HundredFreeFeatureName, number | null>;

export interface HundredFreeFeatures {
  course: Course;
  targetDate: string;
  history: SwimResult[];
  vector: HundredFreeFeatureVector;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = mean(values) ?? 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function slopePerDay(swims: SwimResult[]) {
  if (swims.length < 2) return null;
  const firstDay = dateToDays(swims[0].date);
  const points = swims.map((swim) => ({ x: dateToDays(swim.date) - firstDay, y: swim.timeSeconds }));
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX ** 2;
  return denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
}

function windowFeatures(history: SwimResult[], size: 3 | 5 | 10 | 20) {
  const window = history.slice(-size);
  const times = window.map((swim) => swim.timeSeconds);
  return {
    best: times.length ? Math.min(...times) : null,
    mean: mean(times),
    std: standardDeviation(times),
    slope: slopePerDay(window)
  };
}

export function buildHundredFreeFeatures({
  course,
  profile,
  swims,
  targetDate
}: {
  course: Course;
  profile: PredictionProfile;
  swims: SwimResult[];
  targetDate: string;
}): HundredFreeFeatures | null {
  if (new Set(swims.map((swim) => swim.userId)).size > 1) return null;
  const targetDay = dateToDays(targetDate);
  const history = swims
    .filter((swim) => swim.event === "100 Freestyle" && swim.course === course && dateToDays(swim.date) < targetDay)
    .sort((a, b) => dateToDays(a.date) - dateToDays(b.date))
    .slice(-raceHistorySize);

  if (!history.length) return null;

  const latest = history[history.length - 1];
  const latestDay = dateToDays(latest.date);
  const reverseHistory = [...history].reverse();
  const windows = {
    3: windowFeatures(history, 3),
    5: windowFeatures(history, 5),
    10: windowFeatures(history, 10),
    20: windowFeatures(history, 20)
  };
  const vector = {} as HundredFreeFeatureVector;

  lagFeatureNames.forEach((feature, index) => {
    vector[feature as HundredFreeFeatureName] = reverseHistory[index]?.timeSeconds ?? null;
  });
  recencyFeatureNames.forEach((feature, index) => {
    const race = reverseHistory[index];
    vector[feature as HundredFreeFeatureName] = race ? targetDay - dateToDays(race.date) : null;
  });

  Object.assign(vector, {
    history_count: history.length,
    forecast_days: Math.max(1, targetDay - latestDay),
    latest_time: latest.timeSeconds,
    days_since_last_race: Math.max(1, targetDay - latestDay),
    best_3: windows[3].best,
    mean_3: windows[3].mean,
    best_5: windows[5].best,
    mean_5: windows[5].mean,
    std_5: windows[5].std,
    slope_5: windows[5].slope,
    best_10: windows[10].best,
    mean_10: windows[10].mean,
    std_10: windows[10].std,
    slope_10: windows[10].slope,
    best_20: windows[20].best,
    mean_20: windows[20].mean,
    std_20: windows[20].std,
    slope_20: windows[20].slope,
    age: profile.age ?? null,
    sex_female: profile.sex === "FEMALE" ? 1 : profile.sex === "MALE" ? 0 : null,
    sex_male: profile.sex === "MALE" ? 1 : profile.sex === "FEMALE" ? 0 : null,
    taper_days: profile.taperDays ?? null,
    swim_sessions_per_week: profile.swimSessionsPerWeek ?? null
  });

  for (const key of hundredFreeFeatureNames) {
    const value = vector[key];
    vector[key] = value === null ? null : round(value, 6);
  }

  return { course, targetDate, history, vector };
}

export function hundredFreeDataSufficiency(features: HundredFreeFeatures) {
  const profileComplete = features.vector.age !== null && features.vector.sex_female !== null && features.vector.taper_days !== null && features.vector.swim_sessions_per_week !== null;
  if (features.history.length >= 10 && profileComplete) return "High" as const;
  if (features.history.length >= 4 && features.vector.age !== null) return "Moderate" as const;
  return "Low" as const;
}
