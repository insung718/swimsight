export type SwimEvent =
  | "50 Freestyle"
  | "100 Freestyle"
  | "200 Freestyle"
  | "400 Freestyle"
  | "800 Freestyle"
  | "1500 Freestyle"
  | "50 Butterfly"
  | "100 Butterfly"
  | "200 Butterfly"
  | "50 Backstroke"
  | "100 Backstroke"
  | "200 Backstroke"
  | "50 Breaststroke"
  | "100 Breaststroke"
  | "200 Breaststroke"
  | "100 IM"
  | "200 IM"
  | "400 IM";

export type Course = "SCM" | "LCM" | "SCY";
export type SwimResultKind = "OFFICIAL" | "TRAINING";
export type SwimRaceType = "INDIVIDUAL" | "RELAY_SPLIT" | "TIME_TRIAL" | "CONVERTED";

export type TrendLabel = "Improving" | "Plateauing" | "Declining";

export type GymWorkoutType = "STRENGTH" | "CORE" | "MOBILITY" | "DRYLAND" | "CARDIO" | "RECOVERY";
export type UserRole = "ATHLETE" | "COACH" | "ADMIN";
export type AthleteSex = "FEMALE" | "MALE";

export interface PredictionProfile {
  age?: number | null;
  sex?: AthleteSex | null;
  taperDays?: number | null;
  swimSessionsPerWeek?: number | null;
}

export interface SwimResult {
  id: string;
  userId: string;
  date: string;
  event: SwimEvent;
  course: Course;
  timeSeconds: number;
  meetName: string;
  source?: "MANUAL" | "CSV" | "MEET_IMPORT";
  resultKind?: SwimResultKind;
  raceType?: SwimRaceType;
  notes?: string | null;
}

export interface Goal {
  id: string;
  userId: string;
  event: SwimEvent;
  course: Course;
  targetTime: number;
  qualifyingTime?: number | null;
  targetDate: string;
}

export interface PredictionContribution {
  label: string;
  secondsImpact: number;
  direction: "faster" | "slower" | "neutral";
  detail: string;
}

export interface PredictionExplanation {
  method: "TREE_SHAP" | "DETERMINISTIC_DECOMPOSITION";
  baseTime: number;
  predictedTime: number;
  contributions: PredictionContribution[];
  additiveResidual: number;
  disclaimer: string;
}

export interface ProbabilityEstimate {
  thresholdTime: number;
  probability: number;
  method: "EMPIRICAL_RESIDUAL" | "ESTIMATED_RANGE";
  calibration: "Validated" | "Provisional";
}

export interface PredictionProbabilitySet {
  pb: ProbabilityEstimate;
  goal?: ProbabilityEstimate;
  qualifying?: ProbabilityEstimate;
}

export interface Prediction {
  event: SwimEvent;
  course: Course;
  currentTime: number;
  predictionDate: string;
  predictedTimes: {
    days30: number;
    days90: number;
    days180: number;
    days365: number;
  };
  confidence: number;
  likelyRanges: {
    days30: { low: number; high: number };
    days90: { low: number; high: number };
    days180: { low: number; high: number };
    days365: { low: number; high: number };
  };
  explanations: {
    days30: PredictionExplanation;
    days90: PredictionExplanation;
    days180: PredictionExplanation;
    days365: PredictionExplanation;
  };
  probabilities: {
    days30: PredictionProbabilitySet;
    days90: PredictionProbabilitySet;
    days180: PredictionProbabilitySet;
    days365: PredictionProbabilitySet;
  };
  model: {
    kind: "XGBOOST" | "CONSERVATIVE_ENSEMBLE";
    version: string;
    validationMae?: number;
    trainingDate?: string;
    trainingDatasetSize?: number;
    calibrationResidualQuantiles?: { probability: number; residual: number }[];
    historyUsed: number;
    dataSufficiency: "Low" | "Moderate" | "High";
    factors: { label: string; impact: "positive" | "neutral" | "caution"; detail: string }[];
    featuresUsed: string[];
    eligibilityRules: string[];
    outOfDistribution: boolean;
    outOfDistributionReasons: string[];
    sufficiencyChecklist: string[];
  };
  trainingImpact: {
    label: "No gym data" | "Strength supported" | "Balanced load" | "Fatigue risk";
    adjustmentMultiplier: number;
    weeklyLoad: number;
    sessionsLast28Days: number;
  };
}

export interface PredictionEvaluationRecord {
  id: string;
  event: SwimEvent;
  course: Course;
  targetRaceDate: string;
  predictionTimestamp: string;
  predictedTime: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  modelVersion: string;
  modelSource: "XGBOOST" | "CONSERVATIVE_ENSEMBLE";
  dataSufficiency: "Low" | "Moderate" | "High";
  athleteAge?: number | null;
  actualTime?: number | null;
  absoluteError?: number | null;
  signedError?: number | null;
  percentageError?: number | null;
  withinInterval?: boolean | null;
  achievedPb?: boolean | null;
  achievedGoal?: boolean | null;
  achievedQualification?: boolean | null;
  pbProbability?: number | null;
  goalProbability?: number | null;
  qualifyingProbability?: number | null;
  probabilityMethod?: ProbabilityEstimate["method"] | null;
  evaluatedAt?: string | null;
  outOfDistribution: boolean;
}

export interface ModelPerformanceBreakdown {
  label: string;
  count: number;
  mae: number;
  medianAbsoluteError: number;
  intervalCoverage: number;
}

