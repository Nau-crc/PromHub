import { safe } from '../../_safe';

// /api/v1/venues/[id]
//   GET    — fetch one venue
//   PATCH  — partial update
//   DELETE — drop venue + cascade future events / reservations

export default safe(async () => {
  const { and, eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { venueInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest, notFound } = await import('../../_lib/errors');

  const isoDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return async (req, res) => {
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

      // Date-aware cascade: only future events are dropped; past
      // events stay for reporting. Guests cascade via FK.
      const futureEvents = await db
        .select({
          id: schema.events.id,
          isOneTime: schema.events.isOneTime,
          eventDate: schema.events.eventDate,
          seasonEnd: schema.events.seasonEnd,
        })
        .from(schema.events)
        .where(and(
          eq(schema.events.tenantId, tenant.id),
          eq(schema.events.venueId, id),
        ));

      const futureIds = futureEvents
        .filter((e) => e.isOneTime
          ? !!e.eventDate && e.eventDate >= todayIso
          : !e.seasonEnd || e.seasonEnd >= todayIso)
        .map((e) => e.id);

      if (futureIds.length) {
        await db.delete(schema.events).where(and(
          eq(schema.events.tenantId, tenant.id),
          eq(schema.events.venueId, id),
        ));
      }

      const [row] = await db.delete(schema.venues).where(where).returning();
      if (!row) throw notFound();
      return res.status(200).json({ ok: true });
    }

    throw badRequest(`Method ${req.method} not allowed`);
  };
});
