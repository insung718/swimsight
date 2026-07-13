"use client";

import { useEffect } from "react";
import { isLanguageCode, languageChangeEvent, languageStorageKey, shouldTranslateFallbackWord, translations, wordTranslations, type LanguageCode } from "@/lib/i18n";

const englishPhrases = Array.from(new Set(Object.values(translations).flatMap((dictionary) => Object.keys(dictionary))))
  .filter((phrase) => phrase.trim().length > 1)
  .sort((a, b) => b.length - a.length);
const localizedToEnglish = Object.fromEntries(Object.entries(translations).map(([language, dictionary]) => [
  language,
  Object.entries(dictionary)
    .filter(([, localized]) => localized.trim().length > 1)
    .sort((a, b) => b[1].length - a[1].length)
]));
const originalTextNodes = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();

function currentLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(languageStorageKey);
  return isLanguageCode(stored) ? stored : "en";
}

function translateValue(value: string, language: LanguageCode) {
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (language === "en") return value;

  const exactTranslation = translations[language][trimmed];
  if (exactTranslation) return value.replace(trimmed, exactTranslation);

  let translated = trimmed;
  let replacedKnownPhrase = false;
  for (const phrase of englishPhrases) {
    const next = translations[language][phrase];
    if (next && translated.includes(phrase)) {
      translated = translated.split(phrase).join(next);
      replacedKnownPhrase = true;
    }
  }
  if (replacedKnownPhrase) return value.replace(trimmed, translated);

  const words = wordTranslations[language];
  translated = translated.replace(/[A-Za-z][A-Za-z'-]*/g, (word, offset, fullText) => {
    if (!shouldTranslateFallbackWord(word, offset, fullText)) return word;
    const lower = word.toLowerCase();
    return words[lower] ?? word;
  });

  return value.replace(trimmed, translated);
}

function recoverEnglishSource(value: string, language: LanguageCode) {
  if (language === "en") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  let recovered = trimmed;
  for (const [english, localized] of localizedToEnglish[language]) {
    if (recovered === localized) return value.replace(trimmed, english);
    if (recovered.includes(localized)) recovered = recovered.split(localized).join(english);
  }
  return value.replace(trimmed, recovered);
}

function shouldSkipElement(element: Element | null) {
  if (!element) return true;
  if (element.closest("[data-no-translate]")) return true;
  return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(element.tagName);
}

function translateDocument(language: LanguageCode) {
  document.documentElement.lang = language;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (!shouldSkipElement(node.parentElement)) {
      if (!originalTextNodes.has(node)) originalTextNodes.set(node, recoverEnglishSource(node.textContent ?? "", language));
      const translated = translateValue(originalTextNodes.get(node) ?? "", language);
      if (translated !== node.textContent) node.textContent = translated;
    }
    node = walker.nextNode();
  }

  for (const element of document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]")) {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const originals = originalAttributes.get(element) ?? {};
      if (!originals[attr]) {
        originals[attr] = recoverEnglishSource(value, language);
        originalAttributes.set(element, originals);
      }
      const translated = translateValue(originals[attr], language);
      if (element.getAttribute(attr) !== translated) element.setAttribute(attr, translated);
    }
  }
}

export function TranslationLayer() {
  useEffect(() => {
    let language = currentLanguage();
    let translating = false;
    let rerunRequested = false;

    const apply = () => {
      if (translating) {
        rerunRequested = true;
        return;
      }
      translating = true;
      window.requestAnimationFrame(() => {
        translateDocument(language);
        translating = false;
        if (rerunRequested) {
          rerunRequested = false;
          apply();
        }
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
