import React from 'react';
import type { Platform } from '@/core/types';

interface Props {
  value: Platform;
  onChange: (p: Platform) => void;
}

export const PlatformPicker: React.FC<Props> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
    <button
      type="button"
      className={`tog-btn ${value === 'instagram' ? 'on' : ''}`}
      onClick={() => onChange('instagram')}
    >
      Instagram
    </button>
    <button
      type="button"
      className={`tog-btn ${value === 'tiktok' ? 'on' : ''}`}
      onClick={() => onChange('tiktok')}
    >
      TikTok
    </button>
  </div>
);
