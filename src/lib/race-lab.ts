import type { Course, SwimEvent } from "@/types/swim";

export const RACE_LAB_ENGINE_VERSION = "race-lab-v1.1.0";
export const RACE_LAB_DISTANCES = [50, 100, 200, 400] as const;

export type RaceLabDistance = (typeof RACE_LAB_DISTANCES)[number];
export type RaceSplitSource = "OFFICIAL" | "MANUAL" | "ESTIMATED" | "SIMULATED";
export type RaceSplitPrecision = "HUNDREDTH" | "TENTH" | "WHOLE_SECOND";
export type RacePacingStrategy = "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE";
export type RaceShapePattern =
  | "Fast start"
  | "Slow start"
  | "Even pacing"
  | "Positive split"
  | "Negative split"
  | "Late-race fade"
  | "Strong finish"
  | "Inconsistent middle section"
  | "Single-length race";

export interface RaceSegment {
  segmentIndex: number;
  segmentDistance: number;
  cumulativeDistance: number;
  segmentTime: number;
  cumulativeTime: number;
  source: RaceSplitSource;
  precision: RaceSplitPrecision;
  note?: string;
}

export interface RaceShapeAnalysis {
  primary: RaceShapePattern;
  patterns: RaceShapePattern[];
  strongestSegment: number;
  weakestSegment: number;
  firstHalfTime: number;
  secondHalfTime: number;
  halfDifference: number;
  thresholds: typeof RACE_SHAPE_THRESHOLDS;
}

export interface SimulationSettings {
  reactionTime: number;
  firstSegmentAdjustment: number;
  middleSegmentAdjustment: number;
  finalSegmentAdjustment: number;
  turnAdjustment: number;
  underwaterEfficiency: number;
}

export interface SimulationResult {
  projectedTime: number;
  segments: RaceSegment[];
  settings: SimulationSettings;
  label: "Simulation";
}

export interface SegmentComparison {
  segmentIndex: number;
  cumulativeDistance: number;
  segmentTime: number;
  cumulativeTime: number;
  referenceSegmentTime?: number;
  referenceCumulativeTime?: number;
  segmentDelta?: number;
  cumulativeDelta?: number;
  source: RaceSplitSource;
  referenceSource?: RaceSplitSource;
}

export interface RaceReplayPosition {
  completed: boolean;
  cumulativeDistance: number;
  direction: "OUTBOUND" | "RETURN";
  laneProgress: number;
  lengthCount: number;
  lengthIndex: number;
  lengthProgress: number;
}

export interface StoredRaceSplit extends RaceSegment {
  id: string;
  raceId: string;
}

export interface SavedRaceLabScenario {
  id: string;
  baseResultId?: string;
  kind: "SIMULATION" | "GOAL_RACE";
  event: SwimEvent;
  course: Course;
  name: string;
  strategy?: RacePacingStrategy;
  targetTime?: number;
  projectedTime: number;
  settings: Record<string, unknown>;
  segments: RaceSegment[];
  engineVersion: string;
  createdAt: string;
}

export interface RaceLabState {
  splits: StoredRaceSplit[];
  scenarios: SavedRaceLabScenario[];
}

export const RACE_SHAPE_THRESHOLDS = Object.freeze({
  startDifference: 0.03,
  evenHalfDifference: 0.015,
  splitDifference: 0.02,
  lateFadeDifference: 0.04,
  strongFinishDifference: 0.03,
  middleCoefficientOfVariation: 0.04
});

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = Object.freeze({
  reactionTime: 0.7,
  firstSegmentAdjustment: 0,
  middleSegmentAdjustment: 0,
  finalSegmentAdjustment: 0,
  turnAdjustment: 0,
  underwaterEfficiency: 0
});

export const SIMULATION_LIMITS = Object.freeze({
  reactionTime: { min: 0.45, max: 1.5 },
  firstSegmentAdjustment: { min: -2, max: 3 },
  middleSegmentAdjustment: { min: -1.25, max: 2 },
  finalSegmentAdjustment: { min: -1.5, max: 2.5 },
  turnAdjustment: { min: -0.4, max: 0.8 },
  underwaterEfficiency: { min: -1, max: 1 }
});

export class RaceLabValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaceLabValidationError";
  }
}

function round(value: number, places = 3) {
  const multiplier = 10 ** places;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function coefficientOfVariation(values: number[]) {
  const mean = average(values);
  if (!mean || values.length < 2) return 0;
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance) / mean;
}

function normalizedWeights(weights: number[]) {
  const total = sum(weights);
  if (!total || weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new RaceLabValidationError("Race-shape weights must be positive finite values.");
  }
  return weights.map((weight) => weight / total);
}

