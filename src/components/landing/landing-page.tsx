import { Activity, ArrowRight, BarChart3, CalendarCheck2, CalendarDays, Database, FileSpreadsheet, Flag, Instagram, LineChart, MessageSquareText, ShieldCheck, Star, Trophy, Users } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { Reveal } from "@/components/landing/reveal";
import { RaceTelemetry } from "@/components/landing/race-telemetry";
import { KineticRibbon } from "@/components/landing/kinetic-ribbon";
import { SectionTransition } from "@/components/landing/section-transition";
import { SeasonDepthCarousel } from "@/components/landing/season-depth-carousel";
import { SiteNav } from "@/components/landing/site-nav";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import DisplayCards from "@/components/ui/display-cards";
import { MagicBento } from "@/components/ui/magic-bento";
import { Typewriter } from "@/components/ui/typewriter-text";

const features = [
  [BarChart3, "01", "See every race become progress.", "Personal bests, event trends, consistency, and future projections update from the times you actually enter."],
  [CalendarDays, "02", "Train toward something real.", "Set a goal, add your next meet, and understand the pace required to arrive ready."],
  [Users, "03", "Compare without the noise.", "Start with your past self, then compare inside private teams, age groups, or anonymous percentile views."],
  [ShieldCheck, "04", "Trust the signal.", "Data-quality warnings, conservative predictions, and private access keep analytics useful for swimmers and school teams."]
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

const instagramUrl = "https://www.instagram.com/swim.sight/";

const contactCards = [
  {
    icon: MessageSquareText,
    title: "Contact us",
    body: "DM @swim.sight with questions, bugs, team ideas, or feature requests."
  },
  {
    icon: Star,
    title: "Review the website",
    body: "Tell us what feels premium, what feels confusing, and what would make SwimSight easier to use."
  }
] as const;

const trustSignals = [
  {
    icon: LineChart,
    title: "How predictions work",
    body: "Recent race history, event type, course, consistency, gym load, and conservative trained priors shape the forecast."
  },
  {
    icon: Database,
    title: "What data we store",
    body: "Race results, goals, meets, training logs, and private group memberships stay scoped to your signed-in account."
  },
  {
    icon: ShieldCheck,
    title: "Privacy for school teams",
    body: "Coach access only works when swimmers join a coach-managed club. Public visitors cannot see athlete dashboards."
  },
  {
    icon: Trophy,
    title: "Built for competitive swimmers",
    body: "Sprint, middle-distance, distance, and stroke-specific insights avoid treating every swim like the same event."
  },
  {
    icon: FileSpreadsheet,
    title: "Spreadsheet format guide",
    body: "Upload a CSV with Date, Event, and Time columns, or type results manually when you only have one race to add."
  }
] as const;

export function LandingPage() {
  return (
    <main className="landing-page min-h-screen select-none bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteNav />

      <section id="top" className="hero-scene relative min-h-[94svh] overflow-hidden bg-[#020811] pt-12 text-white">
        <div aria-hidden className="hero-lane-field absolute inset-0" />
        <div aria-hidden className="hero-water-sheen absolute inset-0" />
        <div aria-hidden className="hero-depth-shade absolute inset-0" />

        <div aria-hidden className="absolute inset-y-12 right-[-8%] hidden w-[72%] lg:block">
          <div className="hero-console relative h-full">
            <div className="hero-console-rail hero-console-rail-a" />
            <div className="hero-console-rail hero-console-rail-b" />
            <div className="hero-console-rail hero-console-rail-c" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 620">
              <g className="hero-signal-graph">
                <path className="hero-signal-glow" d="M80 440 C190 330 255 390 342 290 S520 175 620 235 S758 300 826 138" fill="none" vectorEffect="non-scaling-stroke" />
                <path className="hero-signal-line" d="M80 440 C190 330 255 390 342 290 S520 175 620 235 S758 300 826 138" fill="none" vectorEffect="non-scaling-stroke" />
                {[
                  [80, 440],
                  [342, 290],
                  [620, 235],
                  [826, 138]
                ].map(([cx, cy], index) => (
                  <g className="hero-signal-point" key={cx} style={{ animationDelay: `${index * 420}ms` }}>
                    <circle cx={cx} cy={cy} r="10" />
                    <circle cx={cx} cy={cy} r="26" />
                  </g>
                ))}
              </g>
            </svg>
            <div className="hero-data-card hero-data-card-a">
              <span>PB signal</span>
              <strong>-1.24s</strong>
              <small>100 Fly</small>
            </div>
            <div className="hero-data-card hero-data-card-b">
              <span>SPI</span>
              <strong>88</strong>
              <small>Competitive</small>
            </div>
            <div className="hero-data-card hero-data-card-c">
              <span>Forecast</span>
              <strong>90d</strong>
              <small>Goal path active</small>
            </div>
          </div>
        </div>

        <div className="relative mx-auto flex min-h-[calc(94svh-3rem)] max-w-6xl items-center px-5 py-16">
          <div className="landing-hero-copy max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-cyan-200 backdrop-blur-xl">
              <Activity aria-hidden className="h-4 w-4" />
              Swim intelligence. Made personal.
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.94] sm:text-7xl lg:text-[92px]">Your season, finally in motion.</h1>
            <p className="mt-7 max-w-xl text-lg leading-7 text-white/74 sm:text-xl">SwimSight turns every result into a live map of progress, prediction, goals, training, and team signal.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <UserActions hero />
              <a className="inline-flex h-11 items-center gap-2 rounded-full border border-white/35 px-5 text-sm font-medium transition hover:bg-white hover:text-black" href="/features">Explore features <ArrowRight aria-hidden className="h-4 w-4" /></a>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ["01", "Log", "Times, meets, gym"],
                ["02", "Analyze", "PBs, SPI, trend"],
                ["03", "Forecast", "30 to 365 days"]
              ].map(([number, title, body]) => (
                <div className="hero-mini-stat" key={title}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <small>{body}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <KineticRibbon />
      <section className="relative overflow-hidden bg-[#03070e] py-24 text-white sm:py-32">
        <div aria-hidden className="absolute inset-0 bg-[url('/images/swimsight-pool-hero.jpg')] bg-cover bg-center opacity-16" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,14,0.98),rgba(3,7,14,0.84)_48%,rgba(3,7,14,0.96))]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <Reveal>
            <p className="text-sm font-semibold text-cyan-300">Athletic intelligence</p>
            <h2 className="mt-4 max-w-xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">
              Clean signals from every race.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
              SwimSight keeps the cinematic feeling, but the product stays simple: enter a result, watch your progress, and know what to focus on next.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Input", "Manual times, spreadsheet uploads, goals, meets, and gym work."],
                ["02", "Signal", "PBs, consistency, improvement rate, and trend direction."],
                ["03", "Forecast", "Future windows that update as your season changes."]
              ].map(([number, title, body]) => (
                <article className="rounded-lg border border-white/14 bg-white/[0.075] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.20)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/45 hover:bg-white/[0.11]" key={title}>
                  <div className="font-mono text-2xl text-cyan-200">{number}</div>
                  <h3 className="mt-8 text-xl font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/64">{body}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
      <SectionTransition label="from signal to analytics" />
      <RaceTelemetry />
      <SectionTransition label="from signal to system" />

      <section id="features" className="relative overflow-hidden bg-white py-24 sm:py-36">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#03070e] to-transparent opacity-[0.08]" />
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><p className="text-sm font-semibold text-cyan-700">One place for the whole season.</p><h2 className="mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">Less dashboard. More direction.</h2></Reveal>
          <Reveal className="mt-16" delay={100}>
            <MagicBento cards={bentoCards} />
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#f5f5f7] py-24 sm:py-32">
        <div aria-hidden className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(78,232,255,0.18),transparent_62%)]" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-sm font-semibold text-cyan-700">Trust signals</p>
            <h2 className="mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">
              Analytics you can explain to a coach.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-black/58">
              SwimSight is designed to make confidence visible: what went into the prediction, what data is private, and when a forecast needs more races.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-6">
            {trustSignals.map(({ body, icon: Icon, title }, index) => (
              <Reveal className={index < 2 ? "md:col-span-3" : "md:col-span-2"} delay={index * 60} key={title}>
                <article className="group min-h-[230px] rounded-lg border border-white/75 bg-white/70 p-6 shadow-[0_28px_90px_rgba(4,17,29,0.07)] transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:bg-white">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#04111d] text-cyan-200">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <h3 className="mt-9 text-2xl font-semibold tracking-normal text-[#1d1d1f]">{title}</h3>
                  <p className="mt-4 text-sm leading-6 text-black/58">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <SeasonDepthCarousel />

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

      <KineticRibbon />
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

      <section id="contact" className="overflow-hidden bg-[#03070e] py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <Reveal>
            <p className="text-sm font-semibold text-cyan-300">Contact and review</p>
            <h2 className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">
              Help make SwimSight sharper.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
              Send feedback, review the website, or follow the build on Instagram. The fastest contact point is <span className="font-semibold text-cyan-200">@swim.sight</span>.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-200" href={instagramUrl} rel="noreferrer" target="_blank">
                <Instagram aria-hidden className="h-4 w-4" />
                Follow @swim.sight
              </a>
              <a className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition hover:bg-white hover:text-black" href="/contact">
                Review the website <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid gap-3 sm:grid-cols-2">
              {contactCards.map(({ body, icon: Icon, title }) => (
                <article className="rounded-lg border border-white/14 bg-white/[0.075] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.20)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/45 hover:bg-white/[0.11]" key={title}>
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-cyan-200 text-black">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <h3 className="mt-8 text-2xl font-semibold text-white">{title}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/66">{body}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="privacy" className="bg-white py-24 sm:py-32"><Reveal className="mx-auto max-w-4xl px-5 text-center"><ShieldCheck aria-hidden className="mx-auto h-10 w-10 text-cyan-700" /><h2 className="mt-7 text-balance text-4xl font-semibold sm:text-6xl">Your performance belongs to you.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-black/55">Account-scoped results, private communities, strict validation, and protected APIs from the first recorded time.</p><div className="mt-9 flex justify-center"><UserActions hero light /></div></Reveal></section>
      <footer className="bg-[#f5f5f7] py-10 text-sm text-black/45"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 SwimSight</span><span className="flex flex-wrap gap-3"><a className="transition hover:text-black" href="/contact">Contact</a><a className="transition hover:text-black" href={instagramUrl} rel="noreferrer" target="_blank">@swim.sight</a></span></div></footer>
    </main>
  );
}
