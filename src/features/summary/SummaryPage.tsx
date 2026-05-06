import React, { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton } from '@ionic/react';
import { useAppStore } from '@/store/useAppStore';
import { useUIStore } from '@/store/useUIStore';
import {
  commCalc, summarizeToday, summarizeYearlyGuestsByMonth,
  summarizeInfluencers, summarizeVipCapacity, venueName,
} from './calculations';
import { round2 } from '@/core/utils/format';
import { MONTHS_FULL, MONTHS_SHORT, DAYS_SHORT, TODAY } from '@/core/constants';
import { SocialBadge } from '@/components/SocialBadge';
import { CapacityBar } from '@/components/CapacityBar';
import { EmptyBox } from '@/components/EmptyBox';

type Tab = 'today' | 'monthly' | 'yearly' | 'influencers';

export const SummaryPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <div style={{ padding: '4px 16px 0' }}>
            <div className="page-title" style={{ marginBottom: 10 }}>Summary</div>
          </div>
          <div className="sum-tabs">
            <div className={`sum-tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>Today</div>
            <div className={`sum-tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>Monthly</div>
            <div className={`sum-tab ${tab === 'yearly' ? 'active' : ''}`} onClick={() => setTab('yearly')}>Yearly</div>
            <div className={`sum-tab ${tab === 'influencers' ? 'active' : ''}`} onClick={() => setTab('influencers')}>Influencers</div>
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
  const { guests, reservations, venues } = useAppStore((s) => ({
    guests: s.guests, reservations: s.reservations, venues: s.venues,
  }));
  if (!guests.length && !reservations.length) {
    return <><div className="spacer" /><EmptyBox>Nothing logged yet today.</EmptyBox><div className="spacer" /></>;
  }
  const summary = summarizeToday(guests, reservations, venues);
  const vipCap = summarizeVipCapacity(venues, reservations);

  return (
    <>
      <div className="spacer" />

      <div className="summary-block">
        <div className="summary-head">Guests by invitation type</div>
        {Object.keys(summary.guestsByInviteType).length ? (
          Object.entries(summary.guestsByInviteType).map(([t, n]) => (
            <div key={t} className="detail-kv" style={{ padding: '8px 14px' }}>
              <span className="dk">{t}</span><span className="dv">{n} guests</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>No guests yet</div>
        )}
        <div className="detail-kv" style={{ padding: '8px 14px', borderBottom: 'none' }}>
          <span className="dk">★ Influencers</span>
          <span className="dv" style={{ color: '#F97316', cursor: 'pointer' }} onClick={onJumpInfluencers}>
            {summary.influencerCount} →
          </span>
        </div>
      </div>

      {vipCap.length > 0 && (
        <div className="summary-block">
          <div className="summary-head">VIP table capacity</div>
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
        <div className="summary-head">Reservations & commissions</div>
        {reservations.length ? reservations.map((r) => {
          const c = commCalc(r, venues);
          const net = round2(c.promoter - c.woman);
          return (
            <div key={r.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {venueName(r.venueId, venues)} · {r.vipType} · {r.pax} pax
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>table €{c.price}</div>
              </div>
              <div className="comm-breakdown">
                Table: <b>€{c.tableTotal}</b><br />
                Your commission ({r.commissionPct}%): <b style={{ color: '#3B6D11' }}>€{c.promoter}</b>
                {r.fromInvite && r.womanPct > 0 && (
                  <>
                    <br />Inviter's cut ({r.womanPct}%): <b style={{ color: '#F97316' }}>€{c.woman}</b>
                    <br />Net to you: <b style={{ color: '#3B6D11' }}>€{net}</b>
                  </>
                )}
              </div>
            </div>
          );
        }) : (
          <div style={{ padding: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>No reservations</div>
        )}
        {reservations.length > 0 && (
          <div style={{
            padding: '10px 14px', borderTop: '0.5px solid var(--color-border-tertiary)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Total earnings</span>
              <span style={{ color: '#3B6D11', fontWeight: 500 }}>€{summary.totP}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>To pay via invitation</span>
              <span style={{ color: '#F97316', fontWeight: 500 }}>€{summary.totW}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, marginTop: 2 }}>
              <span>Net earnings</span>
              <span style={{ color: '#3B6D11' }}>€{summary.net}</span>
            </div>
          </div>
        )}
      </div>

      <div className="spacer" />
    </>
  );
};

// ── Monthly panel (calendar) ────────────────────────────────
const MonthlyPanel: React.FC = () => {
  const [calMonth, setCalMonth] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
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
          return (
            <div
              key={i}
              className={`cal-day${isSelected ? ' selected' : ''}`}
              onClick={() => setSelectedDay(isSelected ? null : d.key!)}
            >
              {d.day}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        Tap any day to see details.
      </div>
      <div className="spacer" />
    </>
  );
};

// ── Yearly panel ───────────────────────────────────────────
const YearlyPanel: React.FC = () => {
  const guests = useAppStore((s) => s.guests);
  const mc = summarizeYearlyGuestsByMonth(guests);
  const max = Math.max(...mc, 1);

  return (
    <>
      <div className="spacer" />
      <div className="summary-block">
        <div className="summary-head">{TODAY.getFullYear()} — Guests per month</div>
        <div style={{ padding: '16px 16px 8px' }}>
          <div className="year-bars">
            {mc.map((v, i) => {
              const h = Math.max(4, Math.round((v / max) * 80));
              return (
                <div
                  key={i}
                  className="year-bar"
                  style={{
                    height: h,
                    background: v === 0 ? 'var(--color-background-secondary)' : '#F97316',
                    borderRadius: '3px 3px 0 0',
                  }}
                />
              );
            })}
          </div>
          <div className="year-bar-label">
            {MONTHS_SHORT.map((m) => <div key={m} className="year-bar-lbl">{m}</div>)}
          </div>
        </div>
        <div style={{ padding: '0 14px 14px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Data populates as you add guests.
        </div>
      </div>
      <div className="spacer" />
    </>
  );
};

// ── Influencers panel ──────────────────────────────────────
const InfluencersPanel: React.FC = () => {
  const { guests, venues } = useAppStore((s) => ({ guests: s.guests, venues: s.venues }));
  const open = useUIStore((s) => s.open);
  const rows = summarizeInfluencers(guests);

  if (!rows.length) {
    return <><div className="spacer" /><EmptyBox>No influencers yet.</EmptyBox><div className="spacer" /></>;
  }

  return (
    <>
      <div className="spacer" />
      <div className="summary-block">
        <div className="summary-head">Influencers</div>
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