export function getEventDistance(event: SwimEvent): RaceLabDistance | null {
  const distance = Number.parseInt(event.split(" ")[0] ?? "", 10);
  return RACE_LAB_DISTANCES.includes(distance as RaceLabDistance) ? distance as RaceLabDistance : null;
}

export function isRaceLabEvent(event: SwimEvent) {
  return getEventDistance(event) !== null;
}

export function getCourseLength(course: Course) {
  return course === "LCM" ? 50 : 25;
}

export function getSegmentCount(event: SwimEvent, course: Course) {
  const distance = getEventDistance(event);
  if (!distance) throw new RaceLabValidationError("Race Lab supports 50, 100, 200, and 400 distance events.");
  return distance / getCourseLength(course);
}

export function getRaceReplayPosition(segments: RaceSegment[], elapsedTime: number): RaceReplayPosition {
  if (!segments.length) {
    return {
      completed: true,
      cumulativeDistance: 0,
      direction: "OUTBOUND",
      laneProgress: 0,
      lengthCount: 0,
      lengthIndex: 0,
      lengthProgress: 0
    };
  }

  const totalTime = segments.at(-1)?.cumulativeTime ?? 0;
  const boundedElapsed = Number.isFinite(elapsedTime)
    ? Math.max(0, Math.min(totalTime, elapsedTime))
    : 0;
  let lengthIndex = segments.findIndex((segment) => boundedElapsed <= segment.cumulativeTime + 0.0001);
  if (lengthIndex < 0) lengthIndex = segments.length - 1;

  const segment = segments[lengthIndex];
  const previousTime = lengthIndex > 0 ? segments[lengthIndex - 1].cumulativeTime : 0;
  const previousDistance = lengthIndex > 0 ? segments[lengthIndex - 1].cumulativeDistance : 0;
  const rawLengthProgress = Math.max(0, Math.min(1, (boundedElapsed - previousTime) / Math.max(0.001, segment.segmentTime)));
  const lengthProgress = rawLengthProgress <= 0.0001 ? 0 : rawLengthProgress >= 0.9999 ? 1 : rawLengthProgress;
  const direction = lengthIndex % 2 === 0 ? "OUTBOUND" : "RETURN";

  return {
    completed: boundedElapsed >= totalTime - 0.0001,
    cumulativeDistance: previousDistance + segment.segmentDistance * lengthProgress,
    direction,
    laneProgress: direction === "OUTBOUND" ? lengthProgress : 1 - lengthProgress,
    lengthCount: segments.length,
    lengthIndex,
    lengthProgress
  };
}

export function validateStoredSegmentGeometry(input: {
  event: SwimEvent;
  course: Course;
  segments: Pick<RaceSegment, "segmentIndex" | "segmentDistance" | "cumulativeDistance" | "segmentTime" | "cumulativeTime">[];
}) {
  const expectedCount = getSegmentCount(input.event, input.course);
  const expectedDistance = getCourseLength(input.course);
  if (input.segments.length !== expectedCount) {
    throw new RaceLabValidationError(`Expected ${expectedCount} stored segments for this event and course.`);
  }

  let previousCumulativeTime = 0;
  input.segments.forEach((segment, index) => {
    const expectedCumulativeDistance = expectedDistance * (index + 1);
    if (
      !Number.isInteger(segment.segmentIndex)
      || segment.segmentIndex !== index
      || !Number.isFinite(segment.segmentDistance)
      || !Number.isFinite(segment.cumulativeDistance)
      || Math.abs(segment.segmentDistance - expectedDistance) > 0.01
      || Math.abs(segment.cumulativeDistance - expectedCumulativeDistance) > 0.01
    ) {
      throw new RaceLabValidationError("Stored split geometry does not match the event and course.");
    }
    const derivedSegmentTime = segment.cumulativeTime - previousCumulativeTime;
    if (
      !Number.isFinite(segment.segmentTime)
      || !Number.isFinite(segment.cumulativeTime)
      || !Number.isFinite(derivedSegmentTime)
      || Math.abs(segment.segmentTime - derivedSegmentTime) > 0.06
    ) {
      throw new RaceLabValidationError("Stored segment and cumulative times are inconsistent.");
    }
    previousCumulativeTime = segment.cumulativeTime;
  });
  return input.segments;
}

export function minimumSegmentTime(segmentDistance: number, course: Course) {
  if (segmentDistance === 25) return course === "SCY" ? 6 : 7;
  if (segmentDistance === 50) return course === "SCY" ? 14 : 17;
  return segmentDistance * (course === "SCY" ? 0.24 : 0.3);
}

