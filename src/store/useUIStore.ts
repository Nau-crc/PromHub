import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
//  Mirrors the original `openSheet(mode, data)` orchestration:
//  any screen / modal can request the opening of any modal by
//  setting `mode` and an associated `payload`.
//
//  Only one modal is open at a time (matches MVP behaviour).
// ─────────────────────────────────────────────────────────────

export type ModalMode =
  | null
  | 'addEvent'
  | 'editEvent'
  | 'eventDetail'
  | 'addGuest'
  | 'editGuest'
  | 'guestDetail'
  | 'addRes'
  | 'editRes'
  | 'resDetail'
  | 'addVenue'
  | 'editVenue';

export interface ModalPayload {
  // generic id (event/guest/res/venue id)
  id?: number;
  // contextual seeds
  eventId?: number;
  venueId?: number;
}

interface UIState {
  mode: ModalMode;
  payload: ModalPayload;
  open: (mode: ModalMode, payload?: ModalPayload) => void;
  close: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  mode: null,
  payload: {},
  open: (mode, payload = {}) => set({ mode, payload }),
  close: () => set({ mode: null, payload: {} }),
}));
