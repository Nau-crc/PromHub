import type { VercelRequest, VercelResponse } from '@vercel/node';
import { respondError } from './_lib/respond';

// ─────────────────────────────────────────────────────────────
//  `safe(loader)` builds an entry-point handler that
//   1. Sets CORS unconditionally
//   2. Lazily resolves the actual handler via DYNAMIC imports
//   3. Catches everything (import errors, runtime errors, Zod,
//      HttpError) and routes them through `respondError`
//
//  Why dynamic imports? Static imports at module top crash the
//  whole serverless function if a dep is missing, which manifests
//  as Vercel's `FUNCTION_INVOCATION_FAILED` HTML page (no JSON,
//  no logs in the client). Dynamic imports run AFTER our
//  try/catch is in place, so the failure becomes a normal
//  500 with a stack we can read from the network panel.
//
//  The loader's resolved handler is cached after the first
//  successful build so we only pay the import cost once per
//  cold start.
// ─────────────────────────────────────────────────────────────

export type AsyncHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export function safe(loader: () => Promise<AsyncHandler>) {
  let cached: AsyncHandler | null = null;
  return async function entryPoint(req: VercelRequest, res: VercelResponse) {
    // CORS — set before any try/catch so OPTIONS preflights are
    // always answered even when something else is broken.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Id');
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
      if (!cached) cached = await loader();
      await cached(req, res);
    } catch (err) {
      respondError(res, err, req.url);
    }
  };
}