function defaultShapeWeights(segmentCount: number) {
  if (segmentCount === 1) return [1];
  return normalizedWeights(Array.from({ length: segmentCount }, (_, index) => {
    const progress = index / Math.max(1, segmentCount - 1);
    const startBenefit = index === 0 ? -0.045 : 0;
    const finishCost = 0.055 * progress;
    return 1 + startBenefit + finishCost;
  }));
}

function shapeWeightsFromSegments(segments: RaceSegment[]) {
  const pace = segments.map((segment) => segment.segmentTime / segment.segmentDistance);
  return normalizedWeights(pace);
}

export function buildSegmentsFromCumulative(input: {
  event: SwimEvent;
  course: Course;
  cumulativeTimes: number[];
  source: Exclude<RaceSplitSource, "SIMULATED">;
  precision?: RaceSplitPrecision;
  totalTime?: number;
  note?: string;
}) {
  const segmentCount = getSegmentCount(input.event, input.course);
  const segmentDistance = getCourseLength(input.course);
  if (input.cumulativeTimes.length !== segmentCount) {
    throw new RaceLabValidationError(`Expected ${segmentCount} cumulative split values for this event and course.`);
  }

  let previous = 0;
  const segments = input.cumulativeTimes.map((rawTime, index): RaceSegment => {
    if (!Number.isFinite(rawTime) || rawTime <= previous) {
      throw new RaceLabValidationError("Cumulative splits must be finite and strictly increasing.");
    }
    const segmentTime = rawTime - previous;
    if (segmentTime < minimumSegmentTime(segmentDistance, input.course)) {
      throw new RaceLabValidationError("A segment is outside Race Lab's broad plausibility limits.");
    }
    previous = rawTime;
    return {
      segmentIndex: index,
      segmentDistance,
      cumulativeDistance: segmentDistance * (index + 1),
      segmentTime: round(segmentTime),
      cumulativeTime: round(rawTime),
      source: input.source,
      precision: input.precision ?? (input.source === "ESTIMATED" ? "TENTH" : "HUNDREDTH"),
      note: input.note
    };
  });

  if (input.totalTime !== undefined && Math.abs(previous - input.totalTime) > 0.06) {
    throw new RaceLabValidationError("The final cumulative split must match the recorded finish time.");
  }
  return segments;
}

export function buildSegmentsFromTimes(input: {
  event: SwimEvent;
  course: Course;
  segmentTimes: number[];
  source: RaceSplitSource;
  precision?: RaceSplitPrecision;
  note?: string;
}) {
  let cumulative = 0;
  return buildSegmentsFromCumulative({
    ...input,
    source: input.source === "SIMULATED" ? "ESTIMATED" : input.source,
    cumulativeTimes: input.segmentTimes.map((segmentTime) => {
      cumulative += segmentTime;
      return cumulative;
    })
  }).map((segment) => ({ ...segment, source: input.source }));
}

export function estimateRaceSegments(input: {
  event: SwimEvent;
  course: Course;
  totalTime: number;
  referenceShapes?: RaceSegment[][];
  note?: string;
}) {
  const segmentCount = getSegmentCount(input.event, input.course);
  const segmentDistance = getCourseLength(input.course);
  const minimumTotal = segmentCount * minimumSegmentTime(segmentDistance, input.course);
  if (!Number.isFinite(input.totalTime) || input.totalTime < minimumTotal || input.totalTime > 7_200) {
    throw new RaceLabValidationError("Finish time is outside Race Lab's broad plausibility limits.");
  }
  const matchingShapes = (input.referenceShapes ?? []).filter((shape) => shape.length === segmentCount);
  const weights = matchingShapes.length
    ? normalizedWeights(Array.from({ length: segmentCount }, (_, index) => average(matchingShapes.map((shape) => shapeWeightsFromSegments(shape)[index]))))
    : defaultShapeWeights(segmentCount);
  const rawTimes = weights.map((weight) => input.totalTime * weight);
  rawTimes[rawTimes.length - 1] += input.totalTime - sum(rawTimes);
  return buildSegmentsFromTimes({
    event: input.event,
    course: input.course,
    segmentTimes: rawTimes,
    source: "ESTIMATED",
    precision: "TENTH",
    note: input.note ?? "Estimated from finish time and available race shape; not an official split."
  });
}

