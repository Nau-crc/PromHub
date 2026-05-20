import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { eventInputSchema } from '../../_lib/validators';
import { badRequest, notFound } from '../../_lib/errors';

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
  const tenant = await resolveTenant(req);
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) throw badRequest('Invalid id');

  const where = and(
    eq(schema.events.id, id),
    eq(schema.events.tenantId, tenant.id),
  );

  if (req.method === 'GET') {
    const [row] = await db.select().from(schema.events).where(where).limit(1);
    if (!row) throw notFound();
    return res.status(200).json({ event: row });
  }

  if (req.method === 'PATCH') {
    const input = eventInputSchema.partial().parse(parseBody(req.body));
    const [row] = await db.update(schema.events).set(input).where(where).returning();
    if (!row) throw notFound();
    return res.status(200).json({ event: row });
  }

  if (req.method === 'DELETE') {
    // Guests FK cascade clears guests; reservations have ON DELETE SET NULL
    // for their optional event_id, so they survive the event going away.
    const [row] = await db.delete(schema.events).where(where).returning();
    if (!row) throw notFound();
    return res.status(200).json({ ok: true });
  }

  throw badRequest(`Method ${req.method} not allowed`);
});
