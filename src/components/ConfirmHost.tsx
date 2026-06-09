import React from 'react';
import { IonAlert } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useConfirmStore } from '@/store/useConfirmStore';

// ─────────────────────────────────────────────────────────────
//  Mount once at the app root. Renders an IonAlert tied to the
//  confirm store so any feature can request a confirmation with
//  consistent styling.
// ─────────────────────────────────────────────────────────────
export const ConfirmHost: React.FC = () => {
  const { t } = useTranslation();
  const { pending, resolve } = useConfirmStore((s) => ({
    pending: s.pending, resolve: s.resolve,
  }));
  return (
    <IonAlert
      isOpen={pending !== null}
      header={pending?.title}
      message={pending?.message}
      backdropDismiss
      onDidDismiss={() => resolve(false)}
      buttons={[
        {
          text: pending?.cancelLabel ?? t('actions.cancel'),
          role: 'cancel',
          handler: () => resolve(false),
        },
        {
          text: pending?.confirmLabel ?? t('actions.confirm'),
          role: pending?.destructive ? 'destructive' : 'confirm',
          cssClass: pending?.destructive ? 'confirm-destructive' : 'confirm-primary',
          handler: () => resolve(true),
        },
      ]}
    />
  );
};
