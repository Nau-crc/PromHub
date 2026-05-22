// /api/health — diagnostic endpoint. Open in a browser to verify
// the function infra runs AND that the relevant env vars are
// present, without touching Blob or Postgres.
//
// Zero imports beyond types — same logic as /api/v1/ping but at
// a separate path so we can hit it without going through the v1
// router.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Id');

  // Scan for any DATABASE_URL-shaped variable (covers Vercel's
  // custom-prefix Neon integrations like `promhubbd_DATABASE_URL`).
  const dbVarPresent = Object.entries(process.env).some(
    ([key, value]) => !!value && /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(key),
  );

  res.status(200).json({
    ok: true,
    runtime: process.version,
    region: process.env.VERCEL_REGION ?? null,
    deployId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    env: {
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
      DATABASE_URL: dbVarPresent,
    },
    timestamp: new Date().toISOString(),
  });
}
