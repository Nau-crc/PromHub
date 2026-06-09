#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  Destructive helper: wipes ALL data from the Neon database so
//  you can re-test flows from a clean slate. Schema is preserved
//  — only the rows go away.
//
//  Safety rails:
//    1. Reads the DB URL the same way the migrator does (.env*
//       + any *_DATABASE_URL / *_POSTGRES_URL env var).
//    2. Prints the masked host you're about to wipe.
//    3. Refuses to run unless `RESET_CONFIRM=YES` is set.
//    4. Uses TRUNCATE … RESTART IDENTITY CASCADE — fast, atomic,
//       resets SERIAL sequences so the first new row gets id 1.
//
//  Usage:
//    RESET_CONFIRM=YES node scripts/reset-db.mjs
//  or via npm:
//    RESET_CONFIRM=YES npm run db:reset
//
//  If you also want pending migrations to re-run on the next
//  deploy (e.g. to test the migration pipeline itself), add:
//    RESET_MIGRATIONS=YES
//  This drops the `__schema_migrations` tracking table too.
// ─────────────────────────────────────────────────────────────

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

loadEnv({ path: resolve(repoRoot, '.env.local') });
loadEnv({ path: resolve(repoRoot, '.env') });

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  for (const [k, v] of Object.entries(process.env)) {
    if (v && /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k)) return v;
  }
  return null;
}

function maskUrl(url) {
  // Show host + db name, hide password and most of the user.
  try {
    const u = new URL(url);
    const user = u.username ? u.username.slice(0, 3) + '***' : '(no user)';
    return `${u.protocol}//${user}@${u.host}${u.pathname}`;
  } catch {
    return '(unparseable URL)';
  }
}

const dbUrl = resolveDatabaseUrl();
if (!dbUrl) {
  console.error('[reset] No DATABASE_URL found. Check .env.local or Vercel env.');
  process.exit(1);
}

console.log('[reset] Target DB:', maskUrl(dbUrl));

if (process.env.RESET_CONFIRM !== 'YES') {
  console.error('');
  console.error('[reset] Refusing to run without explicit confirmation.');
  console.error('[reset] Re-run with:  RESET_CONFIRM=YES node scripts/reset-db.mjs');
  console.error('');
  process.exit(1);
}

const sql = neon(dbUrl);

// Tables in dependency order (FKs cascade anyway with CASCADE but the
// explicit list makes the intent obvious and forces an error if a
// new table is added and we forget to wipe it here).
const TABLES = [
  'submissions',
  'guests',
  'reservations',
  'events',
  'venues',
  'tenants',
];

try {
  console.log('[reset] Truncating data tables…');
  // One statement, one round-trip, atomic. RESTART IDENTITY resets the
  // SERIAL sequences so the next insert lands at id=1.
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await sql(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  for (const t of TABLES) console.log(`[reset]   ✓ ${t}`);

  if (process.env.RESET_MIGRATIONS === 'YES') {
    console.log('[reset] Dropping __schema_migrations tracking table…');
    await sql(`DROP TABLE IF EXISTS __schema_migrations`);
    console.log('[reset]   ✓ migrations will re-run on next deploy');
  } else {
    console.log('[reset] (Leaving __schema_migrations intact — pass RESET_MIGRATIONS=YES to wipe it too.)');
  }

  console.log('[reset] Done. The schema is untouched; only the rows are gone.');
  process.exit(0);
} catch (err) {
  console.error('[reset] FAILED:', err);
  process.exit(1);
}