export interface ModelPerformanceDashboard {
  summary: {
    evaluatedPredictions: number;
    pendingPredictions: number;
    mae: number;
    medianAbsoluteError: number;
    rmse: number;
    intervalCoverage: number;
    probabilityEvaluations: number;
    probabilityBrierScore: number;
  };
  byEvent: ModelPerformanceBreakdown[];
  byAgeGroup: ModelPerformanceBreakdown[];
  byConfidence: ModelPerformanceBreakdown[];
  byDataSufficiency: ModelPerformanceBreakdown[];
  byModelVersion: ModelPerformanceBreakdown[];
  baselines: {
    label: "SwimSight" | "Last race" | "Last-three average" | "Linear trend";
    count: number;
    mae: number;
  }[];
  probabilityCalibration: {
    label: "PB" | "Goal" | "Qualifying";
    count: number;
    brierScore: number;
    bins: {
      label: string;
      count: number;
      meanPredicted: number;
      observedRate: number;
    }[];
  }[];
  history: PredictionEvaluationRecord[];
}

export interface GymWorkout {
  id: string;
  userId: string;
  date: string;
  workoutType: GymWorkoutType;
  durationMinutes: number;
  intensity: number;
  focus?: string | null;
  notes?: string | null;
  trainingLoad: number;
}

export interface PersonalBest {
  event: SwimEvent;
  course: Course;
  currentPb: number;
  dateAchieved: string;
  meetName: string;
  previousPb?: number;
  improvementSeconds: number;
  improvementPercent: number;
}

export interface EventRanking {
  event: SwimEvent;
  course: Course;
  score: number;
  performanceScore: number;
  improvementPercent: number;
  consistencyScore: number;
  trend: TrendLabel;
  trendScore: number;
  recentProgressPercent: number;
}

export interface GoalProjection {
  event: SwimEvent;
  course: Course;
  currentTime: number;
  targetTime: number;
  qualifyingTime?: number | null;
  targetDate: string;
  weeksRemaining: number;
  requiredWeeklyImprovement: number;
  requiredMonthlyImprovement: number;
  currentMonthlyPace: number;
  predictedAtGoalDate: number;
  likelihood: "High" | "Medium" | "Low";
  goalProbability: ProbabilityEstimate;
  qualifyingProbability?: ProbabilityEstimate;
  confidence: number;
  paceGap: number;
  feasibility: "On track" | "Within reach" | "Stretch goal";
}

export interface SwimPowerIndex {
  score: number;
  level: "Beginner" | "Developing" | "Competitive" | "Elite" | "National Level";
}

export interface DashboardAnalytics {
  overview: {
    totalSwims: number;
    personalBestCount: number;
    bestEvent?: SwimEvent;
    mostImprovedEvent?: SwimEvent;
    weeklyImprovement: number;
    monthlyImprovement: number;
    yearlyImprovement: number;
  };
  personalBests: PersonalBest[];
  rankings: EventRanking[];
  strongestEvents: EventRanking[];
  weakestEvents: EventRanking[];
  predictions: Prediction[];
  goalProjection?: GoalProjection;
  swimPowerIndex: SwimPowerIndex;
  specialtyProfile: StrokeSpecialty[];
  trainingLoad: {
    weeklyLoad: number;
    sessionsLast28Days: number;
    loadRatio: number;
    label: Prediction["trainingImpact"]["label"];
  };
}

export interface StrokeSpecialty {
  stroke: "Freestyle" | "Butterfly" | "Backstroke" | "Breaststroke" | "IM";
  score: number;
  eventCount: number;
}

export interface Athlete {
  id: string;
  name: string;
  age: number;
  role: "Athlete" | "Captain";
}

export interface TeamMemberAnalytics extends Athlete {
  primaryEvent: SwimEvent;
  swimPowerIndex: number;
  totalImprovementPercent: number;
  fastestEventTime: number;
}

export interface CoachSwimmerAnalytics {
  id: string;
  name: string;
  imageUrl?: string | null;
  joinedAt: string;
  totalSwims: number;
  activeGoals: number;
  strongestEvent?: SwimEvent;
  mostImprovedEvent?: SwimEvent;
  swimPowerIndex: number;
  yearlyImprovement: number;
  consistencyScore: number;
  latestResult?: {
    event: SwimEvent;
    course: Course;
    timeSeconds: number;
    date: string;
  };
  progression: {
    date: string;
    timeSeconds: number;
    event: SwimEvent;
    course: Course;
  }[];
}

export interface CoachClubSummary {
  id: string;
  name: string;
  description?: string | null;
  joinCode: string;
  memberCount: number;
  swimmers: CoachSwimmerAnalytics[];
}

export interface CoachDashboardData {
  clubs: CoachClubSummary[];
  overview: {
    clubCount: number;
    swimmerCount: number;
    totalSwims: number;
    averageSpi: number;
    topImprover?: CoachSwimmerAnalytics;
  };
}

export interface CommunityMember {
  id: string;
  name: string;
  imageUrl?: string | null;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
  analytics: {
    totalSwims: number;
    strongestEvent?: SwimEvent;
    swimPowerIndex: number;
    yearlyImprovement: number;
  };
}

export interface CommunitySummary {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  joinCode: string;
  memberCount: number;
}

export interface FriendComparison {
  user: CommunityMember;
  friend: CommunityMember;
  sharedEvents: {
    event: SwimEvent;
    course: Course;
    userBest: number;
    friendBest: number;
    gapSeconds: number;
  }[];
}

export interface UpcomingMeet {
  id: string;
  userId: string;
  name: string;
  location?: string | null;
  startDate: string;
  targetEvents: SwimEvent[];
  notes?: string | null;
  daysUntil: number;
}

export interface MotivationTip {
  id: string;
  title: string;
  body: string;
  tone: "focus" | "confidence" | "recovery" | "race";
  author?: string;
  sourceName?: string;
  sourceUrl?: string;
  kind?: "tip" | "quote";
}
