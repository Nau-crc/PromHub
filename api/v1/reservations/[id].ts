import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { reservationInputSchema } from '../../_lib/validators';
import { badRequest, notFound } from '../../_lib/errors';

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
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
    // Numeric → string coercion for PATCH too (only when provided).
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
});
