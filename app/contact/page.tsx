"use client";

import { Instagram, MessageSquareText, ShieldCheck, Star } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { SitePage } from "@/components/landing/site-page";

const instagramUrl = "https://www.instagram.com/swim.sight/";

export default function ContactPage() {
  const { t } = useTranslator();

  return (
    <>
      <SitePage
        accent="from-[#e6fbff] to-[#f5f5f7]"
        body="Questions, bug reports, feature ideas, and website reviews all go through SwimSight's Instagram for now. Send a DM to @swim.sight and include the page or feature you are talking about."
        eyebrow="Contact SwimSight"
        sections={[
          {
            eyebrow: "Instagram",
            title: "DM @swim.sight.",
            body: "The fastest way to reach SwimSight is Instagram. Send screenshots, ideas, and anything that feels confusing or broken.",
            icon: Instagram
          },
          {
            eyebrow: "Review",
            title: "Tell us how the website feels.",
            body: "A useful review mentions the first impression, mobile feel, dashboard clarity, animation smoothness, and what would make you trust the product more.",
            icon: Star
          },
          {
            eyebrow: "Safety",
            title: "Do not send private passwords.",
            body: "Feedback is welcome, but do not send passwords, secret keys, or private account credentials in a DM or screenshot.",
            icon: ShieldCheck
          }
        ]}
        title="Contact us and review the website."
      />
      <section className="bg-[#03070e] px-5 py-20 text-white">
        <div className="mx-auto max-w-4xl rounded-lg border border-white/14 bg-white/[0.075] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-300">{t("Review prompt")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{t("Send one clean review.")}</h2>
              <p className="mt-4 max-w-2xl leading-7 text-white/68">
                {t("Try this: what felt premium, what felt confusing, what lagged on mobile, and what feature should come next.")}
              </p>
            </div>
            <a className="ui-press inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-cyan-200" href={instagramUrl} rel="noreferrer" target="_blank">
              <MessageSquareText aria-hidden className="h-4 w-4" />
              {t("Message @swim.sight")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
