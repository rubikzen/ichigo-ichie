"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "fr" | "en";
type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "fr",
  setLanguage: () => undefined,
});

function syncDocumentLanguage(language: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
}

function persistLanguage(language: Language) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("ichigo-language", language);
  document.cookie = `ichigo-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    const saved = window.localStorage.getItem("ichigo-language");
    const initial: Language = saved === "en" ? "en" : "fr";
    setLanguageState(initial);
    syncDocumentLanguage(initial);
    persistLanguage(initial);
  }, []);

  useEffect(() => {
    syncDocumentLanguage(language);
  }, [language]);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    syncDocumentLanguage(next);
    persistLanguage(next);
  };

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
