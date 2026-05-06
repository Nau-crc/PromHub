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
