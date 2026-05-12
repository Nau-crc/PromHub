// ─────────────────────────────────────────────────────────────
//  Pre-register every Ionicon we use, so the SVG content travels
//  inline in the JS bundle instead of being lazy-loaded by the
//  `ion-icon` web component.
//
//  Why this exists:
//    - Ionic's `ion-icon` lazy-fetches SVGs from `/svg/<name>.svg`
//      by default. That folder isn't included in a Vite build, so
//      icons silently fail in production (often visible in dev too
//      depending on dependency-cache state).
//    - `addIcons({ 'name': svgString })` registers the SVG content
//      eagerly, so `<IonIcon icon={importedThing}>` or
//      `<IonIcon name="name">` both resolve from memory.
//
//  Import this module once for its side-effect from `main.tsx`.
// ─────────────────────────────────────────────────────────────

import { addIcons } from 'ionicons';
import {
  // Tab bar
  homeOutline, peopleOutline, listOutline,
  // Drawer items
  calendarOutline, businessOutline, statsChartOutline, addOutline,
  // Theme toggle
  sunnyOutline, moonOutline, contrastOutline,
  // Action buttons
  logoWhatsapp,
} from 'ionicons/icons';

addIcons({
  'home-outline': homeOutline,
  'people-outline': peopleOutline,
  'list-outline': listOutline,
  'calendar-outline': calendarOutline,
  'business-outline': businessOutline,
  'stats-chart-outline': statsChartOutline,
  'add-outline': addOutline,
  'sunny-outline': sunnyOutline,
  'moon-outline': moonOutline,
  'contrast-outline': contrastOutline,
  'logo-whatsapp': logoWhatsapp,
});