export function analyzeRaceShape(segments: RaceSegment[]): RaceShapeAnalysis {
  if (!segments.length) throw new RaceLabValidationError("At least one segment is required for race-shape analysis.");
  if (segments.length === 1) {
    return {
      primary: "Single-length race",
      patterns: ["Single-length race"],
      strongestSegment: 0,
      weakestSegment: 0,
      firstHalfTime: segments[0].segmentTime,
      secondHalfTime: 0,
      halfDifference: 0,
      thresholds: RACE_SHAPE_THRESHOLDS
    };
  }

  const times = segments.map((segment) => segment.segmentTime / segment.segmentDistance);
  const half = Math.floor(segments.length / 2);
  const firstHalfTime = sum(segments.slice(0, half).map((segment) => segment.segmentTime));
  const secondHalfTime = sum(segments.slice(half).map((segment) => segment.segmentTime));
  const halfDifference = firstHalfTime ? (secondHalfTime - firstHalfTime) / firstHalfTime : 0;
  const middle = times.length > 3 ? times.slice(1, -1) : times.slice(1);
  const middleBaseline = median(middle.length ? middle : times);
  const patterns: RaceShapePattern[] = [];

  if (times[0] <= middleBaseline * (1 - RACE_SHAPE_THRESHOLDS.startDifference)) patterns.push("Fast start");
  if (times[0] >= middleBaseline * (1 + RACE_SHAPE_THRESHOLDS.startDifference)) patterns.push("Slow start");
  if (Math.abs(halfDifference) <= RACE_SHAPE_THRESHOLDS.evenHalfDifference) patterns.push("Even pacing");
  if (halfDifference >= RACE_SHAPE_THRESHOLDS.splitDifference) patterns.push("Positive split");
  if (halfDifference <= -RACE_SHAPE_THRESHOLDS.splitDifference) patterns.push("Negative split");

  const finalBaseline = average(times.slice(Math.max(0, times.length - 3), -1));
  const finalPace = times[times.length - 1];
  if (finalBaseline && finalPace >= finalBaseline * (1 + RACE_SHAPE_THRESHOLDS.lateFadeDifference)) patterns.push("Late-race fade");
  if (finalBaseline && finalPace <= finalBaseline * (1 - RACE_SHAPE_THRESHOLDS.strongFinishDifference)) patterns.push("Strong finish");
  if (middle.length >= 3 && coefficientOfVariation(middle) >= RACE_SHAPE_THRESHOLDS.middleCoefficientOfVariation) {
    patterns.push("Inconsistent middle section");
  }
  if (!patterns.length) patterns.push("Even pacing");

  const primaryOrder: RaceShapePattern[] = [
    "Late-race fade",
    "Strong finish",
    "Inconsistent middle section",
    "Negative split",
    "Positive split",
    "Even pacing",
    "Fast start",
    "Slow start"
  ];
  const strongestPace = Math.min(...times);
  const weakestPace = Math.max(...times);
  return {
    primary: primaryOrder.find((pattern) => patterns.includes(pattern)) ?? patterns[0],
    patterns,
    strongestSegment: times.indexOf(strongestPace),
    weakestSegment: times.indexOf(weakestPace),
    firstHalfTime: round(firstHalfTime),
    secondHalfTime: round(secondHalfTime),
    halfDifference: round(halfDifference, 4),
    thresholds: RACE_SHAPE_THRESHOLDS
  };
}

export function compareRaceSegments(actual: RaceSegment[], reference: RaceSegment[]): SegmentComparison[] {
  return actual.map((segment, index) => {
    const comparison = reference[index];
    return {
      segmentIndex: index,
      cumulativeDistance: segment.cumulativeDistance,
      segmentTime: segment.segmentTime,
      cumulativeTime: segment.cumulativeTime,
      referenceSegmentTime: comparison?.segmentTime,
      referenceCumulativeTime: comparison?.cumulativeTime,
      segmentDelta: comparison ? round(segment.segmentTime - comparison.segmentTime) : undefined,
      cumulativeDelta: comparison ? round(segment.cumulativeTime - comparison.cumulativeTime) : undefined,
      source: segment.source,
      referenceSource: comparison?.source
    };
  });
}

export function validateSimulationSettings(settings: SimulationSettings) {
  for (const [key, limits] of Object.entries(SIMULATION_LIMITS) as [keyof SimulationSettings, { min: number; max: number }][]) {
    const value = settings[key];
    if (!Number.isFinite(value) || value < limits.min || value > limits.max) {
      throw new RaceLabValidationError(`${key} must be between ${limits.min} and ${limits.max}.`);
    }
  }
  return settings;
}

