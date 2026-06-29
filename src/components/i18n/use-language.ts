"use client";

import { useCallback, useEffect, useState } from "react";
import { isLanguageCode, languageChangeEvent, languageStorageKey, translateText, type LanguageCode } from "@/lib/i18n";

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(languageStorageKey);
    if (isLanguageCode(saved)) setLanguage(saved);

    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<LanguageCode>).detail;
      if (isLanguageCode(next)) setLanguage(next);
    };

    window.addEventListener(languageChangeEvent, onLanguageChange);
    return () => window.removeEventListener(languageChangeEvent, onLanguageChange);
  }, []);

  return language;
}

export function useTranslator() {
  const language = useLanguage();
  const t = useCallback((value: string) => translateText(value, language), [language]);
  return {
    language,
    t
  };
}
