"use client";

import { useEffect } from "react";
import { isLanguageCode, languageChangeEvent, languageStorageKey, translations, wordTranslations, type LanguageCode } from "@/lib/i18n";

const englishPhrases = Array.from(new Set(Object.values(translations).flatMap((dictionary) => Object.keys(dictionary)))).sort((a, b) => b.length - a.length);
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
    const before = fullText[offset - 1];
    const after = fullText[offset + word.length];
    const touchesNonAsciiWord = (before && /[\p{L}\p{N}]/u.test(before)) || (after && /[\p{L}\p{N}]/u.test(after));
    if (touchesNonAsciiWord) return word;
    const lower = word.toLowerCase();
    return words[lower] ?? word;
  });

  return value.replace(trimmed, translated);
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
      if (!originalTextNodes.has(node)) originalTextNodes.set(node, node.textContent ?? "");
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
        originals[attr] = value;
        originalAttributes.set(element, originals);
      }
      element.setAttribute(attr, translateValue(originals[attr], language));
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
