import React, { useMemo, useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import {
  commCalc, summarizeToday, summarizeYearlyGuestsByMonth,
  summarizeYearlyReservationsByMonth, summarizeInfluencers,
  summarizeVipCapacity, venueName, digestForDay, digestForMonth,
} from './calculations';
import { round2, initials } from '@/core/utils/format';
import { isoDay } from '@/core/utils/date';
import { today } from '@/core/constants';
import { MONTHS_FULL, MONTHS_SHORT, DAYS_SHORT } from '@/core/constants';
import { SocialBadge, StarBadge } from '@/components/SocialBadge';
import { CapacityBar } from '@/components/CapacityBar';
import { EmptyBox } from '@/components/EmptyBox';

type Tab = 'today' | 'monthly' | 'yearly' | 'influencers';

export const SummaryPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');
  const { t } = useTranslation();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div className="page-title" style={{ marginBottom: 10 }}>{t('summary.title')}</div>
          </div>
          <div className="sum-tabs">
            <div className={`sum-tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>{t('summary.today')}</div>
            <div className={`sum-tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>{t('summary.monthly')}</div>
            <div className={`sum-tab ${tab === 'yearly' ? 'active' : ''}`} onClick={() => setTab('yearly')}>{t('summary.yearly')}</div>
            <div className={`sum-tab ${tab === 'influencers' ? 'active' : ''}`} onClick={() => setTab('influencers')}>{t('summary.influencers')}</div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {tab === 'today' && <TodayPanel onJumpInfluencers={() => setTab('influencers')} />}
        {tab === 'monthly' && <MonthlyPanel />}
        {tab === 'yearly' && <YearlyPanel />}
        {tab === 'influencers' && <InfluencersPanel />}
      </IonContent>
    </IonPage>
  );
};

