// ─────────────────────────────────────────────────────────────
//  /api/v1/_ping — absolute-minimum diagnostic.
//
//  Zero imports beyond types. If THIS endpoint returns
//  FUNCTION_INVOCATION_FAILED, the problem isn't our code — the
//  Vercel build itself failed or the deploy is stale. Check the
//  Deployments tab in the Vercel dashboard.
//
//  Successful response confirms: routing works, runtime works,
//  Vercel is serving our latest deploy.
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Id');

  res.status(200).json({
    ok: true,
    when: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? null,
    deployId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    nodeVersion: process.version,
    method: req.method,
  });
}
