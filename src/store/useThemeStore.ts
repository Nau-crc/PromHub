import { create } from 'zustand';
import { storage } from '@/services/storage';

// ─────────────────────────────────────────────────────────────
//  Theme: 'system' | 'light' | 'dark'.
//  - 'system' tracks `prefers-color-scheme` and updates live.
//  - explicit 'light' / 'dark' override the system preference.
//
//  Persisted under 'promhub.theme.v1'. Applied to the document by
//  setting `data-theme="light|dark"` on <html>.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'promhub.theme.v1';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  hydrated: boolean;
  load: () => Promise<void>;
  set: (next: ThemeChoice) => Promise<void>;
}

function systemPrefers(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
}

let mediaWatcher: MediaQueryList | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  choice: 'system',
  resolved: systemPrefers(),
  hydrated: false,

  load: async () => {
    const saved = (await storage.get<ThemeChoice>(STORAGE_KEY)) ?? 'system';
    const resolved: ResolvedTheme = saved === 'system' ? systemPrefers() : saved;
    apply(resolved);
    set({ choice: saved, resolved, hydrated: true });

    // Live-update when the user is on 'system' and their OS preference changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaWatcher?.removeEventListener?.('change', onSystemChange);
      mediaWatcher = window.matchMedia('(prefers-color-scheme: dark)');
      mediaWatcher.addEventListener('change', onSystemChange);
    }
  },

  set: async (next) => {
    await storage.set(STORAGE_KEY, next);
    const resolved: ResolvedTheme = next === 'system' ? systemPrefers() : next;
    apply(resolved);
    set({ choice: next, resolved });
  },
}));

function onSystemChange() {
  const { choice, set: setStore } = useThemeStore.getState();
  if (choice !== 'system') return;
  const resolved = systemPrefers();
  apply(resolved);
  setStore('system'); // re-apply persists nothing new but updates resolved
  useThemeStore.setState({ resolved });
}
