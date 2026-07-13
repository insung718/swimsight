"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { KineticLoader } from "@/components/ui/kinetic-loader";

export function PersonalAnalyticsConsent() {
  const router = useRouter();
  const { t } = useTranslator();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function enableAnalytics() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/me/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "PERSONAL_ANALYTICS",
          action: "GRANTED",
          policyVersion: "analytics-v1"
        })
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ? t(result.error) : t("Could not save consent."));
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
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
            <span className="font-semibold">{t("SwimSight")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <UserActions />
          </div>
        </div>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[900px] items-center px-4 py-12 sm:px-6">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-lg border border-white/65 bg-white/68 p-6 text-center shadow-stitch backdrop-blur-2xl sm:p-10"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
            <ShieldCheck aria-hidden className="h-6 w-6" />
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold leading-tight sm:text-5xl">
            {t("Keep your analytics private and under your control.")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-stitch-abyss/68 sm:text-base">
            {t("SwimSight needs your permission to turn your private race history into personal analytics. Model training and public research remain off unless you consent separately.")}
          </p>
          <button
            className="mx-auto mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-stitch-abyss px-6 text-sm font-semibold text-white transition-colors hover:bg-aqua-900 disabled:cursor-wait disabled:opacity-60"
            disabled={saving}
            type="button"
            onClick={enableAnalytics}
          >
            {saving ? <KineticLoader className="h-5 text-stitch-cyan" label={t("Saving consent")} /> : t("I agree and enable analytics")}
          </button>
          <p className="mx-auto mt-5 max-w-xl text-xs leading-5 text-stitch-abyss/55">
            {t("You can withdraw this permission, export your data, or delete your account from privacy settings.")}
          </p>
          {error && <p className="mt-4 text-sm font-semibold text-coral-700">{error}</p>}
        </motion.div>
      </section>
    </main>
  );
}
