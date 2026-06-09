import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  title: React.ReactNode;
  onClose: () => void;
  rightExtras?: React.ReactNode;
}

export const SheetHeader: React.FC<Props> = ({ title, onClose, rightExtras }) => {
  const { t } = useTranslation();
  return (
  <div
    style={{
      padding: '14px 16px 10px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      background: 'var(--color-background-primary)',
      zIndex: 10,
    }}
  >
    <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {rightExtras}
      <button type="button" className="btn-close" aria-label={t('components.closeAria')} onClick={onClose}>✕</button>
    </div>
  </div>
  );
};
