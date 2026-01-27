'use client';

import { useSettingsStore } from '@/lib/stores';
import { translations, TranslationKey, Locale } from './translations';

export function useTranslation() {
  const locale = useSettingsStore(state => state.locale);
  
  const t = (key: TranslationKey, ...args: (string | number)[]): string => {
    const translation = translations[locale]?.[key] || translations.en[key] || key;
    
    if (args.length === 0) {
      return translation;
    }
    
    // Simple sprintf-like replacement
    let result = translation;
    args.forEach((arg, index) => {
      result = result.replace(/%[sd]/, String(arg));
    });
    
    return result;
  };
  
  return { t, locale };
}

// Server-side translation helper
export function getTranslation(locale: Locale) {
  const t = (key: TranslationKey, ...args: (string | number)[]): string => {
    const translation = translations[locale]?.[key] || translations.en[key] || key;
    
    if (args.length === 0) {
      return translation;
    }
    
    let result = translation;
    args.forEach((arg) => {
      result = result.replace(/%[sd]/, String(arg));
    });
    
    return result;
  };
  
  return { t, locale };
}
