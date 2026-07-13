import type {
  PredictionContribution,
  PredictionExplanation,
  PredictionProbabilitySet,
  ProbabilityEstimate
} from "@/types/swim";
import { clamp, round } from "@/lib/utils";

const centralEightyPercentZ = 1.281551565545;

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function probabilityFromForecast({
  high,
  low,
  point,
  residualQuantiles,
  thresholdTime
}: {
  high: number;
  low: number;
  point: number;
  residualQuantiles?: { probability: number; residual: number }[];
  thresholdTime: number;
}): ProbabilityEstimate {
  const empiricalResiduals = Boolean(residualQuantiles && residualQuantiles.length >= 2);
  const residualThreshold = thresholdTime - point;
  let rawProbability: number;
  if (residualQuantiles && residualQuantiles.length >= 2) {
    const sorted = [...residualQuantiles].sort((a, b) => a.residual - b.residual);
    if (residualThreshold <= sorted[0].residual) rawProbability = sorted[0].probability * 100;
    else if (residualThreshold >= sorted[sorted.length - 1].residual) rawProbability = sorted[sorted.length - 1].probability * 100;
    else {
      const endIndex = sorted.findIndex((quantile) => quantile.residual >= residualThreshold);
      const start = sorted[endIndex - 1];
      const end = sorted[endIndex];
      const progress = (residualThreshold - start.residual) / Math.max(end.residual - start.residual, 1e-9);
      rawProbability = (start.probability + (end.probability - start.probability) * progress) * 100;
    }
  } else {
    const halfWidth = Math.max(point - low, high - point, 0.05);
    const standardDeviation = Math.max(halfWidth / centralEightyPercentZ, 0.04);
    rawProbability = normalCdf(residualThreshold / standardDeviation) * 100;
  }
  const bounds = empiricalResiduals ? [1, 99] : [3, 97];

  return {
    thresholdTime,
    probability: round(clamp(rawProbability, bounds[0], bounds[1]), 1),
    method: empiricalResiduals ? "EMPIRICAL_RESIDUAL" : "ESTIMATED_RANGE",
    calibration: empiricalResiduals ? "Validated" : "Provisional"
  };
}

export function buildProbabilitySet({
  goalTime,
  high,
  low,
  pbTime,
  point,
  qualifyingTime,
  residualQuantiles
}: {
  goalTime?: number | null;
  high: number;
  low: number;
  pbTime: number;
  point: number;
  qualifyingTime?: number | null;
  residualQuantiles?: { probability: number; residual: number }[];
}): PredictionProbabilitySet {
  return {
    pb: probabilityFromForecast({ high, low, point, residualQuantiles, thresholdTime: pbTime }),
    goal: goalTime === null || goalTime === undefined
      ? undefined
      : probabilityFromForecast({ high, low, point, residualQuantiles, thresholdTime: goalTime }),
    qualifying: qualifyingTime === null || qualifyingTime === undefined
      ? undefined
      : probabilityFromForecast({ high, low, point, residualQuantiles, thresholdTime: qualifyingTime })
  };
}

function contributionDirection(secondsImpact: number): PredictionContribution["direction"] {
  if (secondsImpact < -0.0005) return "faster";
  if (secondsImpact > 0.0005) return "slower";
  return "neutral";
}

function contributionGroup(feature: string) {
  if (/^(time_lag_|best_|mean_|latest_time)/.test(feature)) return "Race history and recent PB";
  if (/^(days_ago_|days_since_last_race|forecast_days)/.test(feature)) return "Race recency";
  if (/^slope_/.test(feature)) return "Recent trend";
  if (/^std_/.test(feature)) return "Performance consistency";
  if (/^(age|sex_)/.test(feature)) return "Age and performance category";
  if (feature === "taper_days") return "Taper duration";
  if (feature === "swim_sessions_per_week") return "Training frequency";
  if (feature === "history_count") return "Evidence volume";
  return "Other model inputs";
}

