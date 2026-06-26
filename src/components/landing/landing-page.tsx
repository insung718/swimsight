import Image from "next/image";
import { ArrowRight, BarChart3, CalendarCheck2, CalendarDays, Flag, ShieldCheck, Trophy, Users } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { Reveal } from "@/components/landing/reveal";
import { RaceTelemetry } from "@/components/landing/race-telemetry";
import { SiteNav } from "@/components/landing/site-nav";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import DisplayCards from "@/components/ui/display-cards";
import { MagicBento } from "@/components/ui/magic-bento";
import { Typewriter } from "@/components/ui/typewriter-text";

const features = [
  [BarChart3, "01", "See every race become progress.", "Personal bests, event trends, consistency, and future projections update from the times you actually enter."],
  [CalendarDays, "02", "Train toward something real.", "Set a goal, add your next meet, and understand the pace required to arrive ready."],
  [Users, "03", "Better together.", "Build private communities, add friends, and compare progress without turning training into noise."]
] as const;

const bentoCards = features.map(([Icon, number, title, description]) => ({
  eyebrow: number,
  title,
  description,
  icon: <Icon aria-hidden className="h-5 w-5" />
}));

const seasonCards = [
  { icon: <Trophy aria-hidden className="h-4 w-4" />, title: "Personal best", description: "Detected from every result", detail: "Automatic" },
  { icon: <Flag aria-hidden className="h-4 w-4" />, title: "Goal pace", description: "Recalculated as you improve", detail: "Always current" },
  { icon: <CalendarCheck2 aria-hidden className="h-4 w-4" />, title: "Next meet", description: "Your countdown, in focus", detail: "Ready when you are" },
];

