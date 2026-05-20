import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { withErrorBoundary, parseBody } from '../../_handler';
import { db, schema } from '../../_lib/db';
import { resolveTenant } from '../../_lib/tenancy';
import { eventInputSchema } from '../../_lib/validators';
import { badRequest } from '../../_lib/errors';

export default withErrorBoundary(async (req: VercelRequest, res: VercelResponse) => {
  const tenant = await resolveTenant(req);

  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.tenantId, tenant.id))
      .orderBy(schema.events.id);
    return res.status(200).json({ events: rows });
  }

  if (req.method === 'POST') {
    const input = eventInputSchema.parse(parseBody(req.body));
    const [row] = await db
      .insert(schema.events)
      .values({ ...input, tenantId: tenant.id })
      .returning();
    return res.status(201).json({ event: row });
  }

  throw badRequest(`Method ${req.method} not allowed`);
});
