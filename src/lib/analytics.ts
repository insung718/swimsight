import type {
  DashboardAnalytics,
  EventRanking,
  Goal,
  GoalProjection,
  PersonalBest,
  Prediction,
  SwimEvent,
  SwimPowerIndex,
  SwimResult,
  TrendLabel
} from "@/types/swim";
import { clamp, dateToDays, round } from "@/lib/utils";

const predictionHorizons = [30, 90, 180, 365] as const;

function byDateAsc(a: SwimResult, b: SwimResult) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

function groupByEvent(swims: SwimResult[]) {
  return swims.reduce<Map<SwimEvent, SwimResult[]>>((groups, swim) => {
    const existing = groups.get(swim.event) ?? [];
    existing.push(swim);
    groups.set(swim.event, existing);
    return groups;
  }, new Map());
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

function eventRegression(swims: SwimResult[]) {
  const sorted = [...swims].sort(byDateAsc);
  const startDay = dateToDays(sorted[0].date);
  const points = sorted.map((swim) => ({
    x: dateToDays(swim.date) - startDay,
    y: swim.timeSeconds
  }));

  return linearRegression(points);
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
  const groups = groupByEvent(swims);
  const personalBests: PersonalBest[] = [];

  groups.forEach((eventSwims, event) => {
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
      event,
      currentPb: currentBest.timeSeconds,
      dateAchieved: currentBest.date,
      meetName: currentBest.meetName,
      previousPb: previousBest?.timeSeconds,
      improvementSeconds,
      improvementPercent
    });
  });

  return personalBests.sort((a, b) => a.currentPb - b.currentPb);
}

