import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { guestInputSchema } from '../../_lib/validators';
import { badRequest } from '../../_lib/errors';

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
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

    // Integrity check: the event must belong to this tenant. The DB
    // FK ensures the event exists, but we need to enforce it's the
    // SAME tenant (otherwise tenants could cross-create rows).
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
});
