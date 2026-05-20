import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { venueInputSchema } from '../../_lib/validators';
import { badRequest } from '../../_lib/errors';

// ─────────────────────────────────────────────────────────────
//  /api/v1/venues
//    GET  — list all venues for the authenticated tenant
//    POST — create a venue
// ─────────────────────────────────────────────────────────────

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
  const tenant = await resolveTenant(req);

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.tenantId, tenant.id))
      .orderBy(schema.venues.id);
    return res.status(200).json({ venues: rows });
  }

  if (req.method === 'POST') {
    const input = venueInputSchema.parse(parseBody(req.body));
    const [row] = await db
      .insert(schema.venues)
      .values({ ...input, tenantId: tenant.id })
      .returning();
    return res.status(201).json({ venue: row });
  }

  throw badRequest(`Method ${req.method} not allowed`);
});
