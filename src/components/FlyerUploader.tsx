import React, { useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { imageOutline, closeOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/apiClient';

// ─────────────────────────────────────────────────────────────
//  FlyerUploader — single-slot uploader for an event flyer.
//  Accepts an image (JPEG/PNG/WebP/GIF) or a short video (MP4,
//  MOV, WebM). Hands off to `api.uploadFlyer` which uses the
//  Vercel Blob client-direct token flow so videos can exceed
//  Hobby's 4.5 MB request cap.
//
//  When `value` holds a URL the preview shows the asset directly.
//  Videos render with native controls; images render at full
//  width. Tap ✕ to clear (this only nils the URL — the blob
//  itself stays in the store and gets garbage-collected later).
// ─────────────────────────────────────────────────────────────

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

const isVideoUrl = (url: string) =>
  /\.(mp4|mov|webm)(\?|$)/i.test(url);

export const FlyerUploader: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const url = await api.uploadFlyer(file);
      onChange(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--color-bg-secondary)' }}>
        {isVideoUrl(value) ? (
          <video src={value} controls style={{ width: '100%', display: 'block' }} />
        ) : (
          <img src={value} alt="" style={{ width: '100%', display: 'block' }} />
        )}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('actions.delete')}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            border: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <IonIcon icon={closeOutline} style={{ fontSize: 16 }} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        style={{
          width: '100%',
          padding: '24px 16px',
          background: 'var(--color-bg-secondary)',
          border: '1px dashed var(--color-border-tertiary)',
          borderRadius: 12,
          color: 'var(--color-text-secondary)',
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          cursor: busy ? 'progress' : 'pointer',
        }}
      >
        <IonIcon icon={imageOutline} style={{ fontSize: 26 }} />
        {busy ? t('flyerUploader.uploading') : t('flyerUploader.add')}
      </button>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>
        {t('flyerUploader.hint')}
      </div>
      {err && (
        <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 6 }}>
          {t('flyerUploader.uploadFailed', { message: err })}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
    </div>
  );
};
