"use client";

import { Quote, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { translateText, type LanguageCode } from "@/lib/i18n";
import type { MotivationTip } from "@/types/swim";

export function MotivationPanel() {
  const { language, t } = useTranslator();
  const [tips, setTips] = useState<MotivationTip[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetch("/api/motivation")
      .then((response) => response.json())
      .then((data) => {
        setTips(data.tips ?? []);
        setActiveIndex(0);
      })
      .catch(() => setTips([]));
  }, []);

  useEffect(() => {
    if (tips.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % tips.length);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [tips.length]);

  const activeTip = tips[activeIndex];
  const localizedTip = activeTip ? localizeMotivationTip(activeTip, language) : undefined;
  const toneClass = activeTip?.tone === "race"
    ? "from-aqua-500/24 to-blue-500/12 text-aqua-100"
    : activeTip?.tone === "recovery"
      ? "from-mint-400/20 to-white/8 text-mint-100"
      : activeTip?.tone === "confidence"
        ? "from-coral-400/20 to-white/8 text-coral-100"
        : "from-white/16 to-aqua-400/12 text-white";

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5" data-no-translate>
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-mint-400/10 text-mint-500">
          <Sparkles aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Motivation")}</h2>
          <p className="text-sm text-white/70">{t("Tips and Olympic mindset cues refresh every 30 seconds")}</p>
        </div>
      </div>

      <div>
        {activeTip ? (
          <article className={`min-h-[190px] rounded-lg border border-white/12 bg-gradient-to-br p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition ${toneClass}`} key={activeTip.id}>
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              {activeTip.kind === "quote" ? t("Olympic quote") : t("SwimSight tip")}
              </span>
              {activeTip.kind === "quote" && <Quote aria-hidden className="h-5 w-5 text-white/70" />}
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-normal text-white">{localizedTip?.title}</h3>
            <p className="mt-3 text-base leading-7 text-white/82">
              {activeTip.kind === "quote" ? `"${localizedTip?.body}"` : localizedTip?.body}
            </p>
            {activeTip.author && (
              <p className="mt-5 text-sm font-semibold text-white/84">
                {activeTip.author}
                {activeTip.sourceUrl && activeTip.sourceName && (
                  <a className="ml-2 text-aqua-200 underline decoration-white/30 underline-offset-4 transition hover:text-white" href={activeTip.sourceUrl} rel="noreferrer" target="_blank">
                    {t(activeTip.sourceName)}
                  </a>
                )}
              </p>
            )}
          </article>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-5 text-sm text-white/80">
            {t("Tips will appear after SwimSight reads your training patterns.")}
          </div>
        )}
        {tips.length > 1 && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {tips.map((tip, index) => (
                <button
                  aria-label={`${t("Show motivation")} ${index + 1}`}
                  className={`h-1.5 rounded-full transition ${activeIndex === index ? "w-7 bg-aqua-300" : "w-1.5 bg-white/25 hover:bg-white/45"}`}
                  key={tip.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-white/55">{activeIndex + 1} / {tips.length}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function localizeMotivationTip(tip: MotivationTip, language: LanguageCode) {
  if (language === "en") return tip;

  if (tip.id === "tip-focus") {
    const event = tip.body.match(/^Treat (.+) as a technical project\./)?.[1] ?? "your next race";
    return {
      ...tip,
      title: translateText(tip.title, language),
      body: language === "ko"
        ? `${translateText(event, language)}을(를) 기술 프로젝트처럼 다루세요. 세션마다 더 깔끔한 돌핀킥, 돌파, 턴 하나가 빠르게 쌓입니다.`
        : `Hãy xem ${translateText(event, language)} như một dự án kỹ thuật. Mỗi buổi tập, một pha thoát nước hoặc quay đầu sạch hơn sẽ tích lũy rất nhanh.`
    };
  }

  if (tip.id === "tip-confidence") {
    const event = tip.body.match(/^(.+) is trending well\./)?.[1] ?? "your strongest event";
    return {
      ...tip,
      title: translateText(tip.title, language),
      body: language === "ko"
        ? `${translateText(event, language)}의 추세가 좋습니다. 레이스 전에는 막연한 느낌보다 이 증거를 믿으세요.`
        : `${translateText(event, language)} đang có xu hướng tốt. Trước cuộc đua, hãy dựa vào bằng chứng đó thay vì đoán cảm giác sẵn sàng.`
    };
  }

  if (tip.id === "tip-meet") {
    const meet = tip.body.match(/^Your next meet is (.+) in (\d+) days\./);
    return {
      ...tip,
      title: translateText(tip.title, language),
      body: meet
        ? language === "ko"
          ? `다음 대회는 ${meet[1]}이고 ${meet[2]}일 남았습니다. 이번 주 매 훈련마다 통제할 수 있는 레이스 디테일 하나를 정하세요.`
          : `Giải tiếp theo của bạn là ${meet[1]} sau ${meet[2]} ngày nữa. Tuần này, hãy chọn một chi tiết cuộc đua có thể kiểm soát cho mỗi buổi tập.`
        : translateText(tip.body, language)
    };
  }

  return {
    ...tip,
    title: translateText(tip.title, language),
    body: translateText(tip.body, language)
  };
}
