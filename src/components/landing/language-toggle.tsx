"use client";

import { useEffect, useState } from "react";
import { useLanguageControls } from "@/components/i18n/use-language";
import { languageOptions, type LanguageCode } from "@/lib/i18n";

const localizedLanguageLabels: Record<LanguageCode, Record<LanguageCode, string>> = {
  en: { en: "EN", ko: "KO", vi: "VI" },
  ko: { en: "영어", ko: "한국어", vi: "베트남어" },
  vi: { en: "Anh", ko: "Hàn", vi: "Việt" }
};

const localizedLanguageNames: Record<LanguageCode, Record<LanguageCode, string>> = {
  en: { en: "English", ko: "Korean", vi: "Vietnamese" },
  ko: { en: "영어", ko: "한국어", vi: "베트남어" },
  vi: { en: "Tiếng Anh", ko: "Tiếng Hàn", vi: "Tiếng Việt" }
};

const localizedMenuLabel: Record<LanguageCode, string> = {
  en: "Language options",
  ko: "언어 선택",
  vi: "Tùy chọn ngôn ngữ"
};

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguageControls();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  return (
    <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white/76 p-0.5 shadow-[0_14px_40px_rgba(4,17,29,0.12)] backdrop-blur-xl" aria-label={localizedMenuLabel[language]} data-language-ready={ready} data-no-translate>
      {languageOptions.map((option) => (
        <button
          aria-pressed={language === option.code}
          className={`h-8 rounded-full px-2.5 text-[11px] font-semibold tracking-[0.08em] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-3 sm:tracking-[0.12em] ${
            language === option.code ? "bg-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)]" : "text-black/68 hover:bg-black/[0.045] hover:text-black"
          }`}
          key={option.code}
          title={localizedLanguageNames[language][option.code]}
          type="button"
          onClick={() => setLanguage(option.code)}
        >
          {compact ? option.code.toUpperCase() : localizedLanguageLabels[language][option.code]}
        </button>
      ))}
    </div>
  );
}
