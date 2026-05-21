import type { VercelResponse } from '@vercel/node';

// ─────────────────────────────────────────────────────────────
//  Single source of truth for error responses. Every endpoint
//  funnels exceptions through this so the client always sees a
//  predictable JSON shape, with enough detail to debug — even
//  when the failure was at module-import time.
//
//  Returned shape:
//    {
//      error:  string,              // human-readable message
//      name:   string,              // 'Error' | 'ZodError' | 'HttpError' | ...
//      status: number,              // mirrors the HTTP status
//      stack?: string[],            // top 15 stack frames
//      cause?: string,              // err.cause stringified
//      issues?: ZodIssue[],         // present on Zod validation failures
//    }
//
//  No risky imports at module top (only a type import) — so this
//  file is safe to static-import from any entry point.
// ─────────────────────────────────────────────────────────────

export function respondError(res: VercelResponse, err: unknown, scope?: string) {
  // Always surface to the Vercel function logs as well
  console.error('[api]', scope ?? '', err);

  const e = (err ?? {}) as {
    name?: string;
    message?: string;
    status?: number;
    stack?: string;
    cause?: unknown;
    issues?: unknown;
  };

  // Zod gets a richer body so the client can render per-field errors
  if (e.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      name: 'ZodError',
      status: 400,
      issues: e.issues,
      stack: splitStack(e.stack),
    });
  }

  const status = typeof e.status === 'number' ? e.status : 500;
  return res.status(status).json({
    error: e.message || (typeof err === 'string' ? err : 'Internal error'),
    name: e.name || 'Error',
    status,
    stack: splitStack(e.stack),
    cause: e.cause != null ? String(e.cause) : undefined,
  });
}

function splitStack(stack: string | undefined): string[] | undefined {
  if (typeof stack !== 'string') return undefined;
  return stack.split('\n').map((s) => s.trim()).slice(0, 15);
}
