import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// ─────────────────────────────────────────────────────────────
//  Drizzle client over Neon's HTTP driver.
//
//  Vercel's Neon integration lets you set a custom env-var prefix
//  (e.g. `promhubbd_DATABASE_URL` instead of plain `DATABASE_URL`).
//  We scan the env for any variable matching `(*_)?DATABASE_URL`
//  or `(*_)?POSTGRES_URL` so it works regardless of the prefix.
// ─────────────────────────────────────────────────────────────

function resolveDatabaseUrl(): string | null {
  const direct = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (direct) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(key)) return value;
  }
  return null;
}

const connectionString = resolveDatabaseUrl();

if (!connectionString) {
  // Throw lazily — at request time — so static analysis tools that
  // import this module don't break on local builds without env.
  console.warn('[db] No *_DATABASE_URL found; queries will fail until Neon is connected.');
}

const sql = neon(connectionString ?? 'postgresql://placeholder');
export const db = drizzle(sql, { schema });
export { schema };
