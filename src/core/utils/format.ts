import type { Platform } from '../types';

export const initials = (n: string): string =>
  n.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

export const profileUrl = (handle: string, platform: Platform): string | null => {
  if (!handle) return null;
  return platform === 'tiktok'
    ? `https://tiktok.com/@${handle}`
    : `https://instagram.com/${handle}`;
};

// Round to 2 decimals using the same convention as the MVP:
// Math.round(x * 100) / 100
export const round2 = (x: number): number => Math.round(x * 100) / 100;

// crypto.randomUUID is widely supported (Chrome 92+, Safari 15.4+,
// Firefox 95+, modern Capacitor WebViews) but a safe fallback keeps
// us working on older Android WebViews where it's missing.
export const safeUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
