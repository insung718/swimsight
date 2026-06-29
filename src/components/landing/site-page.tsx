import { ArrowRight, type LucideIcon } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { Reveal } from "@/components/landing/reveal";
import { SiteNav } from "@/components/landing/site-nav";

interface SitePageSection {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

interface SitePageProps {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  sections: SitePageSection[];
}

export function SitePage({ eyebrow, title, body, accent, sections }: SitePageProps) {
  return (
    <main className="min-h-screen select-none bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteNav />
      <section className="overflow-hidden bg-white pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:pb-28">
          <Reveal>
            <p className="text-sm font-semibold text-cyan-700">{eyebrow}</p>
            <h1 className="mt-5 max-w-5xl text-balance text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-[88px]">
              {title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-black/60 sm:text-xl">{body}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <UserActions hero light />
              <a className="inline-flex h-11 items-center gap-2 rounded-full border border-black/15 px-5 text-sm font-semibold transition hover:bg-black hover:text-white" href="/">
                Back home <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={`bg-gradient-to-b ${accent} py-20 sm:py-28`}>
        <div className="mx-auto grid max-w-6xl gap-4 px-5 lg:grid-cols-3">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Reveal delay={index * 80} key={section.title}>
                <article className="min-h-[320px] rounded-lg border border-white/70 bg-white/62 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-black text-cyan-300">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <p className="mt-8 text-sm font-semibold text-cyan-800">{section.eyebrow}</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-normal">{section.title}</h2>
                  <p className="mt-5 leading-7 text-black/58">{section.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>
    </main>
  );
}