function toContribution(label: string, secondsImpact: number, detail: string): PredictionContribution {
  return {
    label,
    secondsImpact: round(secondsImpact, 4),
    direction: contributionDirection(secondsImpact),
    detail
  };
}

export function buildTreeShapExplanation({
  expectedValue,
  featureContributions,
  finalTime,
  rawPredictedTime
}: {
  expectedValue: number;
  featureContributions: Record<string, number>;
  finalTime: number;
  rawPredictedTime: number;
}): PredictionExplanation {
  const grouped = new Map<string, number>();
  for (const [feature, contribution] of Object.entries(featureContributions)) {
    const label = contributionGroup(feature);
    grouped.set(label, (grouped.get(label) ?? 0) + contribution);
  }
  const guardrailImpact = finalTime - rawPredictedTime;
  if (Math.abs(guardrailImpact) > 0.0005) grouped.set("Safety guardrail", guardrailImpact);
  const contributions = [...grouped.entries()]
    .map(([label, impact]) => toContribution(label, impact, "Exact TreeSHAP contribution for this forecast."))
    .filter((contribution) => Math.abs(contribution.secondsImpact) >= 0.0005)
    .sort((a, b) => Math.abs(b.secondsImpact) - Math.abs(a.secondsImpact));
  const explained = expectedValue + contributions.reduce((sum, contribution) => sum + contribution.secondsImpact, 0);

  return {
    method: "TREE_SHAP",
    baseTime: round(expectedValue, 4),
    predictedTime: finalTime,
    contributions,
    additiveResidual: round(finalTime - explained, 4),
    disclaimer: "Contributions explain this model output. They describe model associations, not proof of causation."
  };
}

export function buildDeterministicExplanation({
  baseTime,
  components,
  finalTime
}: {
  baseTime: number;
  components: { label: string; secondsImpact: number }[];
  finalTime: number;
}): PredictionExplanation {
  const contributions = components
    .map((component) => toContribution(component.label, component.secondsImpact, "Deterministic contribution from the conservative forecast."))
    .filter((contribution) => Math.abs(contribution.secondsImpact) >= 0.0005)
    .sort((a, b) => Math.abs(b.secondsImpact) - Math.abs(a.secondsImpact));
  const explained = baseTime + contributions.reduce((sum, contribution) => sum + contribution.secondsImpact, 0);

  return {
    method: "DETERMINISTIC_DECOMPOSITION",
    baseTime,
    predictedTime: finalTime,
    contributions,
    additiveResidual: round(finalTime - explained, 4),
    disclaimer: "Contributions show how the conservative formula changed the forecast. They are associations, not causal effects."
  };
}

export function interpolateExplanation(
  start: PredictionExplanation,
  end: PredictionExplanation,
  progress: number,
  predictedTime: number
): PredictionExplanation {
  const labels = new Set([...start.contributions.map((item) => item.label), ...end.contributions.map((item) => item.label)]);
  const contributions = [...labels].map((label) => {
    const startImpact = start.contributions.find((item) => item.label === label)?.secondsImpact ?? 0;
    const endImpact = end.contributions.find((item) => item.label === label)?.secondsImpact ?? 0;
    const secondsImpact = startImpact + (endImpact - startImpact) * progress;
    return toContribution(label, secondsImpact, start.contributions.find((item) => item.label === label)?.detail ?? end.contributions.find((item) => item.label === label)?.detail ?? "");
  }).filter((item) => Math.abs(item.secondsImpact) >= 0.0005).sort((a, b) => Math.abs(b.secondsImpact) - Math.abs(a.secondsImpact));
  const baseTime = start.baseTime + (end.baseTime - start.baseTime) * progress;
  const explained = baseTime + contributions.reduce((sum, contribution) => sum + contribution.secondsImpact, 0);

  return {
    method: start.method === end.method ? start.method : "DETERMINISTIC_DECOMPOSITION",
    baseTime: round(baseTime, 4),
    predictedTime,
    contributions,
    additiveResidual: round(predictedTime - explained, 4),
    disclaimer: start.disclaimer
  };
}
