// English — fallback locale. Keep this file authoritative: every key
// declared here MUST also exist in es.ts / ca.ts (i18next falls back
// here when a key is missing).
//
// Note: do NOT use `as const` here. We export the value with `string`
// types (not literal types) so es.ts / ca.ts can provide their own
// translations while still being structurally typed against this
// object's shape (via `LocaleStrings = typeof en`).
const en = {
  // ── Common actions / verbs ─────────────────────────────────
  actions: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    confirm: 'Confirm',
    done: 'Done',
    back: 'Back',
    continue: 'Continue',
    skip: 'Skip for now',
    copy: 'Copy',
    copied: 'Copied',
    sendOnWhatsApp: 'Send on WhatsApp',
  },

  // ── Bottom-nav tabs ───────────────────────────────────────
  nav: {
    home: 'Home',
    guests: 'Guests',
    reservations: 'Reservations',
  },

  // ── Drawer sections ───────────────────────────────────────
  drawer: {
    manage: 'Manage',
    quickAdd: 'Quick add',
    events: 'Events',
    venues: 'Venues',
    summary: 'Summary',
    newEvent: 'New event',
    newVenue: 'New venue',
    appearance: 'Appearance',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    auto: 'Auto',
  },

  // ── Page titles & headers ─────────────────────────────────
  home: {
    subtitle: "Today's events",
    addBtn: '+ Event',
    empty: 'No events today.',
    emptySub: 'All scheduled events will show here on their date.',
  },
  guests: {
    title: 'Guest list',
    addBtn: '+ Add',
    venueAll: 'All',
    swipeHint: '← swipe to mark arrived  ·  swipe → to cancel',
    empty: 'No guests yet.',
    emptySub: 'Tap <b>+ Add</b> to add your first guest.',
    arrived: 'Arrived',
    pending: 'Pending',
    cancelled: 'Cancelled',
    markArrived: '✓ Arrived',
    markPending: 'Mark pending',
    cancelInvite: '✕ Cancel',
    restore: 'Restore',
  },
  reservations: {
    title: 'Reservations',
    addBtn: '+ Add',
    empty: 'No reservations yet.',
    emptySub: 'Tap <b>+ Add</b> to log a VIP table.',
  },
  events: {
    title: 'Events',
    addBtn: '+ Add',
    filterUpcoming: 'Upcoming',
    filterPast: 'Past',
    filterAll: 'All',
    emptyView: 'No events in this view.',
  },
  venues: {
    title: 'Venues',
    addBtn: '+ Add',
    empty: 'No venues yet.',
    emptySub: 'Tap <b>+ Add</b> to add your first venue.',
  },
  summary: {
    title: 'Summary',
    today: 'Today',
    monthly: 'Monthly',
    yearly: 'Yearly',
    influencers: 'Influencers',
  },

  // ── Onboarding (welcome + legend) ─────────────────────────
  onboarding: {
    welcome: 'Welcome to PromHub',
    welcomeSub: "All-in-one logistics for Barcelona's night promoters.",
    cta: "Let's get started →",
    feature: {
      guestsTitle: 'Guest lists',
      guestsSub: 'Custom invite types, influencer tracking, club access',
      reservationsTitle: 'Reservations',
      reservationsSub: 'VIP tables per pax range, table capacity, commissions',
      eventsTitle: 'Events',
      eventsSub: 'Recurring on multiple days, custom timeslots',
      summaryTitle: 'Summary',
      summarySub: 'Daily, monthly & yearly earnings',
    },
    legendTitle: 'Color & icon legend',
    legendSub: 'A quick reference so you can read the app at a glance.',
    legendGot: 'Got it →',
    doneTitle: "You're all set!",
    doneCta: 'Open PromHub →',
  },
};

// Derives the shape from the English bundle so es.ts / ca.ts get a
// compile-time error if a key is missing, but values remain plain
// `string` so each locale supplies its own translation.
export type LocaleStrings = typeof en;

export default en;
