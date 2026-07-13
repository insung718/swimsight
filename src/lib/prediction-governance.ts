import type { Course, PredictionProfile, SwimEvent, SwimResult } from "@/types/swim";
import { clamp, dateToDays, round } from "@/lib/utils";

export const DATA_QUALITY_ASSESSMENT_VERSION = "prediction-quality-v3.0.0";
export const DEFAULT_MONITORING_MIN_SAMPLE = 30;

export function validateTemporalFold({
  examples,
  trainingTargetDates,
  validationTargetDates
}: {
  examples: { targetDate: string; featureAsOf: string; targetAthleteId: string; historyAthleteIds: string[] }[];
  trainingTargetDates: string[];
  validationTargetDates: string[];
}) {
  const reasons: string[] = [];
  const trainingEnd = [...trainingTargetDates].sort().at(-1);
  const validationStart = [...validationTargetDates].sort()[0];
  if (!trainingEnd || !validationStart || trainingEnd >= validationStart) reasons.push("TRAINING_VALIDATION_DATE_OVERLAP");
  for (const example of examples) {
    if (example.featureAsOf >= example.targetDate) reasons.push("FEATURE_TIMESTAMP_NOT_BEFORE_TARGET");
    if (example.historyAthleteIds.some((athleteId) => athleteId !== example.targetAthleteId)) reasons.push("ATHLETE_HISTORY_LEAKAGE");
  }
  return { passed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export type PredictionEligibilityDecision =
  | "FULL_PREDICTION"
  | "CONSERVATIVE_ESTIMATE"
  | "PROVISIONAL_ONLY"
  | "NO_PREDICTION";

export interface DataQualityReason {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
}

export interface DataQualityAssessment {
  version: string;
  score: number;
  level: "High" | "Moderate" | "Low" | "Insufficient";
  decision: PredictionEligibilityDecision;
  eligibleRaceCount: number;
  convertedRaceCount: number;
  duplicateRiskCount: number;
  anomalousRecordCount: number;
  futureDatedRecordCount: number;
  daysSinceLatestRace: number | null;
  reasons: DataQualityReason[];
  userExplanation: string;
}

function isEligibleRace(swim: SwimResult, event: SwimEvent, course: Course) {
  return swim.event === event
    && swim.course === course
    && (swim.resultKind ?? "OFFICIAL") === "OFFICIAL"
    && (swim.raceType ?? "INDIVIDUAL") === "INDIVIDUAL";
}

function duplicateRiskCount(swims: SwimResult[]) {
  const keys = new Set<string>();
  let duplicates = 0;
  for (const swim of swims) {
    const key = `${swim.date}:${swim.event}:${swim.course}:${swim.timeSeconds.toFixed(2)}`;
    if (keys.has(key)) duplicates += 1;
    keys.add(key);
  }
  return duplicates;
}

function isAnomalous(swim: SwimResult) {
  if (!Number.isFinite(swim.timeSeconds) || swim.timeSeconds <= 0 || swim.timeSeconds > 7_200) return true;
  const distance = Number(swim.event.split(" ")[0]);
  if (!Number.isFinite(distance)) return false;
  const minimumByDistance = Math.max(8, distance * 0.16);
  return swim.timeSeconds < minimumByDistance;
}

export function assessPredictionDataQuality({
  course,
  event,
  now = new Date().toISOString().slice(0, 10),
  profile,
  swims
}: {
  course: Course;
  event: SwimEvent;
  now?: string;
  profile: PredictionProfile;
  swims: SwimResult[];
}): DataQualityAssessment {
  const eventResults = swims.filter((swim) => swim.event === event);
  const courseResults = eventResults.filter((swim) => swim.course === course);
  const eligible = courseResults.filter((swim) => isEligibleRace(swim, event, course)).sort((a, b) => a.date.localeCompare(b.date));
  const convertedRaceCount = courseResults.filter((swim) => swim.raceType === "CONVERTED").length;
  const duplicates = duplicateRiskCount(courseResults);
  const anomalies = courseResults.filter(isAnomalous).length;
  const futureDatedRecordCount = courseResults.filter((swim) => swim.date > now).length;
  const trainingOnlyCount = courseResults.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "TRAINING").length;
  const latest = eligible[eligible.length - 1];
  const daysSinceLatestRace = latest ? Math.max(0, dateToDays(now) - dateToDays(latest.date)) : null;
  const reasons: DataQualityReason[] = [];
  let score = 100;

  if (!eligible.length) {
    score -= 75;
    reasons.push({ code: "NO_ELIGIBLE_OFFICIAL_RACES", severity: "BLOCKING", message: "No official individual race is available for this event and course." });
  } else if (eligible.length < 3) {
    score -= 32;
    reasons.push({ code: "VERY_SPARSE_EVENT_HISTORY", severity: "WARNING", message: eligible.length === 1 ? "Only one eligible race is available." : `Only ${eligible.length} eligible races are available.` });
  } else if (eligible.length < 5) {
    score -= 18;
    reasons.push({ code: "SPARSE_EVENT_HISTORY", severity: "WARNING", message: `Only ${eligible.length} eligible races are available.` });
  } else if (eligible.length < 10) {
    score -= 7;
    reasons.push({ code: "LIMITED_EVENT_HISTORY", severity: "INFO", message: `${eligible.length} eligible races support this estimate.` });
  }

  if (daysSinceLatestRace !== null && daysSinceLatestRace > 365) {
    score -= 24;
    reasons.push({ code: "STALE_OVER_ONE_YEAR", severity: "WARNING", message: "The latest eligible race is more than one year old." });
  } else if (daysSinceLatestRace !== null && daysSinceLatestRace > 180) {
    score -= 14;
    reasons.push({ code: "STALE_OVER_SIX_MONTHS", severity: "WARNING", message: "The latest eligible race is more than six months old." });
  } else if (daysSinceLatestRace !== null && daysSinceLatestRace > 90) {
    score -= 6;
    reasons.push({ code: "LIMITED_RECENCY", severity: "INFO", message: "No eligible race has been recorded in the last 90 days." });
  }

  if (convertedRaceCount) {
    score -= Math.min(20, convertedRaceCount * 5);
    reasons.push({ code: "CONVERSION_DEPENDENCE", severity: "WARNING", message: `${convertedRaceCount} converted result${convertedRaceCount === 1 ? "" : "s"} are excluded from direct model evidence.` });
  }
  if (duplicates) {
    score -= Math.min(25, duplicates * 10);
    reasons.push({ code: "DUPLICATE_IDENTITY_RISK", severity: "WARNING", message: `${duplicates} potential duplicate result${duplicates === 1 ? "" : "s"} require review.` });
  }
  if (anomalies) {
    score -= Math.min(45, anomalies * 20);
    reasons.push({ code: "ANOMALOUS_RECORD", severity: "BLOCKING", message: `${anomalies} implausible result${anomalies === 1 ? "" : "s"} were detected.` });
  }
  if (futureDatedRecordCount) {
    score -= Math.min(60, futureDatedRecordCount * 30);
    reasons.push({ code: "FUTURE_DATED_RESULT", severity: "BLOCKING", message: `${futureDatedRecordCount} result${futureDatedRecordCount === 1 ? " is" : "s are"} dated after the assessment cutoff.` });
  }
  if (trainingOnlyCount && !eligible.length) {
    reasons.push({ code: "TRAINING_RESULTS_NOT_ELIGIBLE", severity: "INFO", message: "Training results remain visible in personal analytics but are not official prediction labels." });
  }

  const otherCourseCount = eventResults.filter((swim) => swim.course !== course && (swim.resultKind ?? "OFFICIAL") === "OFFICIAL").length;
  if (eligible.length < 3 && otherCourseCount > eligible.length) {
    score -= 8;
    reasons.push({ code: "COURSE_HISTORY_MISMATCH", severity: "WARNING", message: "Most event history comes from another course and is not treated as equivalent." });
  }
  if (!profile.age) {
    score -= 8;
    reasons.push({ code: "MISSING_AGE", severity: "WARNING", message: "Age is missing." });
  }
  if (!profile.sex) {
    score -= 8;
    reasons.push({ code: "MISSING_PERFORMANCE_CATEGORY", severity: "WARNING", message: "Performance category is missing." });
  }
  if (profile.taperDays === null || profile.taperDays === undefined) {
    score -= 4;
    reasons.push({ code: "MISSING_TAPER_CONTEXT", severity: "INFO", message: "Recent taper context is unavailable." });
  }
  if (profile.swimSessionsPerWeek === null || profile.swimSessionsPerWeek === undefined) {
    score -= 4;
    reasons.push({ code: "MISSING_TRAINING_FREQUENCY", severity: "INFO", message: "Weekly swim frequency is unavailable." });
  }

  score = Math.round(clamp(score, 0, 100));
  const hasBlockingAnomaly = anomalies > 0 || futureDatedRecordCount > 0;
  const decision: PredictionEligibilityDecision = !eligible.length || score < 25 || hasBlockingAnomaly
    ? "NO_PREDICTION"
    : score >= 75 && eligible.length >= 4
      ? "FULL_PREDICTION"
      : score >= 50
        ? "CONSERVATIVE_ESTIMATE"
        : "PROVISIONAL_ONLY";
  const level = score >= 80 ? "High" : score >= 60 ? "Moderate" : score >= 35 ? "Low" : "Insufficient";
  if (!reasons.length) reasons.push({ code: "SUFFICIENT_DIRECT_HISTORY", severity: "INFO", message: "Recent direct official race history is available." });

  const userExplanation = decision === "FULL_PREDICTION"
    ? "Recent eligible official races support a full prediction."
    : decision === "CONSERVATIVE_ESTIMATE"
      ? "A conservative estimate is shown because the available evidence is incomplete."
      : decision === "PROVISIONAL_ONLY"
        ? "Only a provisional estimate is shown; add recent official results and profile context to improve reliability."
        : "A prediction is withheld because the available data does not meet minimum reliability rules.";

  return {
    version: DATA_QUALITY_ASSESSMENT_VERSION,
    score,
    level,
    decision,
    eligibleRaceCount: eligible.length,
    convertedRaceCount,
    duplicateRiskCount: duplicates,
    anomalousRecordCount: anomalies,
    futureDatedRecordCount,
    daysSinceLatestRace,
    reasons,
    userExplanation
  };
}

export function buildActionablePredictionInsights(swims: SwimResult[], profile: PredictionProfile) {
  const sorted = [...swims].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-3);
  const previous = sorted.slice(-6, -3);
  const observed: string[] = [];
  const inferred: string[] = [];
  const userReported: string[] = [];
  const notMeasurable = [
    "Start, turn, split, and stroke-rate data are not available.",
    "Race times alone cannot identify a specific training intervention or expected gain."
  ];

  if (recent.length >= 2) {
    const recentAverage = recent.reduce((sum, swim) => sum + swim.timeSeconds, 0) / recent.length;
    const spread = Math.max(...recent.map((swim) => swim.timeSeconds)) - Math.min(...recent.map((swim) => swim.timeSeconds));
    observed.push(`The latest ${recent.length} official races average ${round(recentAverage, 2)} seconds with a ${round(spread, 2)}-second spread.`);
    if (spread > recentAverage * 0.04) inferred.push("Recent race-to-race variability reduces forecast precision; the cause is not identifiable from finish times alone.");
  }
  if (previous.length && recent.length) {
    const recentAverage = meanValues(recent.map((swim) => swim.timeSeconds));
    const previousAverage = meanValues(previous.map((swim) => swim.timeSeconds));
    const difference = recentAverage - previousAverage;
    observed.push(`The recent average is ${round(Math.abs(difference), 2)} seconds ${difference <= 0 ? "faster" : "slower"} than the preceding comparable races.`);
    inferred.push(difference <= 0
      ? "The recent direction is consistent with improvement, but it does not establish which training factor caused it."
      : "The recent direction may reflect normal variation, fatigue, illness, taper, or race conditions; more context is required.");
  }
  if (profile.taperDays !== null && profile.taperDays !== undefined) userReported.push(`Reported taper duration: ${profile.taperDays} days.`);
  if (profile.swimSessionsPerWeek !== null && profile.swimSessionsPerWeek !== undefined) userReported.push(`Reported swim frequency: ${profile.swimSessionsPerWeek} sessions per week.`);
  if (!userReported.length) userReported.push("No taper or weekly training context has been reported.");

  return { observed, inferred, userReported, notMeasurable };
}

