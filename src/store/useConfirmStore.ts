import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
//  Imperative confirm dialog backed by IonAlert. The whole app
//  uses one shared instance (mounted in App.tsx) so every "Are
//  you sure?" prompt has identical visuals.
//
//  Usage:
//    const confirm = useConfirm();
//    if (await confirm({ title: 'Delete X?', destructive: true })) {
//      // user pressed the destructive action
//    }
// ─────────────────────────────────────────────────────────────

export interface ConfirmRequest {
  title: string;
  message?: string;
  /** Label of the affirmative button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label of the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). Defaults to false. */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (value: boolean) => void;
}

interface ConfirmState {
  pending: PendingConfirm | null;
  ask: (req: ConfirmRequest) => Promise<boolean>;
  resolve: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,
  ask: (req) =>
    new Promise<boolean>((resolve) => {
      set({ pending: { ...req, resolve } });
    }),
  resolve: (value) => {
    const cur = get().pending;
    if (cur) {
      cur.resolve(value);
      set({ pending: null });
    }
  },
}));

/** Convenience: get the imperative `ask` function. */
export const useConfirm = () => useConfirmStore((s) => s.ask);
