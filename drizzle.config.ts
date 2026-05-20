import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// ─────────────────────────────────────────────────────────────
//  Drizzle Kit config.
//
//  Env file precedence: `.env.local` (Vercel-managed) wins over
//  `.env`. Locally bring it down with `vercel env pull .env.local`.
// ─────────────────────────────────────────────────────────────

loadEnv({ path: '.env.local' });
loadEnv();

/**
 * The Vercel Neon integration lets you set a custom prefix (e.g.
 * `promhubbd`), which renames `DATABASE_URL` → `promhubbd_DATABASE_URL`.
 * Rather than hard-coding the prefix in two places, we scan the env
 * for any variable that ends in `DATABASE_URL` or `POSTGRES_URL` and
 * take the first non-empty one.
 */
function resolveDatabaseUrl(): string {
  // Fast path: canonical, prefix-free names.
  const direct = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (direct) return direct;

  // Fallback: any *_DATABASE_URL or *_POSTGRES_URL (custom Vercel prefix).
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(key)) return value;
  }
  return '';
}

export default defineConfig({
  schema: './api/_lib/schema.ts',
  out: './api/_lib/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
  verbose: true,
  strict: true,
});