function meanValues(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export interface ReleaseMetrics {
  mae: number;
  medianAbsoluteError: number;
  rmse: number;
  brierScore: number;
  calibrationError: number;
  intervalCoverage: number;
  sampleSize: number;
}

export interface SubgroupReleaseMetrics extends ReleaseMetrics {
  key: string;
  dimension: "event" | "ageBand" | "category" | "course" | "horizon";
}

export interface ReleaseCandidate {
  modelVersion: string;
  metrics: ReleaseMetrics;
  subgroups: SubgroupReleaseMetrics[];
}

export interface ReleaseGateConfig {
  minSampleSize: number;
  minSubgroupSampleSize: number;
  maxErrorRegressionRatio: number;
  maxSubgroupMaeRegressionRatio: number;
  maxCoverageRegression: number;
  minimumCoverage: number;
  requiredBaselineImprovementRatio: number;
}

export const DEFAULT_RELEASE_GATES: ReleaseGateConfig = {
  minSampleSize: 100,
  minSubgroupSampleSize: 20,
  maxErrorRegressionRatio: 0,
  maxSubgroupMaeRegressionRatio: 0.05,
  maxCoverageRegression: 0.03,
  minimumCoverage: 0.7,
  requiredBaselineImprovementRatio: 0.02
};

export const REQUIRED_RELEASE_SUBGROUP_DIMENSIONS: SubgroupReleaseMetrics["dimension"][] = [
  "event",
  "ageBand",
  "category",
  "course",
  "horizon"
];

export interface ReleaseGateDecision {
  passed: boolean;
  reasons: string[];
  checks: { name: string; passed: boolean; detail: string }[];
}

function finiteMetrics(metrics: ReleaseMetrics) {
  return [metrics.mae, metrics.medianAbsoluteError, metrics.rmse, metrics.brierScore, metrics.calibrationError, metrics.intervalCoverage, metrics.sampleSize]
    .every((value) => Number.isFinite(value))
    && metrics.mae >= 0
    && metrics.medianAbsoluteError >= 0
    && metrics.rmse >= 0
    && metrics.brierScore >= 0
    && metrics.brierScore <= 1
    && metrics.calibrationError >= 0
    && metrics.calibrationError <= 1
    && metrics.intervalCoverage >= 0
    && metrics.intervalCoverage <= 1
    && Number.isInteger(metrics.sampleSize)
    && metrics.sampleSize >= 0;
}

export function evaluateReleaseCandidate({
  baselines,
  candidate,
  champion,
  config = DEFAULT_RELEASE_GATES
}: {
  baselines: Record<string, ReleaseMetrics>;
  candidate: ReleaseCandidate;
  champion: ReleaseCandidate;
  config?: ReleaseGateConfig;
}): ReleaseGateDecision {
  const checks: ReleaseGateDecision["checks"] = [];
  const add = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });
  add("finite-metrics", finiteMetrics(candidate.metrics), "Candidate metrics must all be finite.");
  add("champion-finite-metrics", finiteMetrics(champion.metrics), "Champion metrics must all be finite.");
  add("minimum-sample", candidate.metrics.sampleSize >= config.minSampleSize, `${candidate.metrics.sampleSize} evaluated predictions; ${config.minSampleSize} required.`);
  add("champion-minimum-sample", champion.metrics.sampleSize >= config.minSampleSize, `${champion.metrics.sampleSize} champion observations; ${config.minSampleSize} required before a defensible comparison.`);

  for (const requiredBaseline of ["last-race", "last-three", "linear-trend", "conservative-deterministic"]) {
    add(`required-baseline-${requiredBaseline}`, Boolean(baselines[requiredBaseline]), `${requiredBaseline} metrics must be present.`);
  }

  for (const metric of ["mae", "medianAbsoluteError", "rmse", "brierScore", "calibrationError"] as const) {
    const limit = champion.metrics[metric] * (1 + config.maxErrorRegressionRatio);
    add(`champion-${metric}`, candidate.metrics[metric] <= limit, `${candidate.metrics[metric]} candidate versus ${champion.metrics[metric]} champion.`);
  }
  add(
    "interval-coverage",
    candidate.metrics.intervalCoverage >= config.minimumCoverage
      && candidate.metrics.intervalCoverage >= champion.metrics.intervalCoverage - config.maxCoverageRegression,
    `${candidate.metrics.intervalCoverage} candidate versus ${champion.metrics.intervalCoverage} champion.`
  );

  for (const [name, baseline] of Object.entries(baselines)) {
    add(`baseline-${name}-finite-metrics`, finiteMetrics(baseline), `${name} baseline metrics must be finite and within valid ranges.`);
    if (!finiteMetrics(baseline)) continue;
    for (const metric of ["mae", "medianAbsoluteError", "rmse"] as const) {
      const required = baseline[metric] * (1 - config.requiredBaselineImprovementRatio);
      add(`baseline-${name}-${metric}`, candidate.metrics[metric] <= required, `${candidate.metrics[metric]} candidate ${metric} versus required ${round(required, 4)} from ${name}.`);
    }
  }

  const subgroupKey = (subgroup: SubgroupReleaseMetrics) => `${subgroup.dimension}:${subgroup.key}`;
  const candidateKeys = candidate.subgroups.map(subgroupKey);
  const championKeys = champion.subgroups.map(subgroupKey);
  add("candidate-subgroup-keys-unique", new Set(candidateKeys).size === candidateKeys.length, "Candidate subgroup keys must be unique.");
  add("champion-subgroup-keys-unique", new Set(championKeys).size === championKeys.length, "Champion subgroup keys must be unique.");

  const candidateSubgroups = new Map(candidate.subgroups.map((subgroup) => [subgroupKey(subgroup), subgroup]));
  const championSubgroups = new Map(champion.subgroups.map((subgroup) => [subgroupKey(subgroup), subgroup]));
  for (const dimension of REQUIRED_RELEASE_SUBGROUP_DIMENSIONS) {
    const candidateCount = candidate.subgroups.filter((subgroup) => subgroup.dimension === dimension && subgroup.sampleSize >= config.minSubgroupSampleSize).length;
    const championCount = champion.subgroups.filter((subgroup) => subgroup.dimension === dimension && subgroup.sampleSize >= config.minSubgroupSampleSize).length;
    add(`candidate-subgroup-coverage-${dimension}`, candidateCount > 0, `${candidateCount} statistically eligible ${dimension} cohort${candidateCount === 1 ? "" : "s"}; at least one required.`);
    add(`champion-subgroup-coverage-${dimension}`, championCount > 0, `${championCount} statistically eligible champion ${dimension} cohort${championCount === 1 ? "" : "s"}; at least one required.`);
  }

  const eligibleSubgroupKeys = new Set([
    ...candidate.subgroups.filter((subgroup) => subgroup.sampleSize >= config.minSubgroupSampleSize).map(subgroupKey),
    ...champion.subgroups.filter((subgroup) => subgroup.sampleSize >= config.minSubgroupSampleSize).map(subgroupKey)
  ]);
  for (const key of eligibleSubgroupKeys) {
    const subgroup = candidateSubgroups.get(key);
    const previous = championSubgroups.get(key);
    add(`candidate-subgroup-present-${key}`, Boolean(subgroup), `Candidate metrics are required for eligible cohort ${key}.`);
    add(`champion-subgroup-present-${key}`, Boolean(previous), `Champion metrics are required for eligible cohort ${key}.`);
    if (!subgroup || !previous) continue;
    add(`subgroup-metrics-${key}`, finiteMetrics(subgroup), "Candidate subgroup metrics must be finite and within valid ranges.");
    add(`champion-subgroup-metrics-${key}`, finiteMetrics(previous), "Champion subgroup metrics must be finite and within valid ranges.");
    if (!finiteMetrics(subgroup) || !finiteMetrics(previous)) continue;
    const passed = (["mae", "medianAbsoluteError", "rmse", "brierScore", "calibrationError"] as const)
      .every((metric) => subgroup[metric] <= previous[metric] * (1 + config.maxSubgroupMaeRegressionRatio))
      && subgroup.intervalCoverage >= previous.intervalCoverage - config.maxCoverageRegression;
    add(
      `subgroup-${key}`,
      passed,
      `${subgroup.sampleSize} candidate and ${previous.sampleSize} champion samples; MAE ${subgroup.mae} versus ${previous.mae}, RMSE ${subgroup.rmse} versus ${previous.rmse}, Brier ${subgroup.brierScore} versus ${previous.brierScore}, coverage ${subgroup.intervalCoverage} versus ${previous.intervalCoverage}.`
    );
  }

  const reasons = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`);
  return { passed: reasons.length === 0, reasons, checks };
}

export interface MonitoringObservation {
  predictedTime: number;
  actualTime?: number | null;
  withinInterval?: boolean | null;
  probability?: number | null;
  outcome?: boolean | null;
  probabilityPairs?: { probability: number; outcome: boolean }[];
  features: Record<string, number | null | undefined>;
}

export interface DriftReport {
  status: "INSUFFICIENT_DATA" | "STABLE" | "WARNING" | "CRITICAL";
  sampleSize: number;
  baselineSize: number;
  featureDrift: Record<string, number>;
  predictionDrift: number | null;
  residualDrift: number | null;
  coverageDrift: number | null;
  calibrationDrift: number | null;
  uncertainty: {
    recentStandardError: number | null;
    baselineStandardError: number | null;
    recentCoverageMargin: number | null;
    baselineCoverageMargin: number | null;
  };
  recommendation: string;
  evidence: string[];
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function brier(rows: MonitoringObservation[], minSample: number) {
  const valid = rows.flatMap((row) => row.probabilityPairs?.length
    ? row.probabilityPairs
    : typeof row.probability === "number" && typeof row.outcome === "boolean"
      ? [{ probability: row.probability, outcome: row.outcome }]
      : []);
  return valid.length >= minSample ? mean(valid.map((row) => (row.probability / 100 - (row.outcome ? 1 : 0)) ** 2)) : null;
}

export function calculateDriftReport(
  baseline: MonitoringObservation[],
  recent: MonitoringObservation[],
  minSample = DEFAULT_MONITORING_MIN_SAMPLE
): DriftReport {
  if (baseline.length < minSample || recent.length < minSample) {
    return {
      status: "INSUFFICIENT_DATA",
      sampleSize: recent.length,
      baselineSize: baseline.length,
      featureDrift: {},
      predictionDrift: null,
      residualDrift: null,
      coverageDrift: null,
      calibrationDrift: null,
      uncertainty: { recentStandardError: null, baselineStandardError: null, recentCoverageMargin: null, baselineCoverageMargin: null },
      recommendation: "Do not trigger retraining. Collect more evaluated predictions before interpreting drift.",
      evidence: [`At least ${minSample} baseline and recent observations are required.`]
    };
  }

  const featureNames = new Set([...baseline, ...recent].flatMap((row) => Object.keys(row.features)));
  const featureDrift: Record<string, number> = {};
  for (const name of featureNames) {
    const baselineValues = baseline.flatMap((row) => typeof row.features[name] === "number" ? [row.features[name] as number] : []);
    const recentValues = recent.flatMap((row) => typeof row.features[name] === "number" ? [row.features[name] as number] : []);
    if (baselineValues.length < minSample || recentValues.length < minSample) continue;
    const pooledScale = Math.max(standardDeviation(baselineValues), 1e-6);
    featureDrift[name] = round(Math.abs(mean(recentValues) - mean(baselineValues)) / pooledScale, 4);
  }

  const baselinePredictions = baseline.map((row) => row.predictedTime);
  const recentPredictions = recent.map((row) => row.predictedTime);
  const predictionScale = Math.max(standardDeviation(baselinePredictions), 1e-6);
  const predictionDrift = Math.abs(mean(recentPredictions) - mean(baselinePredictions)) / predictionScale;
  const baselineErrors = baseline.flatMap((row) => typeof row.actualTime === "number" ? [Math.abs(row.actualTime - row.predictedTime)] : []);
  const recentErrors = recent.flatMap((row) => typeof row.actualTime === "number" ? [Math.abs(row.actualTime - row.predictedTime)] : []);
  const residualDrift = baselineErrors.length >= minSample && recentErrors.length >= minSample
    ? (mean(recentErrors) - mean(baselineErrors)) / Math.max(mean(baselineErrors), 1e-6)
    : null;
  const baselineCoverage = baseline.filter((row) => typeof row.withinInterval === "boolean");
  const recentCoverage = recent.filter((row) => typeof row.withinInterval === "boolean");
  const coverageDrift = baselineCoverage.length >= minSample && recentCoverage.length >= minSample
    ? mean(recentCoverage.map((row) => row.withinInterval ? 1 : 0)) - mean(baselineCoverage.map((row) => row.withinInterval ? 1 : 0))
    : null;
  const baselineBrier = brier(baseline, minSample);
  const recentBrier = brier(recent, minSample);
  const calibrationDrift = baselineBrier !== null && recentBrier !== null ? recentBrier - baselineBrier : null;
  const evidence: string[] = [];
  const maxFeatureDrift = Math.max(0, ...Object.values(featureDrift));
  if (maxFeatureDrift >= 0.5) evidence.push(`Maximum standardized feature shift is ${round(maxFeatureDrift, 2)}.`);
  if (predictionDrift >= 0.5) evidence.push(`Prediction distribution shift is ${round(predictionDrift, 2)} standard deviations.`);
  if (residualDrift !== null && residualDrift >= 0.15) evidence.push(`Recent MAE is ${round(residualDrift * 100, 1)}% above baseline.`);
  if (coverageDrift !== null && coverageDrift <= -0.08) evidence.push(`Interval coverage fell by ${round(Math.abs(coverageDrift) * 100, 1)} percentage points.`);
  if (calibrationDrift !== null && calibrationDrift >= 0.03) evidence.push(`Brier score worsened by ${round(calibrationDrift, 3)}.`);

  const critical = maxFeatureDrift >= 1 || predictionDrift >= 1 || (residualDrift ?? 0) >= 0.3 || (coverageDrift ?? 0) <= -0.15 || (calibrationDrift ?? 0) >= 0.06;
  const warning = evidence.length > 0;
  const status = critical ? "CRITICAL" : warning ? "WARNING" : "STABLE";
  return {
    status,
    sampleSize: recent.length,
    baselineSize: baseline.length,
    featureDrift,
    predictionDrift: round(predictionDrift, 4),
    residualDrift: residualDrift === null ? null : round(residualDrift, 4),
    coverageDrift: coverageDrift === null ? null : round(coverageDrift, 4),
    calibrationDrift: calibrationDrift === null ? null : round(calibrationDrift, 4),
    uncertainty: {
      recentStandardError: recentErrors.length >= minSample ? round(standardDeviation(recentErrors) / Math.sqrt(recentErrors.length), 4) : null,
      baselineStandardError: baselineErrors.length >= minSample ? round(standardDeviation(baselineErrors) / Math.sqrt(baselineErrors.length), 4) : null,
      recentCoverageMargin: recentCoverage.length >= minSample
        ? round(1.96 * Math.sqrt(mean(recentCoverage.map((row) => row.withinInterval ? 1 : 0)) * (1 - mean(recentCoverage.map((row) => row.withinInterval ? 1 : 0))) / recentCoverage.length), 4)
        : null,
      baselineCoverageMargin: baselineCoverage.length >= minSample
        ? round(1.96 * Math.sqrt(mean(baselineCoverage.map((row) => row.withinInterval ? 1 : 0)) * (1 - mean(baselineCoverage.map((row) => row.withinInterval ? 1 : 0))) / baselineCoverage.length), 4)
        : null
    },
    recommendation: status === "STABLE"
      ? "No retraining recommendation. Continue monitoring."
      : "Review data provenance and temporal backtest evidence before considering retraining. Do not promote automatically.",
    evidence: evidence.length ? evidence : ["No monitored metric crossed the configured warning thresholds."]
  };
}
