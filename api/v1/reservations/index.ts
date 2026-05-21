import { safe } from '../../_safe';

export default safe(async () => {
  const { and, eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { reservationInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest } = await import('../../_lib/errors');

  return async (req, res) => {
    const tenant = await resolveTenant(req);

    if (req.method === 'GET') {
      const rows = await db
        .select()
        .from(schema.reservations)
        .where(eq(schema.reservations.tenantId, tenant.id))
        .orderBy(schema.reservations.id);
      return res.status(200).json({ reservations: rows });
    }

    if (req.method === 'POST') {
      const input = reservationInputSchema.parse(parseBody(req.body));

      const [venue] = await db
        .select({ id: schema.venues.id })
        .from(schema.venues)
        .where(and(
          eq(schema.venues.id, input.venueId),
          eq(schema.venues.tenantId, tenant.id),
        ))
        .limit(1);
      if (!venue) throw badRequest('Venue not found for this tenant');

      // PG `numeric` round-trips as strings; pass commission percentages
      // as strings to preserve the (5,2) precision Drizzle expects.
      const [row] = await db
        .insert(schema.reservations)
        .values({
          ...input,
          tenantId: tenant.id,
          commissionPct: String(input.commissionPct),
          womanPct: String(input.womanPct),
        })
        .returning();
      return res.status(201).json({ reservation: row });
    }

    throw badRequest(`Method ${req.method} not allowed`);
  };
});
