import React from 'react';
import type { Platform } from '@/core/types';
import { profileUrl } from '@/core/utils/format';

interface Props {
  handle: string;
  platform: Platform;
}

export const SocialBadge: React.FC<Props> = ({ handle, platform }) => {
  if (!handle) return null;
  const url = profileUrl(handle, platform);
  const label = platform === 'tiktok' ? 'TT' : 'IG';
  const cls = platform === 'tiktok' ? 'tt-badge' : 'ig-badge';
  return (
    <a
      className={cls}
      href={url ?? '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  );
};

export const StarBadge: React.FC<{ on?: boolean }> = ({ on }) =>
  on ? <span className="star">★</span> : null;
