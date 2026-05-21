import { safe } from '../../_safe';

// /api/v1/venues
//   GET  — list all venues for the tenant
//   POST — create a venue
//
// All heavy modules (Drizzle, Neon, Zod) are lazy-loaded so any
// init failure surfaces as a JSON 500 with full stack, not
// FUNCTION_INVOCATION_FAILED.

export default safe(async () => {
  const { eq } = await import('drizzle-orm');
  const { db, schema } = await import('../../_lib/db');
  const { resolveTenant } = await import('../../_lib/tenancy');
  const { venueInputSchema } = await import('../../_lib/validators');
  const { parseBody } = await import('../../_handler');
  const { badRequest } = await import('../../_lib/errors');

  return async (req, res) => {
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
  };
});
