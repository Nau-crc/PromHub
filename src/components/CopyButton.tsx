import React, { useState } from 'react';

interface Props {
  text: string;
  /** What to display when idle. Defaults to "Copy". */
  label?: string;
  /** Optional className for the button. */
  className?: string;
  style?: React.CSSProperties;
}

// ─────────────────────────────────────────────────────────────
//  Copy-to-clipboard button with visual confirmation.
//
//  Uses navigator.clipboard when available (Capacitor WebView,
//  modern browsers). Falls back to a hidden <textarea> + execCommand
//  for older WebViews where clipboard permissions are denied.
// ─────────────────────────────────────────────────────────────
export const CopyButton: React.FC<Props> = ({ text, label = 'Copy', className = 'btn-sm', style }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Best-effort; nothing to do if both paths failed
    }
  };

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={(e) => { e.stopPropagation(); copy(); }}
      aria-label={copied ? 'Copied' : 'Copy text'}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
};