export function rankEvents(swims: SwimResult[]) {
  const rankings: EventRanking[] = [];

  groupByEvent(swims).forEach((eventSwims, event) => {
    const sorted = [...eventSwims].sort(byDateAsc);
    const first = sorted[0];
    const best = sorted.reduce((fastest, swim) =>
      swim.timeSeconds < fastest.timeSeconds ? swim : fastest
    );
    const improvementPercent = round(((first.timeSeconds - best.timeSeconds) / first.timeSeconds) * 100, 2);
    const consistencyScore = calculateConsistencyScore(sorted);
    const eventTrendScore = trendScore(sorted);
    const eventRecentProgress = recentProgressPercent(sorted);
    const score = round(
      improvementScore(improvementPercent) * 0.4 +
        consistencyScore * 0.3 +
        eventTrendScore * 0.3,
      1
    );

    rankings.push({
      event,
      score,
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

export function predictEvent(swims: SwimResult[]): Prediction {
  const sorted = [...swims].sort(byDateAsc);
  const latest = sorted[sorted.length - 1];
  const { slope } = eventRegression(sorted);
  const consistencyScore = calculateConsistencyScore(sorted);
  const sampleConfidence = clamp(sorted.length * 15, 30, 90);
  const confidence = round(sampleConfidence * 0.45 + consistencyScore * 0.55, 1);

  const project = (days: number) => {
    const predicted = latest.timeSeconds + slope * days;
    return round(Math.max(predicted, latest.timeSeconds * 0.82), 2);
  };

  return {
    event: latest.event,
    currentTime: latest.timeSeconds,
    predictionDate: latest.date,
    predictedTimes: {
      days30: project(predictionHorizons[0]),
      days90: project(predictionHorizons[1]),
      days180: project(predictionHorizons[2]),
      days365: project(predictionHorizons[3])
    },
    confidence
  };
}

export function generatePredictions(swims: SwimResult[]) {
  const predictions: Prediction[] = [];

  groupByEvent(swims).forEach((eventSwims) => {
    if (eventSwims.length >= 1) {
      predictions.push(predictEvent(eventSwims));
    }
  });

  return predictions.sort((a, b) => a.event.localeCompare(b.event));
}

export function calculateGoalProjection(swims: SwimResult[], goal: Goal): GoalProjection {
  const eventSwims = swims.filter((swim) => swim.event === goal.event).sort(byDateAsc);
  const latest = eventSwims[eventSwims.length - 1];
  if (!latest) {
    throw new Error("Goal projection requires at least one swim for the goal event.");
  }
  const best = eventSwims.reduce((fastest, swim) =>
    swim.timeSeconds < fastest.timeSeconds ? swim : fastest
  );
  const { slope } = eventRegression(eventSwims);
  const daysRemaining = Math.max(dateToDays(goal.targetDate) - dateToDays(latest.date), 1);
  const weeksRemaining = daysRemaining / 7;
  const monthsRemaining = daysRemaining / 30.44;
  const requiredTotalImprovement = Math.max(best.timeSeconds - goal.targetTime, 0);
  const predictedAtGoalDate = round(Math.max(best.timeSeconds + slope * daysRemaining, best.timeSeconds * 0.82), 2);
  const currentMonthlyPace = round(Math.max(-slope * 30.44, 0), 2);
  const targetGap = predictedAtGoalDate - goal.targetTime;
  const likelihood =
    targetGap <= 0.2 ? "High" : targetGap <= requiredTotalImprovement * 0.35 ? "Medium" : "Low";

  return {
    event: goal.event,
    currentTime: best.timeSeconds,
    targetTime: goal.targetTime,
    targetDate: goal.targetDate,
    weeksRemaining: round(weeksRemaining, 1),
    requiredWeeklyImprovement: round(requiredTotalImprovement / weeksRemaining, 2),
    requiredMonthlyImprovement: round(requiredTotalImprovement / monthsRemaining, 2),
    currentMonthlyPace,
    predictedAtGoalDate,
    likelihood
  };
}

function calculateSwimPowerIndex(rankings: EventRanking[]): SwimPowerIndex {
  const strongest = rankings[0];
  const averageConsistency =
    rankings.reduce((sum, ranking) => sum + ranking.consistencyScore, 0) / rankings.length;
  const averageTrend = rankings.reduce((sum, ranking) => sum + ranking.trendScore, 0) / rankings.length;
  const score = round(
    improvementScore(strongest.improvementPercent) * 0.4 +
      averageConsistency * 0.3 +
      averageTrend * 0.3,
    1
  );

  if (score >= 90) {
    return { score, level: "National Level" };
  }

  if (score >= 80) {
    return { score, level: "Elite" };
  }

  if (score >= 65) {
    return { score, level: "Competitive" };
  }

  if (score >= 45) {
    return { score, level: "Developing" };
  }

  return { score, level: "Beginner" };
}

export function buildDashboardAnalytics(swims: SwimResult[], goal?: Goal): DashboardAnalytics {
  if (!swims.length) {
    return {
      overview: {
        totalSwims: 0,
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
      swimPowerIndex: { score: 0, level: "Beginner" }
    };
  }

  const rankings = rankEvents(swims);
  const personalBests = getPersonalBests(swims);
  const mostImproved = [...rankings].sort((a, b) => b.improvementPercent - a.improvementPercent)[0];

  return {
    overview: {
      totalSwims: swims.length,
      personalBestCount: personalBests.length,
      bestEvent: rankings[0].event,
      mostImprovedEvent: mostImproved.event,
      weeklyImprovement: averageWindowImprovement(swims, 7),
      monthlyImprovement: averageWindowImprovement(swims, 30),
      yearlyImprovement: averageWindowImprovement(swims, 365)
    },
    personalBests,
    rankings,
    strongestEvents: rankings.slice(0, 3),
    weakestEvents: rankings.slice(-3).reverse(),
    predictions: generatePredictions(swims),
    goalProjection: goal && swims.some((swim) => swim.event === goal.event) ? calculateGoalProjection(swims, goal) : undefined,
    swimPowerIndex: calculateSwimPowerIndex(rankings)
  };
}
