import type { VercelRequest } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db, schema } from './db.js';

// ─────────────────────────────────────────────────────────────
//  Tenancy: resolve a tenant from the X-Tenant-Id header.
//
//  The client (Capacitor app) generates a UUID v4 once on first
//  launch and stores it in Preferences. Every API call sends it
//  in `X-Tenant-Id`. The server upserts a tenant row keyed by
//  this device-id — so multiple devices stay isolated even
//  without a login.
//
//  When real auth ships, the migration is one query:
//    UPDATE tenants SET user_id = $1 WHERE device_id = $2
// ─────────────────────────────────────────────────────────────

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = 'Missing or invalid X-Tenant-Id') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

function readHeader(req: VercelRequest, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? null;
  return (v as string | undefined) ?? null;
}

/**
 * Get-or-create the tenant for this device. Returns the tenant
 * row. Throws UnauthorizedError if the header is missing or
 * malformed.
 *
 * Idempotent: running with the same device-id always returns the
 * same row. We do the lookup first to avoid a needless INSERT on
 * every request (the common path).
 */
export async function resolveTenant(req: VercelRequest) {
  const deviceId = readHeader(req, 'x-tenant-id');
  if (!deviceId || !UUID_RX.test(deviceId)) {
    throw new UnauthorizedError();
  }

  const existing = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.deviceId, deviceId))
    .limit(1);

  if (existing.length) return existing[0];

  const inserted = await db
    .insert(schema.tenants)
    .values({ deviceId })
    .returning();
  return inserted[0];
}
