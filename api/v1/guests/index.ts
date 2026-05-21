import { safe } from '../../_safe';

export default safe(async () => {
  const { and, eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { guestInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest } = await import('../../_lib/errors');

  return async (req, res) => {
    const tenant = await resolveTenant(req);

    if (req.method === 'GET') {
      const rows = await db
        .select()
        .from(schema.guests)
        .where(eq(schema.guests.tenantId, tenant.id))
        .orderBy(schema.guests.id);
      return res.status(200).json({ guests: rows });
    }

    if (req.method === 'POST') {
      const input = guestInputSchema.parse(parseBody(req.body));

      // Cross-tenant integrity: the event must belong to the same tenant.
      const [event] = await db
        .select({ id: schema.events.id })
        .from(schema.events)
        .where(and(
          eq(schema.events.id, input.eventId),
          eq(schema.events.tenantId, tenant.id),
        ))
        .limit(1);
      if (!event) throw badRequest('Event not found for this tenant');

      const [row] = await db
        .insert(schema.guests)
        .values({ ...input, tenantId: tenant.id })
        .returning();
      return res.status(201).json({ guest: row });
    }

    throw badRequest(`Method ${req.method} not allowed`);
  };
});
