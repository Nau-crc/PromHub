// SlotChips is no longer used after the 0008 refactor — events now
// own their timeslot definitions directly (via TimeslotRows). This
// stub is kept only so other modules that still import it compile
// while we finish removing call sites.

import React from 'react';

interface Props {
  venueId: number | null;
  selected: string[];
  onToggle: (slotId: string) => void;
}

export const SlotChips: React.FC<Props> = () => null;
