// ─────────────────────────────────────────────────────────────
//  Typed HTTP errors. Throw from any service / endpoint; the
//  withErrorBoundary wrapper inspects `status` and returns the
//  right HTTP code + payload to the client. Avoids leaking
//  stack traces but keeps the message useful.
// ─────────────────────────────────────────────────────────────

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
