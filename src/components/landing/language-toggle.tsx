"use client";

import { useEffect, useState } from "react";

const languages = [
  { code: "en", label: "EN", name: "English" },
  { code: "ko", label: "KO", name: "Korean" },
  { code: "vi", label: "VI", name: "Vietnamese" }
] as const;

type LanguageCode = (typeof languages)[number]["code"];

export function LanguageToggle() {
  const [language, setLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("swimsight-language");
    if (saved === "en" || saved === "ko" || saved === "vi") setLanguage(saved);
  }, []);

  function updateLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("swimsight-language", nextLanguage);
  }

  return (
    <div className="hidden items-center rounded-full border border-black/8 bg-black/[0.035] p-0.5 sm:flex" aria-label="Language options">
      {languages.map((option) => (
        <button
          aria-pressed={language === option.code}
          className={`h-8 rounded-full px-3 text-[11px] font-semibold tracking-[0.12em] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            language === option.code ? "bg-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)]" : "text-black/48 hover:text-black"
          }`}
          key={option.code}
          title={option.name}
          type="button"
          onClick={() => updateLanguage(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
