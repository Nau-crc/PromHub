import { safe } from '../../_safe';

export default safe(async () => {
  const { and, eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { guestInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest, notFound } = await import('../../_lib/errors');

  return async (req, res) => {
    const tenant = await resolveTenant(req);
    const id = Number(req.query.id);
    if (!Number.isFinite(id)) throw badRequest('Invalid id');

    const where = and(
      eq(schema.guests.id, id),
      eq(schema.guests.tenantId, tenant.id),
    );

    if (req.method === 'GET') {
      const [row] = await db.select().from(schema.guests).where(where).limit(1);
      if (!row) throw notFound();
      return res.status(200).json({ guest: row });
    }

    if (req.method === 'PATCH') {
      const input = guestInputSchema.partial().parse(parseBody(req.body));
      const [row] = await db.update(schema.guests).set(input).where(where).returning();
      if (!row) throw notFound();
      return res.status(200).json({ guest: row });
    }

    if (req.method === 'DELETE') {
      const [row] = await db.delete(schema.guests).where(where).returning();
      if (!row) throw notFound();
      return res.status(200).json({ ok: true });
    }

    throw badRequest(`Method ${req.method} not allowed`);
  };
});
