import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withErrorBoundary, parseBody } from '../_handler';
import { db, schema } from '../_lib/db';
import { resolveTenant } from '../_lib/tenancy';
import { snapshotSchema } from '../_lib/validators';
import { badRequest } from '../_lib/errors';

// ─────────────────────────────────────────────────────────────
//  /api/v1/sync — POST a full local snapshot for the first run
//  after the backend ships. The client (Capacitor Preferences)
//  may have weeks of test data; this endpoint accepts everything
//  and re-keys IDs server-side, returning the mapping so the
//  client can update its in-memory references.
//
//  Idempotent? No — each call inserts. Intended to be called
//  exactly once per tenant, gated by a local "migrated: true"
//  flag in Preferences. Re-running it would duplicate data.
// ─────────────────────────────────────────────────────────────

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') throw badRequest('Method not allowed');

  const tenant = await resolveTenant(req);
  const snap = snapshotSchema.parse(parseBody(req.body));

  // Re-key venues first (events reference them)
  const venueMap = new Map<number, number>();
  for (const v of snap.venues) {
    const { clientId, ...rest } = v;
    const [row] = await db.insert(schema.venues)
      .values({ ...rest, tenantId: tenant.id })
      .returning({ id: schema.venues.id });
    venueMap.set(clientId, row.id);
  }

  // Events depend on venues; remap and insert
  const eventMap = new Map<number, number>();
  for (const e of snap.events) {
    const { clientId, venueClientId, ...rest } = e;
    const venueId = venueClientId != null ? (venueMap.get(venueClientId) ?? null) : null;
    const [row] = await db.insert(schema.events)
      .values({ ...rest, venueId, tenantId: tenant.id })
      .returning({ id: schema.events.id });
    eventMap.set(clientId, row.id);
  }

  // Guests depend on events (+ optional venue and club event)
  const guestMap = new Map<number, number>();
  for (const g of snap.guests) {
    const { clientId, eventClientId, venueClientId, clubEventClientId, ...rest } = g;
    const eventId = eventMap.get(eventClientId);
    if (!eventId) throw badRequest(`Guest references unknown event ${eventClientId}`);
    const venueId = venueClientId != null ? (venueMap.get(venueClientId) ?? null) : null;
    const clubEventId = clubEventClientId != null ? (eventMap.get(clubEventClientId) ?? null) : null;
    const [row] = await db.insert(schema.guests)
      .values({ ...rest, eventId, venueId, clubEventId, tenantId: tenant.id })
      .returning({ id: schema.guests.id });
    guestMap.set(clientId, row.id);
  }

  // Reservations depend on venues (+ optional event)
  const reservationMap = new Map<number, number>();
  for (const r of snap.reservations) {
    const { clientId, venueClientId, eventClientId, ...rest } = r;
    const venueId = venueMap.get(venueClientId);
    if (!venueId) throw badRequest(`Reservation references unknown venue ${venueClientId}`);
    const eventId = eventClientId != null ? (eventMap.get(eventClientId) ?? null) : null;
    const [row] = await db.insert(schema.reservations)
      .values({
        ...rest,
        venueId, eventId, tenantId: tenant.id,
        commissionPct: String(rest.commissionPct),
        womanPct: String(rest.womanPct),
      })
      .returning({ id: schema.reservations.id });
    reservationMap.set(clientId, row.id);
  }

  return res.status(200).json({
    ok: true,
    counts: {
      venues: venueMap.size,
      events: eventMap.size,
      guests: guestMap.size,
      reservations: reservationMap.size,
    },
    mapping: {
      venues: Object.fromEntries(venueMap),
      events: Object.fromEntries(eventMap),
      guests: Object.fromEntries(guestMap),
      reservations: Object.fromEntries(reservationMap),
    },
  });
});
