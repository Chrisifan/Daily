import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zh from "../locales/zh.json";
import en from "../locales/en.json";

const STORAGE_KEY = "daily-settings";

function getStoredSettings(): { language?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getStoredLanguage(): string {
  return getStoredSettings().language ?? "zh";
}

export function storeLanguage(lang: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, language: lang }));
  } catch {
    // ignore
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: getStoredLanguage(),
    fallbackLng: "zh",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

// Sync language changes back to localStorage
i18n.on("languageChanged", (lng) => {
  storeLanguage(lng);
});

export default i18n;
