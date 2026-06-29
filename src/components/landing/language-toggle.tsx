"use client";

import { useEffect, useState } from "react";
import { isLanguageCode, languageChangeEvent, languageOptions, languageStorageKey, type LanguageCode } from "@/lib/i18n";

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

export function LanguageToggle() {
  const [language, setLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(languageStorageKey);
    if (isLanguageCode(saved)) setLanguage(saved);
  }, []);

  function updateLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    window.dispatchEvent(new CustomEvent(languageChangeEvent, { detail: nextLanguage }));
  }

  return (
    <div className="flex items-center rounded-full border border-black/10 bg-white/76 p-0.5 shadow-[0_14px_40px_rgba(4,17,29,0.12)] backdrop-blur-xl" aria-label={localizedMenuLabel[language]} data-no-translate>
      {languageOptions.map((option) => (
        <button
          aria-pressed={language === option.code}
          className={`h-8 rounded-full px-3 text-[11px] font-semibold tracking-[0.12em] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            language === option.code ? "bg-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)]" : "text-black/48 hover:text-black"
          }`}
          key={option.code}
          title={localizedLanguageNames[language][option.code]}
          type="button"
          onClick={() => updateLanguage(option.code)}
        >
          {localizedLanguageLabels[language][option.code]}
        </button>
      ))}
    </div>
  );
}
