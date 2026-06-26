import { rankEvents } from "@/lib/analytics";
import type { MotivationTip, SwimResult, UpcomingMeet } from "@/types/swim";

const olympicQuotes: MotivationTip[] = [
  {
    id: "quote-phelps-limits",
    title: "No Limits",
    body: "With hard work, there are no limits.",
    author: "Michael Phelps",
    sourceName: "PassItOn",
    sourceUrl: "https://www.passiton.com/inspirational-quotes/8148-there-will-be-obstacles-there-will-be",
    tone: "confidence",
    kind: "quote"
  },
  {
    id: "quote-ledecky-goals",
    title: "Race Your Goals",
    body: "The real race is always the same. It's me against my goals.",
    author: "Katie Ledecky",
    sourceName: "Stanford News",
    sourceUrl: "https://news.stanford.edu/stories/2025/06/commencement-address-katie-ledecky",
    tone: "race",
    kind: "quote"
  },
  {
    id: "quote-dressel-improve",
    title: "One Day Better",
    body: "But just improving each day, that's just the ultimate goal.",
    author: "Caeleb Dressel",
    sourceName: "BrainyQuote",
    sourceUrl: "https://www.brainyquote.com/authors/caeleb-dressel-quotes",
    tone: "focus",
    kind: "quote"
  },
  {
    id: "quote-franklin-goals",
    title: "Own The Standard",
    body: "I never go into a meet with a certain medal count in mind.",
    author: "Missy Franklin",
    sourceName: "Bustle",
    sourceUrl: "https://www.bustle.com/articles/176427-10-missy-franklin-quotes-that-will-help-you-hurdle-over-failures",
    tone: "recovery",
    kind: "quote"
  }
];

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
      tone: "focus",
      kind: "tip"
    },
    {
      id: "tip-confidence",
      title: "Trust The Trend",
      body: `${strongest} is trending well. Use that evidence before races instead of guessing how ready you are.`,
      tone: "confidence",
      kind: "tip"
    },
    {
      id: "tip-meet",
      title: "Race Countdown",
      body: meetTip,
      tone: "race",
      kind: "tip"
    },
    ...olympicQuotes
  ];
}
