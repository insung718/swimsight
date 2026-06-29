"use client";

import { useEffect } from "react";
import { isLanguageCode, languageChangeEvent, languageStorageKey, translations, type LanguageCode } from "@/lib/i18n";

const translatedToEnglish = new Map<string, string>();
for (const dictionary of Object.values(translations)) {
  for (const [english, translated] of Object.entries(dictionary)) {
    translatedToEnglish.set(translated, english);
  }
}

const englishPhrases = Array.from(new Set(Object.values(translations).flatMap((dictionary) => Object.keys(dictionary)))).sort((a, b) => b.length - a.length);
const translatedPhrases = Array.from(translatedToEnglish.keys()).sort((a, b) => b.length - a.length);

function currentLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(languageStorageKey);
  return isLanguageCode(stored) ? stored : "en";
}

function translateValue(value: string, language: LanguageCode) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  let english = translatedToEnglish.get(trimmed) ?? trimmed;

  for (const phrase of translatedPhrases) {
    const source = translatedToEnglish.get(phrase);
    if (source && english.includes(phrase)) english = english.split(phrase).join(source);
  }

  if (language === "en") return value.replace(trimmed, english);

  let translated = translations[language][english] ?? english;
  for (const phrase of englishPhrases) {
    const next = translations[language][phrase];
    if (next && translated.includes(phrase)) translated = translated.split(phrase).join(next);
  }

  return value.replace(trimmed, translated);
}

function shouldSkipElement(element: Element | null) {
  if (!element) return true;
  return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(element.tagName);
}

function translateDocument(language: LanguageCode) {
  document.documentElement.lang = language;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (!shouldSkipElement(node.parentElement)) {
      const translated = translateValue(node.textContent ?? "", language);
      if (translated !== node.textContent) node.textContent = translated;
    }
    node = walker.nextNode();
  }

  for (const element of document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]")) {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const value = element.getAttribute(attr);
      if (value) element.setAttribute(attr, translateValue(value, language));
    }
  }
}

export function TranslationLayer() {
  useEffect(() => {
    let language = currentLanguage();
    let translating = false;

    const apply = () => {
      if (translating) return;
      translating = true;
      window.requestAnimationFrame(() => {
        translateDocument(language);
        translating = false;
      });
    };

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, {
      attributeFilter: ["aria-label", "placeholder", "title"],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    apply();

    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<LanguageCode>).detail;
      language = isLanguageCode(next) ? next : currentLanguage();
      apply();
    };

    window.addEventListener(languageChangeEvent, onLanguageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener(languageChangeEvent, onLanguageChange);
    };
  }, []);

  return null;
}
