import React, { useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { cameraOutline, closeOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { resizePhotoForUpload } from '@/core/utils/photos';
import { api } from '@/services/apiClient';

// ─────────────────────────────────────────────────────────────
//  PhotoUploader — N image slots wired to /api/v1/photos.
//
//  Each slot is either:
//    - empty: shows a dashed "+ Add photo" tile
//    - uploading: shows a spinner overlay
//    - filled: shows the thumbnail + a small ✕ to remove
//
//  The caller owns the array of URLs; we just call `onChange`
//  every time a slot is added or removed. Resizing happens
//  client-side (see `resizePhotoForUpload`) so the eventual
//  POST stays well under Vercel's 4.5 MB cap even on phones
//  with 12 MP cameras.
//
//  `count` is the configured `event.photoCount`. We render that
//  many slots; extras (e.g. legacy guest with 5 photos but event
//  was bumped down to 3) get shown as extra fixed tiles so the
//  promoter can still see / remove them.
// ─────────────────────────────────────────────────────────────

interface Props {
  /** Number of photos the event requires (≥ 1). */
  count: number;
  /** Current URLs. */
  value: string[];
  /** Called with the next URL list on add or remove. */
  onChange: (next: string[]) => void;
  /** Force read-only (e.g. when displaying after close). */
  readOnly?: boolean;
}

export const PhotoUploader: React.FC<Props> = ({ count, value, onChange, readOnly }) => {
  const { t } = useTranslation();
  // One ref per visible slot so each tile can launch its own
  // file picker independently. We address them by index.
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const slots = Math.max(count, value.length);

  const upload = async (idx: number, file: File) => {
    setBusy(idx);
    setErr(null);
    try {
      const resized = await resizePhotoForUpload(file);
      const url = await api.uploadPhoto(resized);
      // Replace at idx if it had one; append if not.
      const next = [...value];
      if (idx < next.length) next[idx] = url;
      else next.push(url);
      onChange(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: 8,
      }}>
        {Array.from({ length: slots }).map((_, idx) => {
          const url = value[idx];
          const isBusy = busy === idx;
          return (
            <div key={idx} style={{
              position: 'relative',
              aspectRatio: '1 / 1',
              borderRadius: 8,
              overflow: 'hidden',
              border: url
                ? '1px solid var(--color-border-tertiary)'
                : '1px dashed var(--color-border-tertiary)',
              background: 'var(--color-bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {url ? (
                <>
                  <img
                    src={url}
                    alt={t('photoUploader.photoAlt', { n: idx + 1 })}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      aria-label={t('actions.delete')}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                        border: 'none', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      <IonIcon icon={closeOutline} style={{ fontSize: 14 }} />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={readOnly || isBusy}
                  onClick={() => inputs.current[idx]?.click()}
                  style={{
                    width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-secondary)', fontSize: 11,
                  }}
                >
                  {isBusy ? (
                    <span>{t('photoUploader.uploading')}</span>
                  ) : (
                    <>
                      <IonIcon icon={cameraOutline} style={{ fontSize: 22 }} />
                      <span>{t('photoUploader.add')}</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={(el) => { inputs.current[idx] = el; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Clear so picking the same file twice still fires
                  // onChange (e.g. promoter retries after a failure).
                  e.target.value = '';
                  if (file) void upload(idx, file);
                }}
              />
            </div>
          );
        })}
      </div>
      {err && (
        <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 6 }}>
          {t('photoUploader.uploadFailed', { message: err })}
        </div>
      )}
    </div>
  );
};
