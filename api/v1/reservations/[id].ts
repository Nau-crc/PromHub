import { safe } from '../../_safe';

export default safe(async () => {
  const { and, eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { reservationInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest, notFound } = await import('../../_lib/errors');

  return async (req, res) => {
    const tenant = await resolveTenant(req);
    const id = Number(req.query.id);
    if (!Number.isFinite(id)) throw badRequest('Invalid id');

    const where = and(
      eq(schema.reservations.id, id),
      eq(schema.reservations.tenantId, tenant.id),
    );

    if (req.method === 'GET') {
      const [row] = await db.select().from(schema.reservations).where(where).limit(1);
      if (!row) throw notFound();
      return res.status(200).json({ reservation: row });
    }

    if (req.method === 'PATCH') {
      const input = reservationInputSchema.partial().parse(parseBody(req.body));
      const patch: Record<string, unknown> = { ...input };
      if (input.commissionPct !== undefined) patch.commissionPct = String(input.commissionPct);
      if (input.womanPct !== undefined) patch.womanPct = String(input.womanPct);
      const [row] = await db.update(schema.reservations).set(patch).where(where).returning();
      if (!row) throw notFound();
      return res.status(200).json({ reservation: row });
    }

    if (req.method === 'DELETE') {
      const [row] = await db.delete(schema.reservations).where(where).returning();
      if (!row) throw notFound();
      return res.status(200).json({ ok: true });
    }

    throw badRequest(`Method ${req.method} not allowed`);
  };
});