export function LandingPage() {
  return (
    <main className="landing-page min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteNav />

      <section id="top" className="relative min-h-[94svh] overflow-hidden bg-black pt-12 text-white">
        <Image alt="Bird's-eye view of competitive swimmers racing in an Olympic pool" className="pointer-events-none object-cover object-[64%_center] opacity-85" fill priority quality={88} sizes="100vw" src="/images/swimsight-pool-hero.jpg" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.68)_38%,rgba(0,0,0,0.08)_72%)]" />
        <div className="relative mx-auto flex min-h-[calc(94svh-3rem)] max-w-6xl items-center px-5 py-16">
          <div className="landing-hero-copy max-w-2xl">
            <p className="mb-5 text-sm font-semibold text-cyan-300">Swim intelligence. Made personal.</p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[88px]">Your times tell a story.</h1>
            <p className="mt-7 max-w-xl text-lg leading-7 text-white/72 sm:text-xl">SwimSight turns every result into a clearer view of where you are, what is improving, and what comes next.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <UserActions hero />
              <a className="inline-flex h-11 items-center gap-2 rounded-full border border-white/35 px-5 text-sm font-medium transition hover:bg-white hover:text-black" href="/features">Explore features <ArrowRight aria-hidden className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </section>

      <RaceTelemetry />

      <section id="features" className="bg-white py-24 sm:py-36">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><p className="text-sm font-semibold text-cyan-700">One place for the whole season.</p><h2 className="mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">Less dashboard. More direction.</h2></Reveal>
          <Reveal className="mt-16" delay={100}>
            <MagicBento cards={bentoCards} />
          </Reveal>
        </div>
      </section>

      <section className="overflow-hidden bg-[#dff8ff] py-24 sm:py-36">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <Reveal>
            <p className="text-sm font-semibold text-cyan-800">Built around your season.</p>
            <h2 className="mx-auto mt-5 max-w-5xl text-balance text-4xl font-semibold leading-tight sm:text-7xl">Every result becomes</h2>
            <div className="mt-2 min-h-[1.25em] text-4xl font-semibold leading-tight text-[#0067b9] sm:text-7xl">
              <Typewriter text={["a clearer trend.", "a smarter goal.", "your next breakthrough."]} loop />
            </div>
          </Reveal>
          <Reveal className="mt-12" delay={120}>
            <p className="mx-auto max-w-2xl text-lg leading-8 text-black/58">One entry updates the story around it, while your account stays completely empty until you decide what belongs there.</p>
          </Reveal>
        </div>
      </section>

      <section id="performance" className="overflow-hidden bg-[#050505] text-white">
        <ContainerScroll title={<><p className="text-sm font-semibold text-cyan-300">Precision without the clutter.</p><h2 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">Add one time. See the entire picture move.</h2></>}>
              <div className="flex h-12 items-center gap-2 border-b border-white/10 px-5"><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /><span className="ml-auto text-xs text-white/70">Your season</span></div>
              <div className="grid min-h-[420px] gap-8 p-6 md:grid-cols-[0.36fr_0.64fr] md:p-10">
                <div><p className="text-xs font-medium uppercase text-white/70">Current best</p><div className="mt-3 font-mono text-5xl font-medium text-cyan-300">--:--.--</div><p className="mt-7 text-sm leading-6 text-white/72">Your dashboard begins empty. Every number appears only after you add it.</p></div>
                <div className="relative min-h-[250px] overflow-hidden rounded-2xl bg-white/10"><div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:25%_25%]" /><svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 600 300"><path d="M30 238 C120 220, 155 232, 230 184 S360 175, 420 108 S510 92, 570 50" fill="none" stroke="#4ee8ff" strokeLinecap="round" strokeWidth="5" /></svg></div>
              </div>
        </ContainerScroll>
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-28 lg:grid-cols-[0.8fr_1.2fr] lg:items-center sm:pb-36">
          <Reveal><p className="text-sm font-semibold text-cyan-300">A closer look</p><h2 className="mt-4 text-balance text-4xl font-semibold leading-tight sm:text-6xl">The moments that move your season.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-white/74">SwimSight keeps the important changes visible and lets everything else get out of the way.</p></Reveal>
          <Reveal delay={100}><DisplayCards cards={seasonCards} /></Reveal>
        </div>
      </section>

      <section id="community" className="bg-[#f5f5f7] py-24 sm:py-36">
        <div className="mx-auto grid max-w-6xl gap-16 px-5 lg:grid-cols-2 lg:items-center">
          <Reveal><p className="text-sm font-semibold text-cyan-700">Private communities</p><h2 className="mt-4 text-balance text-4xl font-semibold leading-tight sm:text-6xl">Your lane. Your people.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-black/58">Invite friends, compare shared events, and celebrate improvement without exposing your data publicly.</p></Reveal>
          <Reveal className="relative min-h-[480px]" delay={100}>
            <div className="absolute left-[6%] top-[8%] w-[76%] rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.10)]"><p className="text-xs text-black/40">Community progress</p><div className="mt-3 text-3xl font-semibold">Your swim circle</div><div className="mt-8 space-y-5">{["You", "Friend 01", "Friend 02"].map((name, index) => <div className="flex items-center gap-4" key={name}><div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-300 to-blue-700" /><div className="flex-1"><div className="text-sm font-medium">{name}</div><div className="mt-2 h-1.5 rounded-full bg-black/7"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${82 - index * 18}%` }} /></div></div></div>)}</div></div>
            <div className="absolute bottom-[4%] right-[2%] w-[66%] rounded-[28px] bg-black p-6 text-white shadow-[0_35px_90px_rgba(0,0,0,0.22)]"><Users aria-hidden className="h-6 w-6 text-cyan-300" /><div className="mt-12 text-5xl font-semibold">Private</div><p className="mt-3 text-sm leading-6 text-white/74">Only people you invite can join and compare.</p></div>
          </Reveal>
        </div>
      </section>

      <section id="privacy" className="bg-white py-24 sm:py-32"><Reveal className="mx-auto max-w-4xl px-5 text-center"><ShieldCheck aria-hidden className="mx-auto h-10 w-10 text-cyan-700" /><h2 className="mt-7 text-balance text-4xl font-semibold sm:text-6xl">Your performance belongs to you.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-black/55">Account-scoped results, private communities, strict validation, and protected APIs from the first recorded time.</p><div className="mt-9 flex justify-center"><UserActions hero light /></div></Reveal></section>
      <footer className="bg-[#f5f5f7] py-10 text-sm text-black/45"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 SwimSight</span><span>Built for swimmers, coaches, and teams.</span></div></footer>
    </main>
  );
}
