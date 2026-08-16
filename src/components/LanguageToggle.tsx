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
      className="px-3 py-1.5 text-sm font-medium text-[#0b0b0b] bg-white border border-[#e1e0d9] rounded-md shadow-sm hover:bg-gray-50 transition-colors"
    >
      {t.switchTo}
    </button>
  );
}