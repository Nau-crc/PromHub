import ExcelJS from 'exceljs';
import type { NightRecord, Guest, Reservation } from '@/core/types';
import { commCalc, venueName, netToYou } from '@/features/summary/calculations';

// ─────────────────────────────────────────────────────────────
//  XLSX export — three sheets per the product spec:
//    1. Resumen (one row per NightRecord, plus totals)
//    2. Invitadas (one row per guest in any NightRecord)
//    3. Reservas (one row per reservation in any NightRecord)
//
//  All numbers come from the FROZEN snapshot. We never go back to
//  the live store — that's the entire point of NightRecord.
//
//  Formatting rules (per spec):
//    - Header row: bold, grey background, black text
//    - Alternating row banding
//    - Money columns: 2-decimal currency format
//    - Boolean-ish columns ("Influencer", "Llegó"): "Sí" / "No"
//    - Totals row in sheet 1: bold, double top border
//    - Columns auto-fit to widest content
//
//  Returns a Blob the caller can pipe to a download (browser) or
//  share via Capacitor on device.
// ─────────────────────────────────────────────────────────────

export interface ExportTranslations {
  // Sheet names
  sheet1Name: string; // "Resumen"
  sheet2Name: string; // "Invitadas"
  sheet3Name: string; // "Reservas"

  // Sheet 1 — Resumen headers
  hDate: string;
  hEvents: string;
  hGuestsPax: string;
  hReservations: string;
  hGross: string;
  hFixedFees: string;
  hPaidToInviters: string;
  hNet: string;
  hInfluencers: string;
  totalsRow: string; // "Total"

  // Sheet 2 — Invitadas headers
  hVenue: string;
  hEvent: string;
  hName: string;
  hInviteType: string;
  hPax: string;
  hSocial: string;
  hInfluencer: string;
  hArrived: string;
  hWentToClub: string;

  // Sheet 3 — Reservas headers
  hContact: string;
  hPhone: string;
  hVipType: string;
  hTimeslot: string;
  hTablePrice: string;
  hCommissionPct: string;
  hCommissionAmt: string;
  hViaInvitation: string;
  hInviterName: string;
  hInviterSocial: string;
  hInviterPct: string;
  hInviterAmt: string;
  hNetPromoter: string;

  // Booleans
  yes: string;
  no: string;
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE5E7EB' }, // light grey
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FF000000' },
};
const ZEBRA_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF9FAFB' }, // very light grey
};
const MONEY_FORMAT = '€#,##0.00';
const TOTALS_FONT: Partial<ExcelJS.Font> = { bold: true };
const TOTALS_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'double', color: { argb: 'FF000000' } },
};

