import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import ptBR from './translations/pt-BR.json';
import enUS from './translations/en-US.json';

type Language = 'pt-BR' | 'en-US';

type TranslationKeys = typeof ptBR;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Language, TranslationKeys> = {
  'pt-BR': ptBR,
  'en-US': enUS as TranslationKeys,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'pt-BR';
  
  if (browserLang.startsWith('en')) {
    return 'en-US';
  }
  
  return 'pt-BR';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('toodrop_language') as Language;
    if (saved && (saved === 'pt-BR' || saved === 'en-US')) {
      return saved;
    }
    return detectBrowserLanguage();
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('toodrop_language', lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = getNestedValue(translations[language] as unknown as Record<string, unknown>, key);
    
    if (!text) {
      // Fallback to Portuguese if key not found
      text = getNestedValue(translations['pt-BR'] as unknown as Record<string, unknown>, key);
    }
    
    if (!text) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    
    // Replace parameters like {{name}} with actual values
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text!.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return { language: context.language, setLanguage: context.setLanguage };
}
