import { safe } from '../../_safe';

export default safe(async () => {
  const { eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { eventInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest } = await import('../../_lib/errors');

  return async (req, res) => {
    const tenant = await resolveTenant(req);

    if (req.method === 'GET') {
      const rows = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.tenantId, tenant.id))
        .orderBy(schema.events.id);
      return res.status(200).json({ events: rows });
    }

    if (req.method === 'POST') {
      const input = eventInputSchema.parse(parseBody(req.body));
      const [row] = await db
        .insert(schema.events)
        .values({ ...input, tenantId: tenant.id })
        .returning();
      return res.status(201).json({ event: row });
    }

    throw badRequest(`Method ${req.method} not allowed`);
  };
});
