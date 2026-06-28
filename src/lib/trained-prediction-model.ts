import type { Course, SwimEvent } from "@/types/swim";

export interface PredictionPrior {
  sampleCount: number;
  annualImprovementCap: number;
  observedAnnualImprovement: number;
  slopeSecondsPerDay: number;
  firstTime: number;
  bestTime: number;
  latestTime: number;
}

type EventCourseKey = `${SwimEvent}__${Course}`;

export const trainedPredictionModel = {
  version: "2026-06-28-swimming-times-v1",
  source: "Swimming times.xlsx",
  normalizedResultCount: 114,
  methodology:
    "Event/course priors are calibrated from normalized meet results. Observed youth improvements are converted into conservative annual forecast caps before being used by the prediction engine.",
  priors: {
    "100 Breaststroke__SCM": { sampleCount: 2, annualImprovementCap: 0.018, observedAnnualImprovement: 0, slopeSecondsPerDay: 0.01625, firstTime: 72.39, bestTime: 72.39, latestTime: 72.78 },
    "100 Butterfly__LCM": { sampleCount: 3, annualImprovementCap: 0.0632, observedAnnualImprovement: 0.0902, slopeSecondsPerDay: -0.02561, firstTime: 100.75, bestTime: 69.59, latestTime: 69.59 },
    "100 Butterfly__SCM": { sampleCount: 10, annualImprovementCap: 0.0613, observedAnnualImprovement: 0.0876, slopeSecondsPerDay: -0.01378, firstTime: 86.15, bestTime: 67.83, latestTime: 71.3 },
    "100 Freestyle__LCM": { sampleCount: 3, annualImprovementCap: 0.0486, observedAnnualImprovement: 0.0694, slopeSecondsPerDay: -0.0154, firstTime: 79.76, bestTime: 60.78, latestTime: 60.78 },
    "100 Freestyle__SCM": { sampleCount: 9, annualImprovementCap: 0.0418, observedAnnualImprovement: 0.0597, slopeSecondsPerDay: -0.01111, firstTime: 74.35, bestTime: 58.54, latestTime: 58.54 },
    "100 IM__SCM": { sampleCount: 5, annualImprovementCap: 0.0665, observedAnnualImprovement: 0.095, slopeSecondsPerDay: -0.02438, firstTime: 92.03, bestTime: 71.1, latestTime: 71.1 },
    "200 Breaststroke__LCM": { sampleCount: 2, annualImprovementCap: 0.018, observedAnnualImprovement: 0, slopeSecondsPerDay: 0.10208, firstTime: 174.73, bestTime: 174.73, latestTime: 177.18 },
    "200 Butterfly__LCM": { sampleCount: 2, annualImprovementCap: 0.045, observedAnnualImprovement: 0.1055, slopeSecondsPerDay: -0.05403, firstTime: 186.84, bestTime: 163.23, latestTime: 163.23 },
    "200 Butterfly__SCM": { sampleCount: 2, annualImprovementCap: 0.045, observedAnnualImprovement: 0.0975, slopeSecondsPerDay: -0.05092, firstTime: 190.61, bestTime: 168.36, latestTime: 168.36 },
    "200 Freestyle__LCM": { sampleCount: 4, annualImprovementCap: 0.0393, observedAnnualImprovement: 0.0562, slopeSecondsPerDay: -0.02793, firstTime: 178.69, bestTime: 132.27, latestTime: 132.43 },
    "200 Freestyle__SCM": { sampleCount: 8, annualImprovementCap: 0.0621, observedAnnualImprovement: 0.0887, slopeSecondsPerDay: -0.03337, firstTime: 166.88, bestTime: 129.99, latestTime: 133.88 },
    "200 IM__LCM": { sampleCount: 3, annualImprovementCap: 0.0489, observedAnnualImprovement: 0.0699, slopeSecondsPerDay: -0.04014, firstTime: 207.05, bestTime: 157.46, latestTime: 157.46 },
    "200 IM__SCM": { sampleCount: 8, annualImprovementCap: 0.0318, observedAnnualImprovement: 0.0455, slopeSecondsPerDay: -0.02056, firstTime: 169.94, bestTime: 143.2, latestTime: 143.2 },
    "400 Freestyle__LCM": { sampleCount: 3, annualImprovementCap: 0.029, observedAnnualImprovement: 0.0414, slopeSecondsPerDay: -0.03666, firstTime: 321.9, bestTime: 290.87, latestTime: 290.87 },
    "400 Freestyle__SCM": { sampleCount: 4, annualImprovementCap: 0.0529, observedAnnualImprovement: 0.0756, slopeSecondsPerDay: -0.05799, firstTime: 311.41, bestTime: 283.24, latestTime: 284.02 },
    "400 IM__LCM": { sampleCount: 3, annualImprovementCap: 0.0146, observedAnnualImprovement: 0.0208, slopeSecondsPerDay: -0.01719, firstTime: 343.34, bestTime: 334.77, latestTime: 334.77 },
    "50 Backstroke__LCM": { sampleCount: 2, annualImprovementCap: 0.045, observedAnnualImprovement: 0.0646, slopeSecondsPerDay: -0.00767, firstTime: 43.28, bestTime: 37.04, latestTime: 37.04 },
    "50 Backstroke__SCM": { sampleCount: 4, annualImprovementCap: 0.0444, observedAnnualImprovement: 0.0634, slopeSecondsPerDay: -0.00786, firstTime: 42.44, bestTime: 33.22, latestTime: 33.22 },
    "50 Breaststroke__LCM": { sampleCount: 2, annualImprovementCap: 0.018, observedAnnualImprovement: 0, slopeSecondsPerDay: 0.03417, firstTime: 34.08, bestTime: 34.08, latestTime: 34.9 },
    "50 Breaststroke__SCM": { sampleCount: 6, annualImprovementCap: 0.0479, observedAnnualImprovement: 0.0685, slopeSecondsPerDay: -0.00896, firstTime: 48.49, bestTime: 32.92, latestTime: 33.05 },
    "50 Butterfly__LCM": { sampleCount: 2, annualImprovementCap: 0.045, observedAnnualImprovement: 0.0879, slopeSecondsPerDay: -0.01021, firstTime: 42.39, bestTime: 34.08, latestTime: 34.08 },
    "50 Butterfly__SCM": { sampleCount: 8, annualImprovementCap: 0.0533, observedAnnualImprovement: 0.0761, slopeSecondsPerDay: -0.00866, firstTime: 41.65, bestTime: 30.78, latestTime: 30.78 },
    "50 Freestyle__LCM": { sampleCount: 5, annualImprovementCap: 0.0388, observedAnnualImprovement: 0.0554, slopeSecondsPerDay: -0.00536, firstTime: 35.88, bestTime: 26.68, latestTime: 26.68 },
    "50 Freestyle__SCM": { sampleCount: 10, annualImprovementCap: 0.0404, observedAnnualImprovement: 0.0578, slopeSecondsPerDay: -0.00492, firstTime: 35.58, bestTime: 25.94, latestTime: 25.94 }
  } satisfies Partial<Record<EventCourseKey, PredictionPrior>>
} as const;

export function getPredictionPrior(event: SwimEvent, course: Course) {
  const priors: Partial<Record<EventCourseKey, PredictionPrior>> = trainedPredictionModel.priors;
  return priors[`${event}__${course}` as EventCourseKey];
}
