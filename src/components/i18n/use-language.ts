"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLanguageCode, languageChangeEvent, languageStorageKey, translateText, type LanguageCode } from "@/lib/i18n";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(languageStorageKey);
    if (isLanguageCode(saved)) setLanguage(saved);
  }, []);

  const updateLanguage = useCallback((nextLanguage: LanguageCode) => {
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    setLanguage(nextLanguage);
    window.dispatchEvent(new CustomEvent(languageChangeEvent, { detail: nextLanguage }));
  }, []);

  const value = useMemo(() => ({ language, setLanguage: updateLanguage }), [language, updateLanguage]);
  return createElement(LanguageContext.Provider, { value }, children);
}

function useLanguageContext() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required to use SwimSight translations.");
  return context;
}

export function useLanguage() {
  return useLanguageContext().language;
}

export function useLanguageControls() {
  return useLanguageContext();
}

export function useTranslator() {
  const language = useLanguage();
  const t = useCallback((value: string) => translateText(value, language), [language]);
  return {
    language,
    t
  };
}
