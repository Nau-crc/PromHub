import React, { useEffect, useState } from 'react';
import { IonModal, IonContent, IonIcon } from '@ionic/react';
import { shareSocialOutline, logoWhatsapp } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useConfirm } from '@/store/useConfirmStore';
import { sendViaWhatsApp, buildGuestListMessage } from '@/services/messaging';
import {
  eventCapacity, slotCapacities, venueById, commCalc, isGuestOnEvent,
  occurs, nextOccurrence, previousOccurrence, eventScheduleLabel,
} from '@/features/summary/calculations';
import { Pill, SlotPill } from '@/components/Pill';
import { Avatar } from '@/components/Avatar';
import { initials, safeUuid } from '@/core/utils/format';
import { isoDay } from '@/core/utils/date';
import { today } from '@/core/constants';
import { StarBadge, SocialBadge } from '@/components/SocialBadge';
import { CapacityBar } from '@/components/CapacityBar';
import { CopyButton } from '@/components/CopyButton';
import { SheetHeader } from '@/components/SheetHeader';
import { listSubmissions, buildPlanUrl } from '@/services/shareApi';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: number | null;
  onEdit: (id: number) => void;
  onAddGuest: (eventId: number) => void;
  onAddRes: (eventId: number) => void;
}

export const EventDetailModal: React.FC<Props> = ({ open, onClose, eventId, onEdit, onAddGuest, onAddRes }) => {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const {
    events, venues, guests, reservations,
    togglePrivateInvite, upsertEvent, importSubmissionsAsGuests,
    promoteFromWaitlist,
  } = useAppStore((s) => ({
    events: s.events,
    venues: s.venues,
    guests: s.guests,
    reservations: s.reservations,
    togglePrivateInvite: s.togglePrivateInvite,
    upsertEvent: s.upsertEvent,
    importSubmissionsAsGuests: s.importSubmissionsAsGuests,
    promoteFromWaitlist: s.promoteFromWaitlist,
  }));
  const e = eventId != null ? events.find((x) => x.id === eventId) : null;

  // ── Per-occurrence date selector ─────────────────────────
  // Floored at today: past occurrences are deliberately excluded
  // from this view — the promoter only acts on tonight or later.
  // For one-time events: lock to event.eventDate (which may itself
  // be past — we'll show the date but the list filter hides past
  // rows anyway, so the modal degrades to "event already happened").
  // For recurring events: today if it's an occurrence, else the
  // next future occurrence. We never step back behind today.
  const todayKey = isoDay(today());
  const [selectedDate, setSelectedDate] = useState<string>('');
  useEffect(() => {
    if (!open || !e) return;
    if (e.isOneTime) {
      setSelectedDate(e.eventDate ?? '');
      return;
    }
    if (occurs(e, todayKey)) setSelectedDate(todayKey);
    else setSelectedDate(nextOccurrence(e, todayKey) ?? '');
  }, [open, e, todayKey]);

  // Background poll so submissions landing via the public form show
  // up here without a manual refresh. Same cadence as GuestsPage.
  const refresh = useAppStore((s) => s.refresh);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (cancelled) return;
      await refresh();
    };
    const id = window.setInterval(tick, 20_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, refresh]);

  if (!e) {
    return <IonModal isOpen={open} onDidDismiss={onClose}><IonContent /></IonModal>;
  }

  const v = e.venueId != null ? venueById(e.venueId, venues) : undefined;

  // Per-occurrence filter, today-floored:
  //   - belongs to this event AND
  //   - the row's eventDate is today-or-future AND
  //   - matches the selected occurrence (or has no pin → show on
  //     every future occurrence as before).
  // Rows pinned to a past date are excluded — the rule is "past
  // occurrences are discarded from this view".
  // Plain filters (no useMemo) — must not introduce conditional
  // hooks after the `if (!e)` early return above.
  const isPastPin = (rowDate: string | null) => !!rowDate && rowDate < todayKey;
  const dateMatches = (rowDate: string | null) =>
    !selectedDate || !rowDate || rowDate === selectedDate;
  // Matches if the guest's MAIN event is this event OR their late-club
  // event is — same person, same pax, surfaced in both listings so
  // the promoter sees consistent numbers per event.
  // All guests on the event (confirmed) — excluded from waitlist
  // section below. Sorted client-side by createdAt order so the
  // displayed order matches the order they came in.
  const evG = guests.filter((g) =>
    isGuestOnEvent(g, e.id)
    && !isPastPin(g.eventDate)
    && dateMatches(g.eventDate)
    && !g.waitlisted,
  );
  const evWaitlist = guests
    .filter((g) =>
      isGuestOnEvent(g, e.id)
      && !isPastPin(g.eventDate)
      && dateMatches(g.eventDate)
      && g.waitlisted)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1
      : a.createdAt > b.createdAt ? 1
      : a.id - b.id));
  const evR = reservations.filter((r) =>
    r.eventId === e.id && !isPastPin(r.eventDate) && dateMatches(r.eventDate),
  );

  // Slot ids are now event-owned (e.timeslots) post-0008.
  const ids = (e.timeslots || []).map((t) => t.id);
  const cap = eventCapacity(e.id, guests, events, selectedDate);
  const isFull = cap.capacity > 0 && cap.left <= 0;

  const occurrenceLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '—';

  const scheduleLabel = eventScheduleLabel(e);

  // Step the recurring date selector by one occurrence — but never
  // backwards past today, since past occurrences are filtered out
  // of the view anyway.
  const stepDate = (direction: -1 | 1) => {
    if (e.isOneTime || !selectedDate) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const seed = new Date(y, m - 1, d + direction);
    const seedIso = isoDay(seed);
    const next = direction === 1
      ? nextOccurrence(e, seedIso)
      : previousOccurrence(e, seedIso);
    if (!next) return;
    if (next < todayKey) return; // floor at today
    setSelectedDate(next);
  };
  const canStepBack = !e.isOneTime && !!selectedDate && selectedDate > todayKey;

  // ── Send guest list to the venue on WhatsApp ──────────────
  // Builds a formatted message with the ATTENDING guests for the
  // selected occurrence and opens WhatsApp pre-filled to the venue
  // (or club) phone. The promoter still has to tap Send in WhatsApp
  // — that's both the platform's requirement and a useful "are you
  // sure?" gate.
  //
  // Cancelled attendances are excluded (per-attendance cancellation
  // is respected). The button is disabled when the venue has no
  // phone or there's nothing to send.
  const venueHasPhone = !!(v?.phoneCode && v?.phoneNum);
  // Attending = on this event AND not cancelled FOR this event.
  // We reuse the already-computed evG (date-filtered + permissive
  // for legacy null dates).
  const attendingGuests = evG.filter((g) => {
    // Match isCancelledFor logic inline: club if linked by club,
    // main otherwise.
    if (g.clubEventId === e.id && g.eventId !== e.id) return !g.cancelledClub;
    return !g.cancelled;
  });
  const canSendList = venueHasPhone && attendingGuests.length > 0;

  const sendGuestList = async () => {
    if (!canSendList || !v) return;
    const ok = await confirm({
      title: t('eventDetail.sendListConfirmTitle'),
      message: t('eventDetail.sendListConfirmMessage', {
        venue: v.name,
        count: attendingGuests.length,
      }),
      confirmLabel: t('actions.sendOnWhatsApp'),
    });
    if (!ok) return;
    const message = buildGuestListMessage({
      eventName: e.name,
      dateLabel: occurrenceLabel,
      venueName: v.name,
      guests: attendingGuests.map((g) => ({
        name: g.name,
        pax: g.pax,
        slots: (g.timeslotNames || []).join(' · '),
        handle: g.igHandle || undefined,
      })),
      labels: {
        header: t('eventDetail.listMsg.header'),
        dateLabel: t('eventDetail.listMsg.date'),
        venueLabel: t('eventDetail.listMsg.venue'),
        totalsLine: t('eventDetail.listMsg.totals'),
        noGuests: t('eventDetail.listMsg.noGuests'),
      },
    });
    sendViaWhatsApp(
      { phoneCode: v.phoneCode ?? '', phoneNum: v.phoneNum ?? '' },
      message,
    );
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonContent>
        <SheetHeader
          title={e.name}
          onClose={onClose}
          rightExtras={<button className="btn-ghost" onClick={() => onEdit(e.id)}>{t('actions.edit')}</button>}
        />
        <div style={{ padding: '16px 16px 32px' }}>
          {v && (
            <div style={{
              fontSize: 12, color: 'var(--color-text-secondary)',
              marginBottom: 10,
            }}>
              {t('eventDetail.at')} {v.name}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <Pill tone="gray">{scheduleLabel}</Pill>
            {ids.map((id) => <SlotPill key={id} slotId={id} />)}
            {e.isOneTime && <Pill tone="blue">{t('common.oneTime')}</Pill>}
            {e.isPrivate && <Pill tone="pink">{t('common.private')}</Pill>}
            {e.isLateClub && <Pill tone="purple">{t('common.lateClub')}</Pill>}
          </div>

          {/* ── Date picker for recurring events ──────────────── */}
          {!e.isOneTime && (
            <div className="summary-block" style={{ margin: '0 0 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                <button
                  type="button" className="cal-nav-btn"
                  onClick={() => stepDate(-1)}
                  disabled={!canStepBack}
                >‹</button>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {t('eventDetail.occurrence')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {occurrenceLabel}
                  </div>
                </div>
                <button
                  type="button" className="cal-nav-btn"
                  onClick={() => stepDate(1)}
                  disabled={!selectedDate}
                >›</button>
              </div>
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', padding: '8px 12px' }}>
                <input
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  // Floor: today (past occurrences discarded). Honour
                  // a later seasonStart if the event hasn't begun yet.
                  min={
                    e.seasonStart && e.seasonStart > todayKey
                      ? e.seasonStart
                      : todayKey
                  }
                  max={e.seasonEnd ?? undefined}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    if (v && v < todayKey) return; // hard floor
                    setSelectedDate(v);
                  }}
                  style={{ fontSize: 13, padding: '8px 10px' }}
                />
                {selectedDate && !occurs(e, selectedDate) && (
                  <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>
                    {t('eventDetail.notScheduled')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Capacity for this occurrence ──────────────────── */}
          {/* Labels use the same `cap.used` / `cap.capacity` numbers
              as the slot breakdown below — so the two blocks always
              agree. Bug fix: numbers used to be re-computed locally
              from `evG.reduce(...)`, which gave a different total
              when waitlist/cancellation flags drifted. */}
          {cap.capacity > 0 ? (
            <div className="summary-block" style={{ margin: '0 0 14px' }}>
              <div className="summary-head">{t('eventDetail.capacityFor', { date: occurrenceLabel })}</div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {cap.used} / {cap.capacity} {t('summary.guests').toLowerCase()}
                  </span>
                  <span style={{ fontSize: 12, color: cap.fillClass === 'full' ? '#A32D2D' : 'var(--color-text-secondary)' }}>
                    {t('eventDetail.capLeft', { count: cap.left })}
                  </span>
                </div>
                <CapacityBar pct={cap.pct} warnAt={75} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              {t('eventDetail.noCapSet', { count: cap.used })}
            </div>
          )}

          {/* ── Per-slot capacity ───────────────────────────────
              Slot caps are the granular truth — the promoter checks
              this to see where there's still room tonight. Rendered
              only when the event has slots and there's a date. */}
          {selectedDate && (e.timeslots ?? []).length > 0 && (
            <div className="summary-block" style={{ margin: '0 0 14px' }}>
              <div className="summary-head">{t('eventDetail.bySlot')}</div>
              {slotCapacities(e, guests, selectedDate).map((s) => (
                <div key={s.slotId} style={{
                  padding: '10px 14px',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: 6,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {s.slotName}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                        {s.startTime}–{s.endTime}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 12,
                      color: s.fillClass === 'full' ? '#A32D2D'
                        : s.fillClass === 'warn' ? '#A36100'
                        : 'var(--color-text-secondary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {s.capacity > 0 ? `${s.used}/${s.capacity}` : `${s.used}`}
                    </span>
                  </div>
                  {s.capacity > 0 && <CapacityBar pct={s.pct} warnAt={75} />}
                </div>
              ))}
            </div>
          )}

          {/* ── FULL banner ───────────────────────────────────── */}
          {/* High-visibility cue when the event has hit its cap.
              New registrations from the public form now land in the
              waitlist; the banner tells the promoter to expect that. */}
          {isFull && (
            <div style={{
              background: '#FFF4D6',
              border: '1px solid #E5A100',
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 12px',
              marginBottom: 14,
              fontSize: 12, color: '#8A5A00',
              fontWeight: 500, lineHeight: 1.5,
            }}>
              ⚠︎ {t('eventDetail.fullBanner', { waitlist: evWaitlist.length })}
            </div>
          )}

          {/* ── Description with copy button ──────────────────── */}
          {e.description && (
            <div style={{
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 12px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '.04em',
                }}>{t('eventDetail.description')}</span>
                <CopyButton text={e.description} />
              </div>
              <p style={{
                fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
              }}>{e.description}</p>
            </div>
          )}

          {/* ── Guests for this occurrence ─────────────────────── */}
          <SectionHead>{t('eventDetail.guests')} ({evG.reduce((a, g) => a + g.pax, 0)} {t('common.paxShort')})</SectionHead>
          {evG.length ? (
            <div className="list-card" style={{ margin: '0 0 14px' }}>
              {evG.map((g) => (
                <div key={g.id} className="list-row" style={{ cursor: 'default' }}>
                  <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                  <div className="list-main">
                    <div className="list-name"><StarBadge on={g.influencer} /><span>{g.name}</span></div>
                    <div className="list-sub">{(g.timeslotNames || []).join(' · ') || t('common.noSlot')} · {g.pax} {t('common.paxShort')}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              {t('eventDetail.noGuestsOnDate')}
            </p>
          )}

          {/* ── Waitlist ──────────────────────────────────────── */}
          {/* Shown whenever there's anyone in the queue. The promote
              button flips `waitlisted` to false, moving the row into
              the confirmed list above and shifting the rest of the
              queue up by one (positions are computed live from the
              remaining order). */}
          {evWaitlist.length > 0 && (
            <>
              <SectionHead>
                {t('eventDetail.waitlist')} ({evWaitlist.length})
              </SectionHead>
              <div className="list-card" style={{ margin: '0 0 14px' }}>
                {evWaitlist.map((g, i) => {
                  const queueNo = i + 1;
                  const wouldFit = cap.capacity > 0
                    ? g.pax <= Math.max(0, cap.left)
                    : true;
                  return (
                    <div key={g.id} className="list-row" style={{ cursor: 'default', gap: 8 }}>
                      <div style={{
                        minWidth: 28, textAlign: 'center',
                        fontSize: 14, fontWeight: 700, color: '#8A5A00',
                      }}>
                        #{queueNo}
                      </div>
                      <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                      <div className="list-main">
                        <div className="list-name">
                          <StarBadge on={g.influencer} />
                          <span>{g.name}</span>
                        </div>
                        <div className="list-sub">
                          {g.pax} {t('common.paxShort')}
                          {!wouldFit && cap.capacity > 0 && (
                            <span style={{ color: '#A32D2D', marginLeft: 6 }}>
                              · {t('eventDetail.waitlistTooBig', { left: cap.left })}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-sm"
                        style={{
                          padding: '6px 10px', fontSize: 12,
                          background: wouldFit ? '#0F6E56' : 'var(--color-background-secondary)',
                          color: wouldFit ? '#fff' : 'var(--color-text-secondary)',
                          border: 'none',
                          borderRadius: 'var(--border-radius-sm)',
                          cursor: wouldFit ? 'pointer' : 'not-allowed',
                          flexShrink: 0,
                        }}
                        disabled={!wouldFit}
                        onClick={() => promoteFromWaitlist(g.id)}
                      >
                        {t('eventDetail.promote')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <SectionHead>{t('eventDetail.reservations')} ({evR.length})</SectionHead>
          {evR.length ? (
            <div className="list-card" style={{ margin: '0 0 14px' }}>
              {evR.map((r) => {
                const c = commCalc(r, venues);
                return (
                  <div key={r.id} className="list-row" style={{ cursor: 'default' }}>
                    <div className="list-avatar" style={{ background: '#EAF3DE', color: '#3B6D11' }}>
                      {initials(r.name)}
                    </div>
                    <div className="list-main">
                      <div className="list-name">
                        <span>{r.name}</span>
                        {r.fromInvite && <SocialBadge handle={r.inviterHandle} platform={r.inviterPlatform} />}
                      </div>
                      <div className="list-sub">
                        {r.vipType || '—'}{c.price ? ` (€${c.price})` : ''} · {r.pax} pax{r.time ? ` · ${r.time}` : ''}
                      </div>
                    </div>
                    <div className="list-right">
                      <div className="list-right-val" style={{ color: '#3B6D11', fontSize: 12 }}>+€{c.promoter}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              {t('eventDetail.noResOnDate')}
            </p>
          )}

          {e.isPrivate && (
            <>
              <SectionHead>{t('eventDetail.inviteToPrivate')}</SectionHead>
              <div className="list-card" style={{ margin: '0 0 14px' }}>
                {guests.length ? guests.map((g) => {
                  const inv = (e.invitedGuests || []).includes(g.name);
                  return (
                    <div key={g.id} className="list-row" onClick={() => togglePrivateInvite(e.id, g.name)}>
                      <Avatar name={g.name} handle={g.igHandle} platform={g.igPlatform} />
                      <div className="list-main">
                        <div className="list-name"><StarBadge on={g.influencer} /><span>{g.name}</span></div>
                      </div>
                      {inv && <Pill tone="teal">{t('common.invited')}</Pill>}
                    </div>
                  );
                }) : (
                  <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {t('guests.empty')}
                  </div>
                )}
              </div>
            </>
          )}

          <SharePanel
            event={e}
            occurrenceDate={selectedDate || null}
            onPublish={(updatedEvent) => upsertEvent(updatedEvent)}
            onSync={async (token) => {
              const { submissions } = await listSubmissions(token);
              return importSubmissionsAsGuests(e.id, submissions);
            }}
          />

          {/* Send-list-to-WhatsApp CTA. Lives above the add buttons
              because it's the high-value action right before the
              event runs — once the list is dispatched the promoter
              usually closes the modal. */}
          <button
            type="button"
            onClick={sendGuestList}
            disabled={!canSendList}
            style={{
              width: '100%',
              marginTop: 12, padding: 13,
              background: canSendList ? '#25D366' : 'var(--color-background-secondary)',
              color: canSendList ? '#fff' : 'var(--color-text-secondary)',
              border: 'none', borderRadius: 'var(--border-radius-md)',
              fontSize: 14, fontWeight: 600,
              cursor: canSendList ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <IonIcon icon={logoWhatsapp} style={{ fontSize: 18 }} />
            {t('eventDetail.sendListBtn', { count: attendingGuests.length })}
          </button>
          {!venueHasPhone && (
            <div style={{
              fontSize: 11, color: 'var(--color-text-secondary)',
              marginTop: 6, textAlign: 'center',
            }}>
              {t('eventDetail.sendListNoPhone')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onAddGuest(e.id)}>{t('eventDetail.addGuest')}</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => onAddRes(e.id)}>{t('eventDetail.addRes')}</button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

const SectionHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8,
  }}>{children}</div>
);

// ─────────────────────────────────────────────────────────────
//  SharePanel — generate a public registration link and sync
//  submissions back into the local guests list. Lives inside the
//  event detail because the link is event-scoped.
// ─────────────────────────────────────────────────────────────
interface SharePanelProps {
  event: import('@/core/types').PromEvent;
  /** Which occurrence the share link is for. For one-time events
   *  the public endpoint ignores it and uses the event's own date;
   *  for recurring events the link MUST carry one so the sign-up
   *  ends up on the right night. */
  occurrenceDate: string | null;
  onPublish: (e: import('@/core/types').PromEvent) => void;
  onSync: (token: string) => Promise<number>;
}

const SharePanel: React.FC<SharePanelProps> = ({ event, occurrenceDate, onPublish, onSync }) => {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Legacy events created before auto-token generation may not have
  // a `shareToken` yet. Generating one just means assigning a UUID
  // and saving the event back — the row itself IS the registration
  // record (no separate publish call needed).
  const generate = async () => {
    setWorking(true);
    try {
      const token = event.shareToken ?? safeUuid();
      onPublish({ ...event, shareToken: token });
      showFeedback(t('eventDetail.publicLinkReady'));
    } catch (err) {
      showFeedback(t('eventDetail.publicLinkCouldnt', { message: (err as Error).message }));
    } finally {
      setWorking(false);
    }
  };

  // The link MUST point at a specific occurrence. For one-time
  // events that's the event's own date; for recurring events it's
  // whichever night the promoter has selected in the detail view.
  const linkDate: string | null = event.isOneTime
    ? (event.eventDate ?? null)
    : occurrenceDate;
  const canShare = !!event.shareToken && !!linkDate;

  // The shared link points at /plan?d=<date>, the new multi-event
  // entry point. One link covers every event happening that night;
  // the legacy per-event /register/:token URL still works for
  // anyone who has it but isn't what we hand out anymore.
  const copyLink = async () => {
    if (!event.shareToken || !linkDate) return;
    const url = buildPlanUrl(linkDate);
    try {
      await navigator.clipboard.writeText(url);
      showFeedback(t('eventDetail.publicLinkCopied'));
    } catch {
      showFeedback(url);
    }
  };

  const shareNative = async () => {
    if (!event.shareToken || !linkDate) return;
    const url = buildPlanUrl(linkDate);
    const text = `Sign up for ${event.name}: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.name, text, url }); }
      catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      showFeedback(t('actions.copied'));
    }
  };

  // Pulls submissions from the `submissions` table (joined to the
  // event via its share token) into the local guests list.
  const pullSignups = async () => {
    if (!event.shareToken) return;
    setWorking(true);
    try {
      const added = await onSync(event.shareToken);
      showFeedback(added > 0 ? t('eventDetail.publicLinkImported', { count: added }) : t('eventDetail.publicLinkNoNew'));
    } catch (err) {
      showFeedback(t('eventDetail.publicLinkCouldntRefresh', { message: (err as Error).message }));
    } finally {
      setWorking(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  // Legacy events without a token (created before auto-gen): show
  // the "Generate link" CTA. Everything else: render the prominent
  // link card with copy/share/refresh actions.
  if (!event.shareToken) {
    return (
      <div style={{
        marginTop: 14, padding: '12px 14px',
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}>
        <SectionHead>{t('eventDetail.publicLink')}</SectionHead>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
          {t('eventDetail.publicLinkGenerate')}
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={generate}
          disabled={working}
        >
          <IonIcon icon={shareSocialOutline} style={{ fontSize: 16 }} />
          {working ? t('eventDetail.publicLinkGenerating') : t('eventDetail.publicLinkCreate')}
        </button>
        {feedback && (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
            {feedback}
          </div>
        )}
      </div>
    );
  }

  const url = canShare ? buildPlanUrl(linkDate) : '';
  const linkDateLabel = linkDate
    ? new Date(linkDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : null;
  return (
    <div style={{
      marginTop: 14, padding: '14px 14px',
      background: 'var(--color-background-primary)',
      borderRadius: 'var(--border-radius-lg)',
      border: '1px solid var(--color-primary)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <IonIcon icon={shareSocialOutline} style={{ fontSize: 18, color: 'var(--color-primary)' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {t('eventDetail.registrationLink')}
        </div>
      </div>

      {/* Date pill — makes the bound occurrence unmissable so the
          promoter knows which night they're sharing for. */}
      {linkDateLabel ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-sm)',
          padding: '4px 10px',
          fontSize: 12, fontWeight: 500,
          color: 'var(--color-text-primary)',
          marginBottom: 10,
        }}>
          📅 {linkDateLabel}
        </div>
      ) : (
        <div style={{
          fontSize: 12, color: '#A32D2D',
          background: '#FDECEC', border: '0.5px solid #F3C4C4',
          padding: '8px 10px', borderRadius: 'var(--border-radius-sm)',
          marginBottom: 10,
        }}>
          {t('eventDetail.publicLinkPickFirst')}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
        {t('eventDetail.publicLinkInfo')}
      </div>

      {canShare && (
        <div style={{
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-md)',
          padding: '10px 12px',
          fontSize: 12, color: 'var(--color-text-primary)',
          wordBreak: 'break-all',
          marginBottom: 10,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {url}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={copyLink}
          disabled={!canShare}
        >
          📋 {t('actions.copy')}
        </button>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={shareNative}
          disabled={!canShare}
        >
          <IonIcon icon={shareSocialOutline} style={{ fontSize: 14 }} /> {t('actions.share')}
        </button>
        <button
          className="btn-secondary"
          style={{ gridColumn: '1 / -1' }}
          onClick={pullSignups}
          disabled={working}
        >
          {working ? t('eventDetail.publicLinkRefreshing') : t('eventDetail.publicLinkRefresh')}
        </button>
      </div>

      {feedback && (
        <div style={{
          fontSize: 11, color: 'var(--color-text-secondary)',
          marginTop: 8, textAlign: 'center',
        }}>
          {feedback}
        </div>
      )}
    </div>
  );
};
