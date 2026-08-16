'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language, getDictionary, DEFAULT_LANGUAGE, LANGUAGE_COOKIE } from '@/lib/i18n';
import { useRouter } from 'next/navigation';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: ReturnType<typeof getDictionary>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const router = useRouter();

  const t = getDictionary(language);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    // שמירת השפה בעוגייה לפי השם שקלוד הגדיר בקובץ המילון
    document.cookie = `${LANGUAGE_COOKIE}=${lang}; path=/; max-age=31536000`;
    router.refresh(); 
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useI18n must be used within LanguageProvider');
  }
  return context;
}