'use client';

import React from 'react';
import { useI18n } from '@/components/LanguageProvider';

export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();

  const toggleLanguage = () => {
    // אם אנחנו בעברית, נחליף לאנגלית, ולהפך
    setLanguage(language === 'he' ? 'en' : 'he');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
    >
      {t.switchTo}
    </button>
  );
}