export async function buildExportBlob(
  records: NightRecord[],
  tr: ExportTranslations,
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PromHub';
  wb.created = new Date();

  // ── Sheet 1: Resumen ─────────────────────────────────────
  const sum = wb.addWorksheet(tr.sheet1Name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sum.columns = [
    { header: tr.hDate, key: 'date', width: 14 },
    { header: tr.hEvents, key: 'events', width: 28 },
    { header: tr.hGuestsPax, key: 'guests', width: 14 },
    { header: tr.hReservations, key: 'reservations', width: 14 },
    { header: tr.hGross, key: 'gross', width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hFixedFees, key: 'fixedFees', width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hPaidToInviters, key: 'paid', width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hNet, key: 'net', width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hInfluencers, key: 'influencers', width: 12 },
  ];
  styleHeaderRow(sum);

  let tGuests = 0, tRes = 0, tGross = 0, tFees = 0, tPaid = 0, tNet = 0, tInf = 0;
  records.forEach((rec, i) => {
    const eventNames = rec.eventsSnapshot.map((e) => e.name).join(' · ') || '—';
    // Older NightRecords (closed before fee logic existed) won't
    // have `fixedFeesEarned` — default to 0 so the column shows
    // €0.00 instead of blank.
    const fees = rec.summary.fixedFeesEarned ?? 0;
    sum.addRow({
      date: rec.date,
      events: eventNames,
      guests: rec.summary.totalGuests,
      reservations: rec.summary.totalReservations,
      gross: rec.summary.grossCommission,
      fixedFees: fees,
      paid: rec.summary.paidToInviters,
      net: rec.summary.netCommission,
      influencers: rec.summary.influencerCount,
    });
    tGuests += rec.summary.totalGuests;
    tRes += rec.summary.totalReservations;
    tGross += rec.summary.grossCommission;
    tFees += fees;
    tPaid += rec.summary.paidToInviters;
    tNet += rec.summary.netCommission;
    tInf += rec.summary.influencerCount;
    if (i % 2 === 0) zebraRow(sum.lastRow);
  });

  // Totals row
  const totals = sum.addRow({
    date: tr.totalsRow,
    events: '',
    guests: tGuests,
    reservations: tRes,
    gross: round2(tGross),
    fixedFees: round2(tFees),
    paid: round2(tPaid),
    net: round2(tNet),
    influencers: tInf,
  });
  totals.font = TOTALS_FONT;
  totals.eachCell((cell) => { cell.border = TOTALS_BORDER; });

  // ── Sheet 2: Invitadas ───────────────────────────────────
  const gs = wb.addWorksheet(tr.sheet2Name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  gs.columns = [
    { header: tr.hDate, key: 'date', width: 14 },
    { header: tr.hVenue, key: 'venue', width: 20 },
    { header: tr.hEvent, key: 'event', width: 24 },
    { header: tr.hName, key: 'name', width: 24 },
    { header: tr.hInviteType, key: 'inviteType', width: 18 },
    { header: tr.hPax, key: 'pax', width: 8 },
    { header: tr.hSocial, key: 'social', width: 24 },
    { header: tr.hInfluencer, key: 'influencer', width: 12 },
    { header: tr.hArrived, key: 'arrived', width: 10 },
    { header: tr.hWentToClub, key: 'wentToClub', width: 14 },
  ];
  styleHeaderRow(gs);

  let gIdx = 0;
  for (const rec of records) {
    for (const g of rec.guestsSnapshot as Guest[]) {
      const eventName =
        (rec.eventsSnapshot.find((e) => e.id === g.eventId)?.name) ?? '—';
      gs.addRow({
        date: rec.date,
        venue: venueName(g.venueId, rec.venuesSnapshot),
        event: eventName,
        name: g.name,
        inviteType: (g.timeslotNames || []).join(' · ') || '—',
        pax: g.pax,
        social: g.igHandle
          ? `@${g.igHandle} (${g.igPlatform === 'tiktok' ? 'TikTok' : 'IG'})`
          : '—',
        influencer: g.influencer ? tr.yes : tr.no,
        arrived: g.checked ? tr.yes : tr.no,
        wentToClub: g.clubEventId ? tr.yes : tr.no,
      });
      if (gIdx % 2 === 0) zebraRow(gs.lastRow);
      gIdx++;
    }
  }

  // ── Sheet 3: Reservas ────────────────────────────────────
  const rs = wb.addWorksheet(tr.sheet3Name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  rs.columns = [
    { header: tr.hDate, key: 'date', width: 14 },
    { header: tr.hVenue, key: 'venue', width: 20 },
    { header: tr.hEvent, key: 'event', width: 24 },
    { header: tr.hContact, key: 'contact', width: 24 },
    { header: tr.hPhone, key: 'phone', width: 18 },
    { header: tr.hVipType, key: 'vip', width: 18 },
    { header: tr.hTimeslot, key: 'time', width: 10 },
    { header: tr.hPax, key: 'pax', width: 8 },
    { header: tr.hTablePrice, key: 'tablePrice', width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hCommissionPct, key: 'commissionPct', width: 14 },
    { header: tr.hCommissionAmt, key: 'commissionAmt', width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hViaInvitation, key: 'fromInvite', width: 14 },
    { header: tr.hInviterName, key: 'inviterName', width: 24 },
    { header: tr.hInviterSocial, key: 'inviterSocial', width: 22 },
    { header: tr.hInviterPct, key: 'inviterPct', width: 12 },
    { header: tr.hInviterAmt, key: 'inviterAmt', width: 14, style: { numFmt: MONEY_FORMAT } },
    { header: tr.hNetPromoter, key: 'netPromoter', width: 14, style: { numFmt: MONEY_FORMAT } },
  ];
  styleHeaderRow(rs);

  let rIdx = 0;
  for (const rec of records) {
    for (const r of rec.reservationsSnapshot as Reservation[]) {
      const c = commCalc(r, rec.venuesSnapshot);
      const eventName =
        (rec.eventsSnapshot.find((e) => e.id === r.eventId)?.name) ?? '—';
      rs.addRow({
        date: rec.date,
        venue: venueName(r.venueId, rec.venuesSnapshot),
        event: eventName,
        contact: r.name,
        phone: r.phoneNum ? `${r.phoneCode} ${r.phoneNum}` : '—',
        vip: r.vipType || '—',
        time: r.time || '—',
        pax: r.pax,
        tablePrice: c.price,
        commissionPct: `${r.commissionPct}%`,
        commissionAmt: c.promoter,
        fromInvite: r.fromInvite ? tr.yes : tr.no,
        inviterName: r.fromInvite ? (r.commissionEarner || '—') : '—',
        inviterSocial: r.fromInvite && r.inviterHandle
          ? `@${r.inviterHandle} (${r.inviterPlatform === 'tiktok' ? 'TikTok' : 'IG'})`
          : '—',
        inviterPct: r.fromInvite ? `${r.womanPct}%` : '—',
        inviterAmt: r.fromInvite ? c.woman : 0,
        netPromoter: netToYou(c),
      });
      if (rIdx % 2 === 0) zebraRow(rs.lastRow);
      rIdx++;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ── Helpers ────────────────────────────────────────────────
function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = HEADER_FONT;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
}

function zebraRow(row: ExcelJS.Row | undefined) {
  if (!row) return;
  row.eachCell((cell) => {
    cell.fill = ZEBRA_FILL;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build the default range filename per the spec. */
export function exportFilename(from: string, to: string): string {
  return `PromHub_${from}_${to}.xlsx`;
}

/** Trigger a browser download for the blob. Works on desktop;
 *  on Capacitor we'd swap this for the File plugin later. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
