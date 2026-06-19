import Image from "next/image";
import { ArrowRight, BarChart3, CalendarDays, ShieldCheck, Users, Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { Reveal } from "@/components/landing/reveal";

const features = [
  [BarChart3, "01", "See every race become progress.", "Personal bests, event trends, consistency, and future projections update from the times you actually enter."],
  [CalendarDays, "02", "Train toward something real.", "Set a goal, add your next meet, and understand the pace required to arrive ready."],
  [Users, "03", "Better together.", "Build private communities, add friends, and compare progress without turning training into noise."]
] as const;

export function LandingPage() {
  return (
    <main className="landing-page min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
          <a className="flex items-center gap-2 text-sm font-semibold" href="#top"><Waves aria-hidden className="h-5 w-5" />SwimSight</a>
          <nav className="hidden items-center gap-7 text-xs text-black/65 md:flex" aria-label="Main navigation">
            <a className="transition hover:text-black" href="#features">Features</a>
            <a className="transition hover:text-black" href="#performance">Performance</a>
            <a className="transition hover:text-black" href="#community">Community</a>
            <a className="transition hover:text-black" href="#privacy">Privacy</a>
          </nav>
          <UserActions compact />
        </div>
      </header>

      <section id="top" className="relative min-h-[94svh] overflow-hidden bg-black pt-12 text-white">
        <Image alt="Bird's-eye view of competitive swimmers racing in an Olympic pool" className="object-cover object-[64%_center] opacity-85" fill priority quality={88} sizes="100vw" src="/images/swimsight-pool-hero.jpg" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.68)_38%,rgba(0,0,0,0.08)_72%)]" />
        <div className="relative mx-auto flex min-h-[calc(94svh-3rem)] max-w-6xl items-center px-5 py-16">
          <div className="landing-hero-copy max-w-2xl">
            <p className="mb-5 text-sm font-semibold text-cyan-300">Swim intelligence. Made personal.</p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[88px]">Your times tell a story.</h1>
            <p className="mt-7 max-w-xl text-lg leading-7 text-white/72 sm:text-xl">SwimSight turns every result into a clearer view of where you are, what is improving, and what comes next.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <UserActions hero />
              <a className="inline-flex h-11 items-center gap-2 rounded-full border border-white/35 px-5 text-sm font-medium transition hover:bg-white hover:text-black" href="#features">Explore features <ArrowRight aria-hidden className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-white py-24 sm:py-36">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><p className="text-sm font-semibold text-cyan-700">One place for the whole season.</p><h2 className="mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">Less dashboard. More direction.</h2></Reveal>
          <div className="mt-20 divide-y divide-black/10 border-y border-black/10">
            {features.map(([Icon, number, title, body], index) => (
              <Reveal className="grid gap-7 py-12 md:grid-cols-[90px_1fr_1fr] md:items-start" delay={index * 80} key={number}>
                <div className="text-sm text-black/35">{number}</div>
                <div className="flex items-start gap-4"><Icon aria-hidden className="mt-1 h-6 w-6 text-cyan-700" /><h3 className="max-w-md text-2xl font-semibold sm:text-3xl">{title}</h3></div>
                <p className="max-w-lg text-lg leading-8 text-black/58">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="performance" className="overflow-hidden bg-[#050505] py-24 text-white sm:py-36">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="text-center"><p className="text-sm font-semibold text-cyan-300">Precision without the clutter.</p><h2 className="mx-auto mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">Add one time. See the entire picture move.</h2></Reveal>
          <Reveal className="relative mx-auto mt-16 max-w-5xl" delay={120}>
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-[#0d1117] shadow-[0_50px_120px_rgba(0,190,230,0.15)]">
              <div className="flex h-12 items-center gap-2 border-b border-white/10 px-5"><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /><span className="ml-auto text-xs text-white/40">Your season</span></div>
              <div className="grid min-h-[420px] gap-8 p-6 md:grid-cols-[0.36fr_0.64fr] md:p-10">
                <div><p className="text-xs font-medium uppercase text-white/40">Current best</p><div className="mt-3 font-mono text-5xl font-medium text-cyan-300">--:--.--</div><p className="mt-7 text-sm leading-6 text-white/45">Your dashboard begins empty. Every number appears only after you add it.</p></div>
                <div className="relative min-h-[250px] overflow-hidden rounded-2xl bg-white/[0.035]"><div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:25%_25%]" /><svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 600 300"><path d="M30 238 C120 220, 155 232, 230 184 S360 175, 420 108 S510 92, 570 50" fill="none" stroke="#4ee8ff" strokeLinecap="round" strokeWidth="5" /></svg></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="community" className="bg-[#f5f5f7] py-24 sm:py-36">
        <div className="mx-auto grid max-w-6xl gap-16 px-5 lg:grid-cols-2 lg:items-center">
          <Reveal><p className="text-sm font-semibold text-cyan-700">Private communities</p><h2 className="mt-4 text-balance text-4xl font-semibold leading-tight sm:text-6xl">Your lane. Your people.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-black/58">Invite friends, compare shared events, and celebrate improvement without exposing your data publicly.</p></Reveal>
          <Reveal className="relative min-h-[480px]" delay={100}>
            <div className="absolute left-[6%] top-[8%] w-[76%] rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.10)]"><p className="text-xs text-black/40">Community progress</p><div className="mt-3 text-3xl font-semibold">Your swim circle</div><div className="mt-8 space-y-5">{["You", "Friend 01", "Friend 02"].map((name, index) => <div className="flex items-center gap-4" key={name}><div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-300 to-blue-700" /><div className="flex-1"><div className="text-sm font-medium">{name}</div><div className="mt-2 h-1.5 rounded-full bg-black/7"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${82 - index * 18}%` }} /></div></div></div>)}</div></div>
            <div className="absolute bottom-[4%] right-[2%] w-[66%] rounded-[28px] bg-black p-6 text-white shadow-[0_35px_90px_rgba(0,0,0,0.22)]"><Users aria-hidden className="h-6 w-6 text-cyan-300" /><div className="mt-12 text-5xl font-semibold">Private</div><p className="mt-3 text-sm leading-6 text-white/55">Only people you invite can join and compare.</p></div>
          </Reveal>
        </div>
      </section>

      <section id="privacy" className="bg-white py-24 sm:py-32"><Reveal className="mx-auto max-w-4xl px-5 text-center"><ShieldCheck aria-hidden className="mx-auto h-10 w-10 text-cyan-700" /><h2 className="mt-7 text-balance text-4xl font-semibold sm:text-6xl">Your performance belongs to you.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-black/55">Account-scoped results, private communities, strict validation, and protected APIs from the first recorded time.</p><div className="mt-9 flex justify-center"><UserActions hero light /></div></Reveal></section>
      <footer className="bg-[#f5f5f7] py-10 text-sm text-black/45"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 SwimSight</span><span>Built for swimmers, coaches, and teams.</span></div></footer>
    </main>
  );
}
