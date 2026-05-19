import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import es from './locales/es';
import ca from './locales/ca';

// ─────────────────────────────────────────────────────────────
//  i18n bootstrap. Languages we ship:
//    - en (English) — fallback
//    - es (Spanish) — primary
//    - ca (Catalan) — Barcelona market
//
//  Detection order: explicit `localStorage('promhub.locale')` (set
//  by the in-app toggle) → navigator language → fallback. The
//  toggle in the drawer writes to localStorage AND tells i18next
//  to swap immediately — no page reload.
// ─────────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ['en', 'es', 'ca'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    // Single namespace keeps the API simple (no namespace prefixes in keys).
    defaultNS: 'common',
    ns: ['common'],
    resources: {
      en: { common: en },
      es: { common: es },
      ca: { common: ca },
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'promhub.locale',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    // Keep nested keys (so we can do t('actions.save'))
    keySeparator: '.',
  });

export default i18n;
