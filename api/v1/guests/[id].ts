import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { guestInputSchema } from '../../_lib/validators';
import { badRequest, notFound } from '../../_lib/errors';

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
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
});