// ── Today panel ─────────────────────────────────────────────
const TodayPanel: React.FC<{ onJumpInfluencers: () => void }> = ({ onJumpInfluencers }) => {
  const { t } = useTranslation();
  const { guests, reservations, venues } = useAppStore((s) => ({
    guests: s.guests, reservations: s.reservations, venues: s.venues,
  }));
  const open = useUIStore((s) => s.open);
  const todayKey = isoDay(today());
  const todayGuests = guests.filter((g) => g.createdAt === todayKey);
  const todayRes = reservations.filter((r) => r.createdAt === todayKey);

  if (!todayGuests.length && !todayRes.length) {
    return <><div className="spacer" /><EmptyBox>{t('summary.noGuestsYet')}</EmptyBox><div className="spacer" /></>;
  }
  // Use the day-scoped data instead of the all-time snapshot
  const summary = summarizeToday(todayGuests, todayRes, venues);
  const vipCap = summarizeVipCapacity(venues, reservations);

  return (
    <>
      <div className="spacer" />

      {/* ── Today's guests list (NEW) ───────────────────────── */}
      {todayGuests.length > 0 && (
        <div className="summary-block">
          <div className="summary-head">{t('summary.today')} — {t('summary.guests')} ({todayGuests.reduce((a, g) => a + g.pax, 0)} {t('common.paxShort')})</div>
          {todayGuests.map((g) => (
            <div key={g.id} className="list-row" onClick={() => open('guestDetail', { id: g.id })}>
              <div className={g.checked ? 'arrived-dot' : 'pending-dot'} />
              <div className="list-avatar">{initials(g.name)}</div>
              <div className="list-main">
                <div className="list-name">
                  <StarBadge on={g.influencer} />
                  <span>{g.name}</span>
                </div>
                <div className="list-sub">
                  {venueName(g.venueId, venues)} · {(g.timeslotNames || []).join(' · ') || t('common.noSlot')} · {g.pax} {t('common.paxShort')}
                </div>
              </div>
              <div className="list-right-sub" style={{ color: g.checked ? '#0F6E56' : undefined }}>
                {g.checked ? t('guests.arrived') : t('guests.pending')}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="summary-block">
        <div className="summary-head">{t('summary.byTimeslot')}</div>
        {Object.keys(summary.guestsByTimeslot).length ? (
          Object.entries(summary.guestsByTimeslot).map(([slot, n]) => (
            <div key={slot} className="detail-kv" style={{ padding: '8px 14px' }}>
              <span className="dk">{slot}</span><span className="dv">{n} {t('summary.guests').toLowerCase()}</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('summary.noGuestsYet')}</div>
        )}
        <div className="detail-kv" style={{ padding: '8px 14px', borderBottom: 'none' }}>
          <span className="dk">{t('summary.starInfluencers')}</span>
          <span className="dv" style={{ color: '#F97316', cursor: 'pointer' }} onClick={onJumpInfluencers}>
            {summary.influencerCount} →
          </span>
        </div>
      </div>

      {vipCap.length > 0 && (
        <div className="summary-block">
          <div className="summary-head">VIP</div>
          {vipCap.map((row) => (
            <div key={`${row.venueId}-${row.vipName}`} style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {row.venueName} — {row.vipName}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {row.used}{row.capacity ? ` / ${row.capacity} tables` : ''}
                </span>
              </div>
              {row.capacity > 0 && <CapacityBar pct={row.pct} warnAt={75} />}
            </div>
          ))}
        </div>
      )}

      <div className="summary-block">
        <div className="summary-head">{t('summary.reservations')}</div>
        {todayRes.length ? todayRes.map((r) => {
          const c = commCalc(r, venues);
          const net = round2(c.promoter - c.woman);
          return (
            <div key={r.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {venueName(r.venueId, venues)} · {r.vipType} · {r.pax} {t('common.paxShort')}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>€{c.price}</div>
              </div>
              <div className="comm-breakdown">
                €{c.tableTotal}<br />
                {t('reservationForm.yourCommission')} ({r.commissionPct}%): <b style={{ color: '#3B6D11' }}>€{c.promoter}</b>
                {r.fromInvite && r.womanPct > 0 && (
                  <>
                    <br />— ({r.womanPct}%): <b style={{ color: '#F97316' }}>€{c.woman}</b>
                    <br />{t('reservationForm.netToYou')}: <b style={{ color: '#3B6D11' }}>€{net}</b>
                  </>
                )}
              </div>
            </div>
          );
        }) : (
          <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('reservations.noReservations')}</div>
        )}
        {todayRes.length > 0 && (
          <TotalsBlock totP={summary.totP} totW={summary.totW} net={summary.net} />
        )}
      </div>

      <div className="spacer" />
    </>
  );
};

// ── Monthly panel ──────────────────────────────────────────
const MonthlyPanel: React.FC = () => {
  const { t } = useTranslation();
  const { guests, reservations, venues } = useAppStore((s) => ({
    guests: s.guests, reservations: s.reservations, venues: s.venues,
  }));
  // Always start in the actual current month
  const now = today();
  const [calMonth, setCalMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { day: number | null; key?: string }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, key: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  while (days.length % 7 !== 0) days.push({ day: null });

  const navMonth = (dir: -1 | 1) => {
    setCalMonth(new Date(year, month + dir, 1));
    setSelectedDay(null);
  };

  // Pre-compute which days have any activity (dot indicator)
  const activityDays = useMemo(() => {
    const set = new Set<string>();
    guests.forEach((g) => g.createdAt && set.add(g.createdAt));
    reservations.forEach((r) => r.createdAt && set.add(r.createdAt));
    return set;
  }, [guests, reservations]);

  const dayDigest = selectedDay ? digestForDay(selectedDay, guests, reservations, venues) : null;
  const monthDigest = digestForMonth(year, month, guests, reservations, venues);

  return (
    <>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => navMonth(-1)}>‹</button>
        <div className="cal-month-label">{MONTHS_FULL[month]} {year}</div>
        <button className="cal-nav-btn" onClick={() => navMonth(1)}>›</button>
      </div>
      <div className="cal-header">
        {DAYS_SHORT.map((d) => <div key={d} className="cal-hd">{d}</div>)}
      </div>
      <div className="cal-grid">
        {days.map((d, i) => {
          if (!d.day) return <div key={i} />;
          const isSelected = d.key === selectedDay;
          const hasActivity = d.key ? activityDays.has(d.key) : false;
          return (
            <div
              key={i}
              className={`cal-day${isSelected ? ' selected' : ''}`}
              onClick={() => setSelectedDay(isSelected ? null : d.key!)}
            >
              {d.day}
              {hasActivity && !isSelected && (
                <span style={{
                  position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: '#F97316',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Day detail */}
      {selectedDay && dayDigest && (
        <div className="summary-block" style={{ marginTop: 8 }}>
          <div className="summary-head">{formatLongDay(selectedDay)}</div>
          {!dayDigest.guests.length && !dayDigest.reservations.length ? (
            <div style={{ padding: '14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Nothing logged that day.
            </div>
          ) : (
            <>
              {dayDigest.guests.length > 0 && (
                <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <div className="dk" style={{ marginBottom: 6 }}>{t('summary.guests')}</div>
                  {dayDigest.guests.map((g) => (
                    <div key={g.id} style={{ fontSize: 13, padding: '3px 0' }}>
                      <StarBadge on={g.influencer} /> {g.name} · {g.pax} {t('common.paxShort')}
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}> ({venueName(g.venueId, venues)})</span>
                    </div>
                  ))}
                </div>
              )}
              {dayDigest.reservations.length > 0 && (
                <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <div className="dk" style={{ marginBottom: 6 }}>{t('summary.reservations')}</div>
                  {dayDigest.reservations.map((r) => {
                    const c = commCalc(r, venues);
                    return (
                      <div key={r.id} style={{ fontSize: 13, padding: '3px 0' }}>
                        {r.name} · {r.vipType} · {r.pax} {t('common.paxShort')}
                        <span style={{ color: '#3B6D11' }}> +€{c.promoter}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <TotalsBlock totP={dayDigest.totP} totW={dayDigest.totW} net={dayDigest.net} />
            </>
          )}
        </div>
      )}

      <div className="summary-block">
        <div className="summary-head">{MONTHS_FULL[month]}</div>
        <div className="detail-kv" style={{ padding: '8px 14px' }}>
          <span className="dk">{t('summary.guestsPax')}</span><span className="dv">{monthDigest.guestPax}</span>
        </div>
        <div className="detail-kv" style={{ padding: '8px 14px' }}>
          <span className="dk">{t('summary.reservations')}</span><span className="dv">{monthDigest.reservations.length}</span>
        </div>
        <TotalsBlock totP={monthDigest.totP} totW={monthDigest.totW} net={monthDigest.net} />
      </div>

      {Object.keys(monthDigest.vipTablesByType).length > 0 && (
        <div className="summary-block">
          <div className="summary-head">VIP</div>
          {Object.entries(monthDigest.vipTablesByType)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => (
              <div key={key} className="detail-kv" style={{ padding: '8px 14px' }}>
                <span className="dk">{key}</span>
                <span className="dv">{count}</span>
              </div>
            ))}
        </div>
      )}

      <div className="spacer" />
    </>
  );
};

const formatLongDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

// ── Reusable totals block ──────────────────────────────────
const TotalsBlock: React.FC<{ totP: number; totW: number; net: number }> = ({ totP, totW, net }) => {
  const { t } = useTranslation();
  return (
    <div style={{
      padding: '10px 14px', borderTop: '0.5px solid var(--color-border-tertiary)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{t('summary.totalEarnings')}</span>
        <span style={{ color: '#3B6D11', fontWeight: 500 }}>€{totP}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{t('summary.toPayViaInvitation')}</span>
        <span style={{ color: '#F97316', fontWeight: 500 }}>€{totW}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
        <span>{t('summary.netEarnings')}</span>
        <span style={{ color: '#3B6D11' }}>€{net}</span>
      </div>
    </div>
  );
};

// ── Yearly panel ───────────────────────────────────────────
const YearlyPanel: React.FC = () => {
  const { t } = useTranslation();
  const { guests, reservations } = useAppStore((s) => ({
    guests: s.guests, reservations: s.reservations,
  }));
  const guestsByMonth = summarizeYearlyGuestsByMonth(guests);
  const resByMonth = summarizeYearlyReservationsByMonth(reservations);
  const year = today().getFullYear();

  return (
    <>
      <div className="spacer" />
      <YearlyChart title={`${year} — ${t('summary.guests')}`} data={guestsByMonth} barColor="#F97316" />
      <YearlyChart title={`${year} — ${t('summary.reservations')}`} data={resByMonth} barColor="#3B6D11" />
      <div className="spacer" />
    </>
  );
};

const YearlyChart: React.FC<{ title: string; data: number[]; barColor: string }> = ({ title, data, barColor }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="summary-block">
      <div className="summary-head">{title}</div>
      <div style={{ padding: '16px 16px 8px' }}>
        <div className="year-bars">
          {data.map((v, i) => {
            const h = Math.max(4, Math.round((v / max) * 80));
            return (
              <div
                key={i}
                className="year-bar"
                style={{
                  height: h,
                  background: v === 0 ? 'var(--color-background-secondary)' : barColor,
                  borderRadius: '3px 3px 0 0',
                }}
                title={`${MONTHS_SHORT[i]}: ${v}`}
              />
            );
          })}
        </div>
        <div className="year-bar-label">
          {MONTHS_SHORT.map((m) => <div key={m} className="year-bar-lbl">{m}</div>)}
        </div>
      </div>
    </div>
  );
};

// ── Influencers panel ──────────────────────────────────────
const InfluencersPanel: React.FC = () => {
  const { t } = useTranslation();
  const { guests, venues } = useAppStore((s) => ({ guests: s.guests, venues: s.venues }));
  const open = useUIStore((s) => s.open);
  const rows = summarizeInfluencers(guests);

  if (!rows.length) {
    return <><div className="spacer" /><EmptyBox>{t('summary.noInfluencers')}</EmptyBox><div className="spacer" /></>;
  }

  return (
    <>
      <div className="spacer" />
      <div className="summary-block">
        <div className="summary-head">{t('summary.influencers')}</div>
        {rows.map(({ guest: g, visits }) => (
          <div key={g.id} className="list-row" onClick={() => open('guestDetail', { id: g.id })}>
            <div className="list-avatar" style={{ background: '#FFF7ED', color: '#F97316', fontSize: 16 }}>★</div>
            <div className="list-main">
              <div className="list-name">
                <span>{g.name}</span>
                <SocialBadge handle={g.igHandle} platform={g.igPlatform} />
              </div>
              <div className="list-sub">{venueName(g.venueId, venues)}</div>
            </div>
            <div className="list-right">
              <div className="list-right-val" style={{ color: '#F97316' }}>{visits}×</div>
              <div className="list-right-sub">visits</div>
            </div>
          </div>
        ))}
      </div>
      <div className="spacer" />
    </>
  );
};
