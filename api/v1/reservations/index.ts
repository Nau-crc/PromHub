import type { VercelRequest, VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { reservationInputSchema } from '../../_lib/validators';
import { badRequest } from '../../_lib/errors';

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
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

    // commissionPct / womanPct are numeric in PG — pass as strings
    // so the precision/scale (5,2) is preserved.
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
});
