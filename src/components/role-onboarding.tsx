"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Dumbbell, ShieldCheck, UserRound, UsersRound, Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import type { UserRole } from "@/types/swim";

const roleCards = [
  {
    role: "ATHLETE",
    eyebrow: "Swimmer",
    title: "Track your own season.",
    body: "Log times, goals, meets, gym work, predictions, and private comparisons.",
    icon: UserRound
  },
  {
    role: "COACH",
    eyebrow: "Coach",
    title: "Run clubs and watch athletes develop.",
    body: "Create swim groups, invite swimmers, and review their progress from one workspace.",
    icon: UsersRound
  }
] as const;

export function RoleOnboarding() {
  const router = useRouter();
  const { t } = useTranslator();
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  async function chooseRole(role: UserRole) {
    setSavingRole(role);
    setError("");

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ? t(result.error) : t("Could not save your role."));
        return;
      }

      router.refresh();
    } finally {
      setSavingRole(null);
    }
  }

  return (
    <main className="dark dashboard-shell min-h-screen text-stitch-abyss">
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
              <Waves aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">{t("SwimSight")}</div>
              <div className="text-xs text-stitch-abyss/55">{t("Choose your workspace")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <UserActions />
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1180px] items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold text-aqua-700">{t("First setup")}</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight sm:text-6xl">
              {t("What kind of SwimSight workspace do you need?")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stitch-abyss/62">
              {t("You can build your own swimmer dashboard or manage athletes from a coach dashboard. The design stays the same; the tools change around your role.")}
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {roleCards.map((card, index) => {
              const Icon = card.icon;
              const saving = savingRole === card.role;

              return (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  className="group min-h-[320px] overflow-hidden rounded-lg border border-white/65 bg-white/62 p-6 text-left shadow-stitch backdrop-blur-2xl transition hover:-translate-y-1 hover:border-stitch-cyan/70 hover:bg-white/78"
                  disabled={Boolean(savingRole)}
                  initial={{ opacity: 0, y: 18 }}
                  key={card.role}
                  transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  type="button"
                  onClick={() => chooseRole(card.role)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
                      <Icon aria-hidden className="h-6 w-6" />
                    </span>
                    <span className="rounded-full border border-stitch-abyss/10 bg-white/55 px-3 py-1 font-mono text-xs font-semibold text-stitch-abyss/58">
                      {t(card.eyebrow)}
                    </span>
                  </div>
                  <h2 className="mt-16 text-3xl font-semibold tracking-normal text-stitch-abyss">{t(card.title)}</h2>
                  <p className="mt-4 text-base leading-7 text-stitch-abyss/62">{t(card.body)}</p>
                  <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-aqua-700">
                    {saving ? <KineticLoader className="h-5 text-aqua-700" label={t("Saving role")} /> : <ShieldCheck aria-hidden className="h-5 w-5" />}
                    {saving ? t("Building workspace") : t("Choose this workspace")}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {error && (
            <div className="mx-auto mt-5 max-w-xl rounded-lg border border-coral-300/40 bg-coral-100/40 p-4 text-center text-sm font-semibold text-coral-700">
              {error}
            </div>
          )}

          <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-2 rounded-full border border-white/55 bg-white/40 px-4 py-3 text-sm text-stitch-abyss/58 backdrop-blur-xl">
            <Dumbbell aria-hidden className="h-4 w-4 text-aqua-700" />
            {t("Coach tools can see swimmer data only when the swimmer is added to a coach-managed club.")}
          </div>
        </div>
      </section>
    </main>
  );
}
