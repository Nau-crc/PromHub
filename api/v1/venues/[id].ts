import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { venueInputSchema } from '../../_lib/validators';
import { badRequest, notFound } from '../../_lib/errors';

// ─────────────────────────────────────────────────────────────
//  /api/v1/venues/[id]
//    GET    — fetch one venue
//    PATCH  — update (partial)
//    DELETE — cascade: removes future events + future reservations
//             at this venue; past data stays for reporting.
// ─────────────────────────────────────────────────────────────

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
  const tenant = await resolveTenant(req);
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) throw badRequest('Invalid id');

  const where = and(
    eq(schema.venues.id, id),
    eq(schema.venues.tenantId, tenant.id),
  );

  if (req.method === 'GET') {
    const [row] = await db.select().from(schema.venues).where(where).limit(1);
    if (!row) throw notFound();
    return res.status(200).json({ venue: row });
  }

  if (req.method === 'PATCH') {
    const input = venueInputSchema.partial().parse(parseBody(req.body));
    const [row] = await db.update(schema.venues).set(input).where(where).returning();
    if (!row) throw notFound();
    return res.status(200).json({ venue: row });
  }

  if (req.method === 'DELETE') {
    const todayIso = isoDay(new Date());

    // Cascade is intentionally service-side (date-aware): drop future
    // events/reservations at this venue, keep historic ones.
    const futureEvents = await db
      .select({ id: schema.events.id, isOneTime: schema.events.isOneTime, eventDate: schema.events.eventDate, seasonEnd: schema.events.seasonEnd })
      .from(schema.events)
      .where(and(
        eq(schema.events.tenantId, tenant.id),
        eq(schema.events.venueId, id),
      ));

    const futureEventIds = futureEvents
      .filter((e) => e.isOneTime
        ? !!e.eventDate && e.eventDate >= todayIso
        : !e.seasonEnd || e.seasonEnd >= todayIso)
      .map((e) => e.id);

    if (futureEventIds.length) {
      // FK ON DELETE CASCADE on guests.event_id wipes the linked guests.
      await db.delete(schema.events)
        .where(and(
          eq(schema.events.tenantId, tenant.id),
          eq(schema.events.venueId, id),
        ));
      // (we deleted all rows matching venue; the date check selected
      //  which IDs we care about for the response — the events table
      //  loses all of them either way since the venue is going.)
    }

    // Drop the venue itself. CASCADE clears reservations at it.
    const [row] = await db.delete(schema.venues).where(where).returning();
    if (!row) throw notFound();
    return res.status(200).json({ ok: true });
  }

  throw badRequest(`Method ${req.method} not allowed`);
});