export function simulateRace(input: {
  event: SwimEvent;
  course: Course;
  baseSegments: RaceSegment[];
  settings: SimulationSettings;
}) : SimulationResult {
  const settings = validateSimulationSettings(input.settings);
  const expectedCount = getSegmentCount(input.event, input.course);
  if (input.baseSegments.length !== expectedCount) {
    throw new RaceLabValidationError("The base race does not have the expected number of pool-length segments.");
  }

  const assumedBaseReaction = 0.7;
  const underwaterSeconds = settings.underwaterEfficiency * -0.08;
  const segmentTimes = input.baseSegments.map((segment, index) => {
    let adjusted = segment.segmentTime;
    if (index === 0) adjusted += settings.reactionTime - assumedBaseReaction + settings.firstSegmentAdjustment;
    else if (index === input.baseSegments.length - 1) adjusted += settings.finalSegmentAdjustment;
    else adjusted += settings.middleSegmentAdjustment;
    if (index > 0) adjusted += settings.turnAdjustment + underwaterSeconds;

    const minimum = minimumSegmentTime(segment.segmentDistance, input.course);
    if (adjusted < minimum) {
      throw new RaceLabValidationError(`Segment ${index + 1} falls below Race Lab's broad plausibility limit.`);
    }
    return adjusted;
  });

  const segments = buildSegmentsFromTimes({
    event: input.event,
    course: input.course,
    segmentTimes,
    source: "SIMULATED",
    precision: "HUNDREDTH",
    note: "Deterministic what-if scenario; not a prediction or official split."
  });
  return {
    projectedTime: round(sum(segmentTimes)),
    segments,
    settings: { ...settings },
    label: "Simulation"
  };
}

function strategyAdjustedWeights(weights: number[], strategy: RacePacingStrategy) {
  if (strategy === "BALANCED" || weights.length === 1) return normalizedWeights(weights);
  const midpoint = weights.length / 2;
  const shift = strategy === "AGGRESSIVE" ? -0.012 : 0.01;
  return normalizedWeights(weights.map((weight, index) => {
    const halfDirection = index < midpoint ? shift : -shift;
    return Math.max(0.01, weight * (1 + halfDirection));
  }));
}

export function generateGoalRace(input: {
  event: SwimEvent;
  course: Course;
  targetTime: number;
  strategy: RacePacingStrategy;
  historicalShapes?: RaceSegment[][];
}) {
  const segmentCount = getSegmentCount(input.event, input.course);
  const segmentDistance = getCourseLength(input.course);
  const minimumTotal = segmentCount * minimumSegmentTime(segmentDistance, input.course);
  if (!Number.isFinite(input.targetTime) || input.targetTime < minimumTotal || input.targetTime > 7_200) {
    throw new RaceLabValidationError("Goal time is outside Race Lab's broad plausibility limits.");
  }

  const shapes = (input.historicalShapes ?? []).filter((shape) => shape.length === segmentCount);
  // The first shape is the best recent valid race. Count it twice so the goal
  // stays athlete-specific without allowing one race to dominate the template.
  const weightedShapes = shapes.length > 1 ? [shapes[0], ...shapes] : shapes;
  const historicalWeights = weightedShapes.length
    ? normalizedWeights(Array.from({ length: segmentCount }, (_, index) => average(weightedShapes.map((shape) => shapeWeightsFromSegments(shape)[index]))))
    : defaultShapeWeights(segmentCount);
  const baseWeights = normalizedWeights(historicalWeights.map((weight, index) => weight * 0.75 + defaultShapeWeights(segmentCount)[index] * 0.25));
  const weights = strategyAdjustedWeights(baseWeights, input.strategy);
  const segmentTimes = weights.map((weight) => input.targetTime * weight);
  segmentTimes[segmentTimes.length - 1] += input.targetTime - sum(segmentTimes);

  const segments = buildSegmentsFromTimes({
    event: input.event,
    course: input.course,
    segmentTimes,
    source: "SIMULATED",
    precision: "TENTH",
    note: shapes.length
      ? "Editable goal split based on historical race shape."
      : "Editable goal split based on a conservative event template because source splits are unavailable."
  });
  return {
    strategy: input.strategy,
    targetTime: round(input.targetTime),
    segments,
    usedHistoricalShape: shapes.length > 0
  };
}

export function rebuildEditableGoal(input: {
  event: SwimEvent;
  course: Course;
  targetTime: number;
  segmentTimes: number[];
}) {
  if (Math.abs(sum(input.segmentTimes) - input.targetTime) > 0.06) {
    throw new RaceLabValidationError("Editable goal segments must add up to the goal finish time.");
  }
  return buildSegmentsFromTimes({
    event: input.event,
    course: input.course,
    segmentTimes: input.segmentTimes,
    source: "SIMULATED",
    precision: "TENTH",
    note: "Athlete-edited goal race; not an official split or prediction."
  });
}
