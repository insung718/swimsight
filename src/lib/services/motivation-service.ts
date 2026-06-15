import { rankEvents } from "@/lib/analytics";
import type { MotivationTip, SwimResult, UpcomingMeet } from "@/types/swim";

export function generateMotivationTips(swims: SwimResult[], nextMeet?: UpcomingMeet): MotivationTip[] {
  const rankings = swims.length ? rankEvents(swims) : [];
  const strongest = rankings[0]?.event ?? "your best event";
  const priority = rankings[rankings.length - 1]?.event ?? "your next race";
  const meetTip = nextMeet
    ? `Your next meet is ${nextMeet.name} in ${nextMeet.daysUntil} days. Pick one controllable race detail for each practice this week.`
    : "Add your next meet so SwimSight can turn your training into a countdown plan.";

  return [
    {
      id: "tip-focus",
      title: "Win The Next Rep",
      body: `Treat ${priority} as a technical project. One cleaner breakout or turn per session compounds fast.`,
      tone: "focus"
    },
    {
      id: "tip-confidence",
      title: "Trust The Trend",
      body: `${strongest} is trending well. Use that evidence before races instead of guessing how ready you are.`,
      tone: "confidence"
    },
    {
      id: "tip-meet",
      title: "Race Countdown",
      body: meetTip,
      tone: "race"
    }
  ];
}
