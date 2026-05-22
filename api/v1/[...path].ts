// ─────────────────────────────────────────────────────────────
//  /api/v1/[...path].ts — single catch-all router for ALL the
//  versioned CRUD endpoints.
//
//  Why one file instead of one-per-resource:
//    Vercel Hobby caps deployments at 12 Serverless Functions.
//    Each file under /api/ counts as one. Splitting venues/
//    events/guests/reservations × {index, [id]} was 8 functions
//    on its own — we'd outgrow the cap before adding anything
//    interesting. Folding them into one router brings the whole
//    versioned API down to a single function.
//
//  Routes handled here:
//
//    GET    /api/v1/ping
//    POST   /api/v1/sync
//
//    GET    /api/v1/venues            POST   /api/v1/venues
//    GET    /api/v1/venues/:id        PATCH  /api/v1/venues/:id
//    DELETE /api/v1/venues/:id
//
//    GET    /api/v1/events            POST   /api/v1/events
//    GET    /api/v1/events/:id        PATCH  /api/v1/events/:id
//    DELETE /api/v1/events/:id
//
//    GET    /api/v1/guests            POST   /api/v1/guests
//    GET    /api/v1/guests/:id        PATCH  /api/v1/guests/:id
//    DELETE /api/v1/guests/:id
//
//    GET    /api/v1/reservations      POST   /api/v1/reservations
//    GET    /api/v1/reservations/:id  PATCH  /api/v1/reservations/:id
//    DELETE /api/v1/reservations/:id
//
//  Everything heavy (Drizzle, Neon, Zod) is dynamically imported
//  inside the request so any module-init failure surfaces as JSON
//  instead of FUNCTION_INVOCATION_FAILED.
// ─────────────────────────────────────────────────────────────

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — first, unconditional, never inside the try/catch so
  // OPTIONS preflights always succeed.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Id');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Path segments. In theory Vercel's catch-all `[...path].ts` should
  // populate `req.query.path = ['venues', '123']` for `/api/v1/venues/123`.
  // In practice we've observed it being empty under Vercel's Node 24
  // runtime — so we parse `req.url` ourselves as a robust fallback.
  // This makes the router work regardless of how Vercel's routing
  // layer chooses to forward the path on a given runtime version.
  const segments = extractSegments(req);
  const [resource, idSeg] = segments;

  try {
    // ── /api/v1/ping (no DB, no auth — for diagnostics) ─────
    if (resource === 'ping' && segments.length === 1) {
      return res.status(200).json({
        ok: true,
        when: new Date().toISOString(),
        region: process.env.VERCEL_REGION ?? null,
        deployId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        nodeVersion: process.version,
        method: req.method,
      });
    }

    // ── Lazy-load everything heavy ──────────────────────────
    // Any failure here lands in the catch below and gets sent
    // back as a JSON 500 instead of Vercel's generic HTML page.
    //
    // The `.js` extension on local imports is REQUIRED — Vercel's
    // Node ESM resolver doesn't auto-append it for dynamic imports,
    // and TypeScript's compiler emits the path verbatim. Without it
    // you get ERR_MODULE_NOT_FOUND at runtime. The .js refers to
    // the compiled file even though the source is .ts.
    const { eq } = await import('drizzle-orm');
    const { db, schema } = await import('../_lib/db.js');
    const { ensureSharedTenant, SHARED_TENANT_ID } = await import('../_lib/tenancy.js');
    const {
      venueInputSchema, eventInputSchema, guestInputSchema,
      reservationInputSchema, snapshotSchema,
    } = await import('../_lib/validators.js');
    const { parseBody } = await import('../_handler.js');
    const { badRequest, notFound } = await import('../_lib/errors.js');

    // Shared workspace — no per-device scoping any more. Reads
    // return everything in each table; writes carry the shared
    // tenant_id so the FK constraint is satisfied.
    await ensureSharedTenant();
    const tenantId = SHARED_TENANT_ID;

    // ── /api/v1/sync ────────────────────────────────────────
    if (resource === 'sync' && segments.length === 1) {
      if (req.method !== 'POST') throw badRequest('Method not allowed');

      const snap = snapshotSchema.parse(parseBody(req.body));
      const venueMap = new Map<number, number>();
      const eventMap = new Map<number, number>();
      const guestMap = new Map<number, number>();
      const reservationMap = new Map<number, number>();

      for (const v of snap.venues) {
        const { clientId, ...rest } = v;
        const [row] = await db.insert(schema.venues)
          .values({ ...rest, tenantId })
          .returning({ id: schema.venues.id });
        venueMap.set(clientId, row.id);
      }
      for (const e of snap.events) {
        const { clientId, venueClientId, ...rest } = e;
        const venueId = venueClientId != null ? (venueMap.get(venueClientId) ?? null) : null;
        const [row] = await db.insert(schema.events)
          .values({ ...rest, venueId, tenantId })
          .returning({ id: schema.events.id });
        eventMap.set(clientId, row.id);
      }
      for (const g of snap.guests) {
        const { clientId, eventClientId, venueClientId, clubEventClientId, ...rest } = g;
        const eventId = eventMap.get(eventClientId);
        if (!eventId) throw badRequest(`Guest references unknown event ${eventClientId}`);
        const venueId = venueClientId != null ? (venueMap.get(venueClientId) ?? null) : null;
        const clubEventId = clubEventClientId != null ? (eventMap.get(clubEventClientId) ?? null) : null;
        const [row] = await db.insert(schema.guests)
          .values({ ...rest, eventId, venueId, clubEventId, tenantId })
          .returning({ id: schema.guests.id });
        guestMap.set(clientId, row.id);
      }
      for (const r of snap.reservations) {
        const { clientId, venueClientId, eventClientId, ...rest } = r;
        const venueId = venueMap.get(venueClientId);
        if (!venueId) throw badRequest(`Reservation references unknown venue ${venueClientId}`);
        const eventId = eventClientId != null ? (eventMap.get(eventClientId) ?? null) : null;
        const [row] = await db.insert(schema.reservations)
          .values({
            ...rest, venueId, eventId, tenantId,
            commissionPct: String(rest.commissionPct),
            womanPct: String(rest.womanPct),
          })
          .returning({ id: schema.reservations.id });
        reservationMap.set(clientId, row.id);
      }

      return res.status(200).json({
        ok: true,
        counts: {
          venues: venueMap.size, events: eventMap.size,
          guests: guestMap.size, reservations: reservationMap.size,
        },
        mapping: {
          venues: Object.fromEntries(venueMap),
          events: Object.fromEntries(eventMap),
          guests: Object.fromEntries(guestMap),
          reservations: Object.fromEntries(reservationMap),
        },
      });
    }

    const id = idSeg !== undefined ? Number(idSeg) : null;
    if (idSeg !== undefined && !Number.isFinite(id)) throw badRequest('Invalid id');

    // ── /api/v1/venues ──────────────────────────────────────
    if (resource === 'venues') {
      if (id === null) {
        if (req.method === 'GET') {
          const rows = await db.select().from(schema.venues)
            .orderBy(schema.venues.id);
          return res.status(200).json({ venues: rows });
        }
        if (req.method === 'POST') {
          const input = venueInputSchema.parse(parseBody(req.body));
          const [row] = await db.insert(schema.venues)
            .values({ ...input, tenantId })
            .returning();
          return res.status(201).json({ venue: row });
        }
        throw badRequest(`Method ${req.method} not allowed`);
      }

      const where = eq(schema.venues.id, id!);
      if (req.method === 'GET') {
        const [row] = await db.select().from(schema.venues).where(where).limit(1);
        if (!row) throw notFound();
        return res.status(200).json({ venue: row });
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const input = venueInputSchema.partial().parse(parseBody(req.body));
        const [row] = await db.update(schema.venues).set(input).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ venue: row });
      }
      if (req.method === 'DELETE') {
        // Date-aware cascade: drop only future events at this venue,
        // keep past ones for reporting. Guest rows cascade via FK.
        const isoDay = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const todayIso = isoDay(new Date());

        const evs = await db.select({
          id: schema.events.id,
          isOneTime: schema.events.isOneTime,
          eventDate: schema.events.eventDate,
          seasonEnd: schema.events.seasonEnd,
        })
          .from(schema.events)
          .where(eq(schema.events.venueId, id!));
        const futureIds = evs.filter((e) => e.isOneTime
          ? !!e.eventDate && e.eventDate >= todayIso
          : !e.seasonEnd || e.seasonEnd >= todayIso
        ).map((e) => e.id);

        if (futureIds.length) {
          await db.delete(schema.events)
            .where(eq(schema.events.venueId, id!));
        }
        const [row] = await db.delete(schema.venues).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ ok: true });
      }
      throw badRequest(`Method ${req.method} not allowed`);
    }

    // ── /api/v1/events ──────────────────────────────────────
    if (resource === 'events') {
      if (id === null) {
        if (req.method === 'GET') {
          const rows = await db.select().from(schema.events)
            .orderBy(schema.events.id);
          return res.status(200).json({ events: rows });
        }
        if (req.method === 'POST') {
          const input = eventInputSchema.parse(parseBody(req.body));
          const [row] = await db.insert(schema.events)
            .values({ ...input, tenantId })
            .returning();
          return res.status(201).json({ event: row });
        }
        throw badRequest(`Method ${req.method} not allowed`);
      }

      const where = eq(schema.events.id, id!);
      if (req.method === 'GET') {
        const [row] = await db.select().from(schema.events).where(where).limit(1);
        if (!row) throw notFound();
        return res.status(200).json({ event: row });
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const input = eventInputSchema.partial().parse(parseBody(req.body));
        const [row] = await db.update(schema.events).set(input).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ event: row });
      }
      if (req.method === 'DELETE') {
        const [row] = await db.delete(schema.events).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ ok: true });
      }
      throw badRequest(`Method ${req.method} not allowed`);
    }

    // ── /api/v1/guests ──────────────────────────────────────
    if (resource === 'guests') {
      if (id === null) {
        if (req.method === 'GET') {
          const rows = await db.select().from(schema.guests)
            .orderBy(schema.guests.id);
          return res.status(200).json({ guests: rows });
        }
        if (req.method === 'POST') {
          const input = guestInputSchema.parse(parseBody(req.body));
          // Sanity check: linked event must exist (FK would enforce
          // this anyway, but a friendlier error is nicer).
          const [evt] = await db.select({ id: schema.events.id })
            .from(schema.events)
            .where(eq(schema.events.id, input.eventId))
            .limit(1);
          if (!evt) throw badRequest('Event not found');

          const [row] = await db.insert(schema.guests)
            .values({ ...input, tenantId })
            .returning();
          return res.status(201).json({ guest: row });
        }
        throw badRequest(`Method ${req.method} not allowed`);
      }

      const where = eq(schema.guests.id, id!);
      if (req.method === 'GET') {
        const [row] = await db.select().from(schema.guests).where(where).limit(1);
        if (!row) throw notFound();
        return res.status(200).json({ guest: row });
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const input = guestInputSchema.partial().parse(parseBody(req.body));
        const [row] = await db.update(schema.guests).set(input).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ guest: row });
      }
      if (req.method === 'DELETE') {
        const [row] = await db.delete(schema.guests).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ ok: true });
      }
      throw badRequest(`Method ${req.method} not allowed`);
    }

    // ── /api/v1/reservations ────────────────────────────────
    if (resource === 'reservations') {
      if (id === null) {
        if (req.method === 'GET') {
          const rows = await db.select().from(schema.reservations)
            .orderBy(schema.reservations.id);
          return res.status(200).json({ reservations: rows });
        }
        if (req.method === 'POST') {
          const input = reservationInputSchema.parse(parseBody(req.body));
          const [venue] = await db.select({ id: schema.venues.id })
            .from(schema.venues)
            .where(eq(schema.venues.id, input.venueId))
            .limit(1);
          if (!venue) throw badRequest('Venue not found');

          const [row] = await db.insert(schema.reservations)
            .values({
              ...input, tenantId,
              commissionPct: String(input.commissionPct),
              womanPct: String(input.womanPct),
            })
            .returning();
          return res.status(201).json({ reservation: row });
        }
        throw badRequest(`Method ${req.method} not allowed`);
      }

      const where = eq(schema.reservations.id, id!);
      if (req.method === 'GET') {
        const [row] = await db.select().from(schema.reservations).where(where).limit(1);
        if (!row) throw notFound();
        return res.status(200).json({ reservation: row });
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const input = reservationInputSchema.partial().parse(parseBody(req.body));
        const patch: Record<string, unknown> = { ...input };
        if (input.commissionPct !== undefined) patch.commissionPct = String(input.commissionPct);
        if (input.womanPct !== undefined) patch.womanPct = String(input.womanPct);
        const [row] = await db.update(schema.reservations).set(patch).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ reservation: row });
      }
      if (req.method === 'DELETE') {
        const [row] = await db.delete(schema.reservations).where(where).returning();
        if (!row) throw notFound();
        return res.status(200).json({ ok: true });
      }
      throw badRequest(`Method ${req.method} not allowed`);
    }

    // No match. Include diagnostic info so when this fires we can
    // tell whether path extraction worked or Vercel routed us a
    // shape we don't understand.
    return res.status(404).json({
      error: `Unknown route: /api/v1/${segments.join('/')}`,
      _debug: {
        method: req.method,
        url: req.url,
        queryPath: req.query.path,
        parsedSegments: segments,
      },
    });

  } catch (err) {
    // Single error sink for everything thrown inside the try.
    console.error('[api/v1]', segments.join('/'), err);
    const e = (err ?? {}) as {
      name?: string; message?: string; status?: number;
      stack?: string; cause?: unknown; issues?: unknown;
    };
    if (e.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        name: 'ZodError',
        issues: e.issues,
      });
    }
    const status = typeof e.status === 'number' ? e.status : 500;
    return res.status(status).json({
      error: e.message || 'Internal error',
      name: e.name || 'Error',
      status,
      stack: typeof e.stack === 'string'
        ? e.stack.split('\n').map((s) => s.trim()).slice(0, 15)
        : undefined,
      cause: e.cause != null ? String(e.cause) : undefined,
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  Robust path-segment extraction.
//
//  Vercel's behaviour for catch-all params (`[...path].ts`) has
//  shifted across runtime versions and isn't 100% consistent. We
//  observed all three of these in production:
//    A) req.query.path === ['venues', '123']     (proper array)
//    B) req.query.path === 'venues/123'          (single string with slashes)
//    C) req.query.path === undefined             (URL has to be parsed)
//
//  We support all three by:
//    1. Reading every candidate query key (`path`, `slug`)
//    2. Flattening arrays AND splitting any value on '/'
//    3. Falling back to parsing `req.url` itself
// ─────────────────────────────────────────────────────────────
function extractSegments(req: VercelRequest): string[] {
  for (const key of ['path', 'slug']) {
    const v = req.query[key];
    if (v == null) continue;
    const arr = Array.isArray(v) ? v : [v];
    const flat = arr.flatMap((s) =>
      typeof s === 'string' ? s.split('/').filter(Boolean) : [],
    );
    if (flat.length) return flat;
  }
  if (req.url) {
    const pathOnly = req.url.split('?')[0];
    // Strip the `/api/v1/` prefix and split the remainder.
    // If Vercel rewrote `req.url` to the literal bracket form
    // (`/api/v1/[...path]`), this regex won't capture anything
    // useful, and we'll fall through to the empty segments path —
    // that's still safer than a hang.
    const match = pathOnly.match(/^\/api\/v1\/([^[].*)?$/);
    if (match && match[1]) return match[1].split('/').filter(Boolean);
  }
  return [];
}
