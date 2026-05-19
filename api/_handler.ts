import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─────────────────────────────────────────────────────────────
//  Tiny error-wrapping helper. Vercel surfaces uncaught throws as
//  `FUNCTION_INVOCATION_FAILED` with no body — useless for the
//  client. Wrapping the handler returns a 500 with the actual
//  error message so we can diagnose from the network panel.
//
//  We also log to stderr so the full stack lands in Vercel Logs.
// ─────────────────────────────────────────────────────────────

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

export function withErrorBoundary(handler: ApiHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (err) {
      const error = err as Error & { status?: number };
      // Surface the stack in Vercel Logs.
      console.error('[api] handler threw:', {
        path: req.url,
        method: req.method,
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      const status = error.status ?? 500;
      // Only send back name + message — never stack or env to the
      // client. This is enough for the app to render "something
      // failed: <reason>" while keeping internals private.
      res.status(status).json({
        error: error.message || 'Internal error',
        name: error.name,
      });
    }
  };
}

/** Best-effort body parsing — Vercel usually parses application/json
 *  automatically, but if it arrives as a string we recover. */
export function parseBody<T = Record<string, unknown>>(body: unknown): Partial<T> {
  if (!body) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Partial<T>; }
    catch { return {}; }
  }
  if (typeof body === 'object') return body as Partial<T>;
  return {};
}
