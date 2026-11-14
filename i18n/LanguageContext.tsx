import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppLanguage,
  TRANSLATIONS,
  TranslationSet,
  detectDeviceLanguage,
} from './translations';
import { bleController } from '../services/bleController';

const LANG_STORAGE_KEY = 'kettle_ble_lang_v1';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  toggleLang: () => void;
  t: TranslationSet;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'uk' || saved === 'en') return saved;
  } catch {
    // ignore storage issues
  }
  return detectDeviceLanguage();
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(loadInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    bleController.setLanguage(lang);
  }, [lang]);

  const setLang = (next: AppLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore storage issues
    }
  };

  const toggleLang = () => {
    setLang(lang === 'uk' ? 'en' : 'uk');
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t: TRANSLATIONS[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const lang = detectDeviceLanguage();
    return {
      lang,
      setLang: () => {},
      toggleLang: () => {},
      t: TRANSLATIONS[lang],
    };
  }
  return ctx;
}
