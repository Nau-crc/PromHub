#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  CI schema applier.
//
//  History: we tried `drizzle-kit migrate` (failed because the
//  DB had tables but no journal) and `drizzle-kit push` (hung in
//  CI because drizzle's prompt library wants a TTY). Both routes
//  through drizzle-kit's CLI proved brittle for Vercel builds.
//
//  This script bypasses drizzle-kit at runtime entirely. It:
//    1. Opens an HTTP connection to Neon
//    2. Ensures a `__schema_migrations` tracking table exists
//    3. For each .sql file under api/_lib/migrations/, checks if
//       it's been applied; if not, runs every statement, skipping
//       "object already exists" errors so re-runs are safe
//    4. Records the file as applied
//
//  Drizzle-kit is still used LOCALLY (`npm run db:generate`) to
//  emit the SQL diff when you change `schema.ts`. We just don't
//  let its CLI touch the production DB.
//
//  Rules:
//    - Vercel + DATABASE_URL → run, fail build on unhandled errors
//    - Vercel without DATABASE_URL → exit 1 (build halts loudly)
//    - Local without DATABASE_URL → skip (frontend-only build)
// ─────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
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

const isCi = !!(process.env.CI || process.env.VERCEL);
const dbUrl = resolveDatabaseUrl();
const migrationsDir = resolve(repoRoot, 'api/_lib/migrations');

if (!dbUrl) {
  if (isCi) {
    console.error('[db] No DATABASE_URL found. Connect Neon to this Vercel project.');
    process.exit(1);
  }
  console.log('[db] No DATABASE_URL — skipping (local build).');
  process.exit(0);
}

if (!existsSync(migrationsDir)) {
  console.log('[db] No migrations directory — skipping. Run `npm run db:generate` to create one.');
  process.exit(0);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // lexicographic = chronological (0000_, 0001_, …)

if (!files.length) {
  console.log('[db] No .sql files in migrations dir — nothing to apply.');
  process.exit(0);
}

const sql = neon(dbUrl);

// Postgres error codes we treat as "already exists, please continue"
// when applying a migration that was partially run before.
//   42P07: duplicate_table        (CREATE TABLE … already exists)
//   42P06: duplicate_schema       (CREATE SCHEMA … already exists)
//   42710: duplicate_object       (constraint/index name already exists)
//   42701: duplicate_column       (ALTER ADD COLUMN … already exists)
//   42P16: invalid_table_def(rare) some constraints
const IGNORABLE_CODES = new Set(['42P07', '42P06', '42710', '42701']);

try {
  // 1. Tracking table — our own, separate from drizzle's journal.
  await sql(`CREATE TABLE IF NOT EXISTS __schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz DEFAULT now()
  )`);

  // 2. Apply each file in order if not yet applied.
  for (const file of files) {
    const id = file;
    const seen = await sql(
      `SELECT 1 FROM __schema_migrations WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (seen.length) {
      console.log(`[db] ${id} — already applied, skipping`);
      continue;
    }

    console.log(`[db] applying ${id}…`);
    const raw = readFileSync(join(migrationsDir, file), 'utf8');

    // Drizzle separates statements with "--> statement-breakpoint"
    // comments. Split on that to get individual statements.
    const statements = raw
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter(Boolean);

    let ranCount = 0;
    let skippedCount = 0;
    for (const stmt of statements) {
      try {
        await sql(stmt);
        ranCount++;
      } catch (err) {
        const code = err?.code ?? err?.cause?.code;
        if (code && IGNORABLE_CODES.has(code)) {
          // The object already exists — fine on a re-run.
          const oneLine = String(err.message ?? err).split('\n')[0];
          console.log(`[db]   ↳ skipping (${code}): ${oneLine}`);
          skippedCount++;
          continue;
        }
        // Unexpected error → fail the build so we don't silently
        // ship a broken schema.
        console.error(`[db] FAILED on statement:\n${stmt}\n`);
        throw err;
      }
    }

    await sql(
      `INSERT INTO __schema_migrations (id) VALUES ($1)`,
      [id],
    );
    console.log(`[db] ${id} ✓  (${ranCount} run, ${skippedCount} pre-existing)`);
  }

  console.log('[db] all migrations up to date');
  process.exit(0);
} catch (err) {
  console.error('[db] migration failed:', err);
  process.exit(1);
}
