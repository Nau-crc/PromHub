import { db, schema } from './db.js';

// ─────────────────────────────────────────────────────────────
//  Shared workspace (formerly multi-tenancy).
//
//  Decision: every device reads and writes against the same
//  dataset. The tenant_id column stays in the schema (so we can
//  re-introduce per-user scoping when real auth lands) but
//  there's only ever ONE tenant row — `SHARED_TENANT_ID` — and
//  every query inserts/reads against it.
//
//  Reads don't filter by tenant_id any more — they return whatever
//  is in the table — so legacy rows that were created under
//  earlier per-device tenants stay visible too.
// ─────────────────────────────────────────────────────────────

/** Fixed UUID used as `tenant_id` for every new row. */
export const SHARED_TENANT_ID = '00000000-0000-0000-0000-000000000000';

const SHARED_TENANT_DEVICE_ID = 'shared';

// Cached per cold-start so we only round-trip once.
let ensured = false;

/**
 * Idempotently ensure the singleton tenant row exists, so the
 * foreign-key constraint on every other table is satisfied.
 *
 * Safe to call on every request — it's a no-op after the first
 * successful call.
 */
export async function ensureSharedTenant(): Promise<void> {
  if (ensured) return;
  await db
    .insert(schema.tenants)
    .values({
      id: SHARED_TENANT_ID,
      deviceId: SHARED_TENANT_DEVICE_ID,
    })
    .onConflictDoNothing();
  ensured = true;
}
