import { create } from 'zustand';
import { storage } from '@/services/storage';
import i18n, { SUPPORTED_LOCALES, type Locale } from '@/i18n';

// ─────────────────────────────────────────────────────────────
//  Locale store. Wraps i18next with Capacitor Preferences so the
//  choice survives across native app launches (localStorage alone
//  isn't reliable in WebViews after process kills).
//
//  Choice can be 'auto' (follow OS / browser language) or one of
//  the supported locales. `resolved` is always one of the
//  supported locales — the value i18next is actually using.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'promhub.locale.v1';

export type LocaleChoice = 'auto' | Locale;

interface LocaleState {
  choice: LocaleChoice;
  resolved: Locale;
  hydrated: boolean;
  load: () => Promise<void>;
  set: (next: LocaleChoice) => Promise<void>;
}

function detectFromNavigator(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || 'en').toLowerCase();
  // Match the first 2 chars against our supported set
  const head = lang.slice(0, 2) as Locale;
  return (SUPPORTED_LOCALES as readonly string[]).includes(head) ? head : 'en';
}

function apply(locale: Locale) {
  i18n.changeLanguage(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  choice: 'auto',
  resolved: detectFromNavigator(),
  hydrated: false,

  load: async () => {
    const saved = (await storage.get<LocaleChoice>(STORAGE_KEY)) ?? 'auto';
    const resolved: Locale = saved === 'auto' ? detectFromNavigator() : saved;
    apply(resolved);
    set({ choice: saved, resolved, hydrated: true });
  },

  set: async (next) => {
    await storage.set(STORAGE_KEY, next);
    const resolved: Locale = next === 'auto' ? detectFromNavigator() : next;
    apply(resolved);
    set({ choice: next, resolved });
  },
}));
