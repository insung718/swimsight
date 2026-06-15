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

export type TrendLabel = "Improving" | "Plateauing" | "Declining";

export interface SwimResult {
  id: string;
  userId: string;
  date: string;
  event: SwimEvent;
  course: Course;
  timeSeconds: number;
  meetName: string;
}

export interface Goal {
  id: string;
  userId: string;
  event: SwimEvent;
  targetTime: number;
  targetDate: string;
}

export interface Prediction {
  event: SwimEvent;
  currentTime: number;
  predictionDate: string;
  predictedTimes: {
    days30: number;
    days90: number;
    days180: number;
    days365: number;
  };
  confidence: number;
}

export interface PersonalBest {
  event: SwimEvent;
  currentPb: number;
  dateAchieved: string;
  meetName: string;
  previousPb?: number;
  improvementSeconds: number;
  improvementPercent: number;
}

export interface EventRanking {
  event: SwimEvent;
  score: number;
  improvementPercent: number;
  consistencyScore: number;
  trend: TrendLabel;
  trendScore: number;
  recentProgressPercent: number;
}

export interface GoalProjection {
  event: SwimEvent;
  currentTime: number;
  targetTime: number;
  targetDate: string;
  weeksRemaining: number;
  requiredWeeklyImprovement: number;
  requiredMonthlyImprovement: number;
  currentMonthlyPace: number;
  predictedAtGoalDate: number;
  likelihood: "High" | "Medium" | "Low";
}

export interface SwimPowerIndex {
  score: number;
  level: "Beginner" | "Developing" | "Competitive" | "Elite" | "National Level";
}

export interface DashboardAnalytics {
  overview: {
    totalSwims: number;
    personalBestCount: number;
    bestEvent: SwimEvent;
    mostImprovedEvent: SwimEvent;
    weeklyImprovement: number;
    monthlyImprovement: number;
    yearlyImprovement: number;
  };
  personalBests: PersonalBest[];
  rankings: EventRanking[];
  strongestEvents: EventRanking[];
  weakestEvents: EventRanking[];
  predictions: Prediction[];
  goalProjection: GoalProjection;
  swimPowerIndex: SwimPowerIndex;
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
