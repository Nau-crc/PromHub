// /api/v1/venues — GET list, POST create.
//
// Hand-rolled try/catch instead of `safe()` so we eliminate the
// wrapper as a possible failure point while debugging deploys.
// Once we confirm this works, we can collapse back to `safe()`.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS first, unconditionally — never blocked by a try/catch.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Id');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Everything heavy is lazily imported, so any module-load
    // failure surfaces in the catch below as JSON.
    const { eq } = await import('drizzle-orm');
    const { db, schema } = await import('../../_lib/db');
    const { resolveTenant } = await import('../../_lib/tenancy');
    const { venueInputSchema } = await import('../../_lib/validators');
    const { parseBody } = await import('../../_handler');

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

    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error('[api/v1/venues]', err);
    const e = (err ?? {}) as { name?: string; message?: string; status?: number; stack?: string; issues?: unknown };
    if (e.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', name: 'ZodError', issues: e.issues });
    }
    return res.status(e.status ?? 500).json({
      error: e.message || 'Internal error',
      name: e.name || 'Error',
      status: e.status ?? 500,
      stack: typeof e.stack === 'string' ? e.stack.split('\n').slice(0, 15) : undefined,
    });
  }
}
