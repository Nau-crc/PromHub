#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  CI-friendly wrapper around `drizzle-kit migrate`.
//
//  Rules:
//   - On Vercel (CI=1 / VERCEL=1), DATABASE_URL must be present
//     or we exit with code 1 so the build halts loudly.
//   - Locally, if no DATABASE_URL is set, we SKIP migrations
//     so developers can run `npm run build` to compile the
//     frontend without needing a DB connection.
//   - In all cases, if migrations exist, we apply them.
// ─────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Load env the same way drizzle.config.ts does (Vercel injects at
// build time; locally we use .env.local).
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
const hasMigrations = existsSync(migrationsDir);

if (!dbUrl) {
  if (isCi) {
    console.error('[migrate-ci] No DATABASE_URL found in env. ' +
      'Connect the Neon integration to this Vercel project.');
    process.exit(1);
  }
  console.log('[migrate-ci] No DATABASE_URL — skipping migrations (local build).');
  process.exit(0);
}

if (!hasMigrations) {
  console.log('[migrate-ci] No migrations directory yet. ' +
    'Run `npm run db:generate` locally and commit the SQL files.');
  // Don't fail — first deploy might happen before migrations exist.
  process.exit(0);
}

console.log('[migrate-ci] Applying migrations…');
const child = spawn('npx', ['drizzle-kit', 'migrate'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
