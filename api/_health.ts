import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withErrorBoundary } from './_handler';

// ─────────────────────────────────────────────────────────────
//  /api/_health
//
//  Lightweight diagnostic: confirms the function infrastructure
//  runs and reports whether the env vars our other endpoints need
//  are present. Does NOT touch the Blob store, so we can use it
//  to disambiguate "function broken" vs "Blob token missing".
//
//  Usage: open https://<your-app>.vercel.app/api/_health in a browser.
// ─────────────────────────────────────────────────────────────

export default withErrorBoundary(async (_req: VercelRequest, res: VercelResponse) => {
  res.status(200).json({
    ok: true,
    runtime: process.version,
    region: process.env.VERCEL_REGION ?? null,
    env: {
      // Only return whether each is set, never the value.
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
    timestamp: new Date().toISOString(),
  });
});
