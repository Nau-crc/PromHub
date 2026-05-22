import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { HttpError } from './_lib/errors.js';

// ─────────────────────────────────────────────────────────────
//  Common HTTP wrapper for every /api endpoint.
//
//   - Translates thrown exceptions into JSON errors with the
//     correct status code (HttpError.status; ZodError → 400 with
//     the issue list; unknown → 500).
//   - Logs the full stack to stderr → Vercel Logs.
//   - Sets permissive CORS headers (the public form is at the
//     same origin in prod, but the /register page may run on
//     other domains in the future).
//   - Handles preflight OPTIONS.
//   - Provides `parseBody` for runtimes where Vercel passes the
//     body as a raw string.
// ─────────────────────────────────────────────────────────────

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export function withErrorBoundary(handler: ApiHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS (permissive — fine for read APIs; lock down per-route
    // when we ship anything sensitive like auth).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Id');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    try {
      await handler(req, res);
    } catch (err) {
      // Zod validation: client error with a list of issues
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          name: 'ZodError',
          issues: err.issues.map((i) => ({
            path: i.path.join('.'),
            code: i.code,
            message: i.message,
          })),
        });
      }
      // Anything that declares its own HTTP status
      if (err instanceof HttpError) {
        return res.status(err.status).json({
          error: err.message,
          name: err.name,
          details: err.details,
        });
      }
      // Anything else → 500 with a sanitized message
      const error = err as Error & { status?: number };
      console.error('[api] handler threw:', {
        path: req.url, method: req.method,
        name: error.name, message: error.message, stack: error.stack,
      });
      res.status(error.status ?? 500).json({
        error: error.message || 'Internal error',
        name: error.name,
      });
    }
  };
}

export function parseBody<T = Record<string, unknown>>(body: unknown): Partial<T> {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Partial<T>; } catch { return {}; }
  }
  if (typeof body === 'object') return body as Partial<T>;
  return {};
}
