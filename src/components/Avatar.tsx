import React, { useState } from 'react';
import type { Platform } from '@/core/types';
import { initials } from '@/core/utils/format';

// ─────────────────────────────────────────────────────────────
//  Avatar with social-profile photo when available.
//
//  Instagram does NOT expose a public API for fetching a user's
//  profile picture without OAuth. We use unavatar.io as a proxy:
//    https://unavatar.io/instagram/<handle>?fallback=false
//  Returns 404 when no profile is found, which `<img onError>`
//  catches → we render the initials avatar instead.
//
//  Caveats (for the team):
//    - Third-party service. Can rate-limit or go down.
//    - For a fully reliable solution, integrate Meta Graph API
//      (Instagram Basic Display) with OAuth.
// ─────────────────────────────────────────────────────────────

interface Props {
  name: string;
  handle?: string | null;
  platform?: Platform;
  /** Visual size in pixels (square). */
  size?: number;
  /** Override the default colors. */
  bg?: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const buildSocialAvatarUrl = (platform: Platform, handle: string): string => {
  const clean = handle.replace(/^@+/, '');
  return `https://unavatar.io/${platform}/${encodeURIComponent(clean)}?fallback=false`;
};

export const Avatar: React.FC<Props> = ({
  name, handle, platform = 'instagram', size = 38,
  bg = '#FEF3C7', color = '#92400E',
  className = 'list-avatar', style,
}) => {
  const [errored, setErrored] = useState(false);
  const showImage = !!handle && !errored;
  const url = showImage ? buildSocialAvatarUrl(platform, handle!) : null;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.35)),
    background: bg,
    color,
    overflow: 'hidden',
    flexShrink: 0,
    ...style,
  };

  return (
    <div className={className} style={baseStyle}>
      {url ? (
        <img
          src={url}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
};
