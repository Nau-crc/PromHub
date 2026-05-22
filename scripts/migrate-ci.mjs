#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  CI database sync.
//
//  Uses `drizzle-kit push` (NOT `migrate`) because at this stage
//  of the project we're still iterating on the schema and we want
//  the DB to follow `api/_lib/schema.ts` automatically. Trade-offs:
//
//    push     idempotent. Reconciles whatever state the DB is in
//             with the schema. No journal needed. Right for
//             prototyping; risky once we have production data
//             (drops cascade, no audit trail per PR).
//    migrate  applies committed SQL files in order, tracks them
//             in `__drizzle_migrations`. Right for prod, but
//             intolerant of state mismatches (e.g. tables exist
//             but the journal is empty → CREATE TABLE conflicts).
//
//  Switch to `migrate` once we have real users + reviewable
//  schema PRs; for now `push` keeps the deploy moving.
//
//  Rules (same as before):
//   - Vercel + DATABASE_URL → push, fail build if push fails
//   - Vercel without DATABASE_URL → exit 1 (build halts loudly)
//   - Local without DATABASE_URL → skip (frontend-only build)
// ─────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

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

if (!dbUrl) {
  if (isCi) {
    console.error('[db-sync] No DATABASE_URL found in env. ' +
      'Connect the Neon integration to this Vercel project.');
    process.exit(1);
  }
  console.log('[db-sync] No DATABASE_URL — skipping push (local build).');
  process.exit(0);
}

console.log('[db-sync] Reconciling schema with `drizzle-kit push`…');

// Push is non-interactive for non-destructive changes. For destructive
// changes it asks for confirmation; we pipe "y" to stdin so CI never
// hangs. The trade-off: any destructive change (rename, drop, type
// change) will be applied silently. With no real users yet this is the
// right default; we'll tighten before launch.
const child = spawn('npx', ['drizzle-kit', 'push'], {
  cwd: repoRoot,
  stdio: ['pipe', 'inherit', 'inherit'],
  env: process.env,
});

// Drizzle uses an interactive prompt library that reads stdin
// character-by-character. Feeding a stream of "y\n" answers every
// possible confirmation it might ask for during this push.
const autoConfirm = setInterval(() => {
  try { child.stdin.write('y\n'); } catch { /* stdin closed */ }
}, 250);

child.on('exit', (code) => {
  clearInterval(autoConfirm);
  process.exit(code ?? 0);
});
