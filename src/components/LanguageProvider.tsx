"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "fr" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };

const LanguageContext = createContext<LanguageContextValue>({ language: "fr", setLanguage: () => undefined });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    const saved = window.localStorage.getItem("ichigo-language");
    if (saved === "en") setLanguageState("en");
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("ichigo-language", next);
  };

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
