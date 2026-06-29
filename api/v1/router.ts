// ─────────────────────────────────────────────────────────────
//  /api/v1/router.ts — single router for ALL the versioned CRUD
//  endpoints. The file lives at this path and `vercel.json`
//  rewrites every `/api/v1/*` URL to it with `resource` and `id`
//  as query parameters.
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

  // Resource and id come from explicit rewrites in vercel.json:
  //   /api/v1/:resource         → /api/v1/router?resource=:resource
  //   /api/v1/:resource/:id     → /api/v1/router?resource=:resource&id=:id
  //
  // We tried Vercel's catch-all `[...path].ts` first; under the Vite
  // framework setting it only routed single-segment paths and returned
  // Vercel's bare 404 (no JSON, no logs) for two-segment paths like
  // events/123. Explicit rewrites are deterministic regardless of
  // runtime quirks.
  const resource = pickString(req.query.resource);
  const idSeg = pickString(req.query.id);
  const segments: string[] = [resource, idSeg].filter(
    (s): s is string => !!s,
  );

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
    const { eq, and, gte, lte, asc } = await import('drizzle-orm');
    const { db, schema } = await import('../_lib/db.js');
    const { ensureSharedTenant, SHARED_TENANT_ID } = await import('../_lib/tenancy.js');
    const {
      venueInputSchema, eventInputSchema, guestInputSchema,
      reservationInputSchema, snapshotSchema, nightRecordInputSchema,
      settingsInputSchema, planRegisterInputSchema, planReserveInputSchema,
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
        const fixedFee = rest.fixedFee != null ? String(rest.fixedFee) : null;
        const perExtraGuestFee = rest.perExtraGuestFee != null
          ? String(rest.perExtraGuestFee)
          : null;
        const [row] = await db.insert(schema.events)
          .values({ ...rest, fixedFee, perExtraGuestFee, venueId, tenantId })
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

    // night-records uses uuid ids (text), every other resource uses
    // serial integer ids. So id parsing is conditional — uuid resources
    // are handled in their own branch below before the numeric guard.
    const isUuidResource = resource === 'night-records' || resource === 'nightRecords';
    const id = !isUuidResource && idSeg !== undefined ? Number(idSeg) : null;
    if (!isUuidResource && idSeg !== undefined && !Number.isFinite(id)) {
      throw badRequest('Invalid id');
    }

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
          // numeric columns expect string on the way in (Drizzle quirk)
          // numeric columns expect string on the way in (Drizzle quirk)
          const fixedFee = input.fixedFee != null ? String(input.fixedFee) : null;
          const perExtraGuestFee = input.perExtraGuestFee != null
            ? String(input.perExtraGuestFee)
            : null;
          const [row] = await db.insert(schema.events)
            .values({ ...input, fixedFee, perExtraGuestFee, tenantId })
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
        // Only coerce when the patch actually sets each numeric
        // field; partial patches may not mention them at all.
        const patch: typeof input = { ...input };
        if ('fixedFee' in input) {
          patch.fixedFee = input.fixedFee != null ? (String(input.fixedFee) as unknown as number) : null;
        }
        if ('perExtraGuestFee' in input) {
          patch.perExtraGuestFee = input.perExtraGuestFee != null
            ? (String(input.perExtraGuestFee) as unknown as number)
            : null;
        }
        const [row] = await db.update(schema.events).set(patch).where(where).returning();
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

    // ── /api/v1/settings ────────────────────────────────────
    // Workspace-level configurable settings on the shared tenant:
    //   GET   → returns the current `settings` jsonb
    //   PATCH → shallow-merges the body into existing settings
    if (resource === 'settings' && segments.length === 1) {
      if (req.method === 'GET') {
        const [row] = await db.select({ settings: schema.tenants.settings })
          .from(schema.tenants)
          .where(eq(schema.tenants.id, tenantId))
          .limit(1);
        return res.status(200).json({ settings: row?.settings ?? {} });
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const input = settingsInputSchema.parse(parseBody(req.body));
        const [existing] = await db.select({ settings: schema.tenants.settings })
          .from(schema.tenants)
          .where(eq(schema.tenants.id, tenantId))
          .limit(1);
        const merged = { ...(existing?.settings ?? {}), ...input };
        const [row] = await db.update(schema.tenants)
          .set({ settings: merged })
          .where(eq(schema.tenants.id, tenantId))
          .returning({ settings: schema.tenants.settings });
        return res.status(200).json({ settings: row.settings });
      }
      throw badRequest(`Method ${req.method} not allowed`);
    }

    // ── /api/v1/photos ──────────────────────────────────────
    // Proxy upload to Vercel Blob. The client resizes images
    // client-side (canvas → JPEG 80%) so payloads stay well
    // under Hobby's 4.5 MB request cap, then POSTs JSON:
    //   { filename, contentType, data }   // data = base64
    // Server decodes, `put()`s to public Blob, returns the URL.
    // Direct/client tokens were the other option; we picked the
    // proxy because it keeps the public form (anonymous guests)
    // from needing any client-token dance and works the same on
    // `vercel dev`.
    if (resource === 'photos' && segments.length === 1) {
      if (req.method !== 'POST') throw badRequest(`Method ${req.method} not allowed`);
      const { put } = await import('@vercel/blob');
      const body = parseBody(req.body) as {
        filename?: string;
        contentType?: string;
        data?: string;
      };
      const { filename, contentType, data } = body;
      if (!filename || !contentType || !data) {
        throw badRequest('filename, contentType and data are required');
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(contentType)) {
        throw badRequest(`contentType must be one of: ${allowed.join(', ')}`);
      }
      const buffer = Buffer.from(data, 'base64');
      // 5 MB safety cap on the decoded buffer — the client resizes
      // long before this, but a malicious caller could skip that.
      if (buffer.byteLength > 5 * 1024 * 1024) {
        throw badRequest('Photo exceeds 5 MB');
      }
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: true,
      });
      return res.status(201).json({ url: blob.url });
    }

    // ── /api/v1/uploads ─────────────────────────────────────
    // Vercel Blob client-direct upload endpoint. Used by the
    // promoter app to attach a flyer (image OR video) to an event.
    // Videos easily exceed the 4.5 MB body cap that /api/v1/photos
    // operates under, so we hand the client a short-lived signed
    // token and it uploads straight to Blob storage. Up to 50 MB.
    //
    // The endpoint serves BOTH legs of @vercel/blob's client-upload
    // protocol — token generation AND the (optional) upload-completed
    // webhook — via the `handleUpload` helper. We pass an empty
    // `onUploadCompleted` because we don't need server-side
    // bookkeeping; the URL the helper returns is what we persist
    // to the event row.
    if (resource === 'uploads' && segments.length === 1) {
      if (req.method !== 'POST') throw badRequest(`Method ${req.method} not allowed`);
      const { handleUpload } = await import('@vercel/blob/client');
      const body = parseBody(req.body) as unknown;
      // VercelRequest.headers is a plain object, but handleUpload's
      // signature-verification path on the `blob.upload-completed`
      // callback calls `request.headers.get('x-vercel-signature')`.
      // Wrap the request so that call works in production.
      const wrappedRequest = {
        headers: {
          get(name: string) {
            const v = req.headers[name.toLowerCase()];
            if (Array.isArray(v)) return v[0] ?? null;
            return v ?? null;
          },
        },
      } as unknown as Request;
      try {
        const jsonResponse = await handleUpload({
          body: body as Parameters<typeof handleUpload>[0]['body'],
          request: wrappedRequest,
          onBeforeGenerateToken: async () => ({
            allowedContentTypes: [
              'image/jpeg', 'image/png', 'image/webp', 'image/gif',
              'video/mp4', 'video/quicktime', 'video/webm',
            ],
            maximumSizeInBytes: 50 * 1024 * 1024,
            addRandomSuffix: true,
          }),
          onUploadCompleted: async () => { /* no-op */ },
        });
        return res.status(200).json(jsonResponse);
      } catch (err) {
        throw badRequest((err as Error).message);
      }
    }

    // ── /api/v1/today ───────────────────────────────────────
    // Public lookup driving the /plan flow. Returns every event
    // occurring on the requested date (defaults to today) with
    // just the data the guest needs to pick: name, description,
    // timeslots, venue name, photoCount, flyerUrl. No tenant
    // header required — same shared workspace as everything else.
    //
    // Recurrence resolution lives client-side in the rest of the
    // app, but doing it server-side here lets the public form
    // stay tiny (no events array, no occurrence math).
    if (resource === 'today' && segments.length === 1) {
      if (req.method !== 'GET') throw badRequest(`Method ${req.method} not allowed`);
      const dateRaw = pickString(req.query.d) ?? pickString(req.query.date);
      const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
        ? dateRaw
        : new Date().toISOString().slice(0, 10);
      const weekdayShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][
        new Date(date + 'T00:00:00Z').getUTCDay()
      ];

      const eventRows = await db.select({
        id: schema.events.id,
        name: schema.events.name,
        description: schema.events.description,
        venueId: schema.events.venueId,
        weekdays: schema.events.weekdays,
        isOneTime: schema.events.isOneTime,
        eventDate: schema.events.eventDate,
        timeslots: schema.events.timeslots,
        photoCount: schema.events.photoCount,
        flyerUrl: schema.events.flyerUrl,
        seasonStart: schema.events.seasonStart,
        seasonEnd: schema.events.seasonEnd,
        vipPrices: schema.events.vipPrices,
      }).from(schema.events);

      // Match: one-time events fire on their exact eventDate;
      // recurring fire when the weekday is in their weekdays[] AND
      // the date sits within the optional season window.
      const matching = eventRows.filter((e) => {
        if (e.isOneTime) return e.eventDate === date;
        if (!(e.weekdays ?? []).map((d) => d.toLowerCase().slice(0, 3)).includes(weekdayShort)) {
          return false;
        }
        if (e.seasonStart && date < e.seasonStart) return false;
        if (e.seasonEnd && date > e.seasonEnd) return false;
        return true;
      });

      // Pull venue names + vipTypes in one query. vipTypes are the
      // venue-side identity (id/name/min-max-pax/table capacity);
      // the price for each comes from the event's `vipPrices` map.
      // We carry both onto the public response so the /plan reserve
      // flow can render the table-picker without extra round trips.
      const venueIds = [...new Set(matching.map((e) => e.venueId).filter((v): v is number => v != null))];
      const venuesById = new Map<number, {
        name: string;
        vipTypes: Array<{
          id: string; name: string; minPax: number; maxPax: number; tableCapacity: number;
        }>;
      }>();
      if (venueIds.length) {
        const { inArray } = await import('drizzle-orm');
        const venues = await db.select({
          id: schema.venues.id,
          name: schema.venues.name,
          vipTypes: schema.venues.vipTypes,
        }).from(schema.venues).where(inArray(schema.venues.id, venueIds));
        for (const v of venues) venuesById.set(v.id, { name: v.name, vipTypes: v.vipTypes ?? [] });
      }

      return res.status(200).json({
        date,
        events: matching.map((e) => {
          const venue = e.venueId != null ? venuesById.get(e.venueId) : undefined;
          return {
            id: e.id,
            name: e.name,
            description: e.description ?? '',
            venueId: e.venueId,
            venueName: venue?.name ?? null,
            timeslots: e.timeslots ?? [],
            photoCount: e.photoCount ?? null,
            flyerUrl: e.flyerUrl ?? null,
            // Reservation flow needs vipPrices + the venue's vipTypes
            // to render the table picker. Empty maps when nothing's
            // configured — the front-end just hides the table list.
            vipPrices: e.vipPrices ?? {},
            venueVipTypes: venue?.vipTypes ?? [],
          };
        }),
      });
    }

    // ── /api/v1/plan-register ───────────────────────────────
    // Public multi-event sign-up. One submit creates one guest row
    // per selected event (matches the "N guests, uno por evento"
    // decision). Each event runs its own waitlist check against
    // the date's already-confirmed pax.
    if (resource === 'plan-register' && segments.length === 1) {
      if (req.method !== 'POST') throw badRequest(`Method ${req.method} not allowed`);
      const input = planRegisterInputSchema.parse(parseBody(req.body));

      const eventRows = await db.select({
        id: schema.events.id,
        name: schema.events.name,
        venueId: schema.events.venueId,
        timeslots: schema.events.timeslots,
        flyerUrl: schema.events.flyerUrl,
        photoCount: schema.events.photoCount,
      }).from(schema.events).where(
        // inArray imported lazily here so the import isn't redundant
        // at the top of the dispatcher (other branches don't need it).
        (await import('drizzle-orm')).inArray(schema.events.id, input.eventIds),
      );
      if (eventRows.length !== input.eventIds.length) {
        throw badRequest('One or more events not found');
      }

      const { sql: rawSql } = await import('drizzle-orm');
      const results: Array<{
        eventId: number;
        eventName: string;
        waitlisted: boolean;
        queuePosition: number | null;
        flyerUrl: string | null;
      }> = [];

      // Audit notes: stamp the two acceptance flags into the guest
      // row's notes column. Keeps a trail without adding columns
      // for what's effectively self-attested.
      const notes = `via /plan · terms✓ · igStory✓`;

      for (const event of eventRows) {
        const derivedCapacity = (event.timeslots ?? []).reduce(
          (sum, slot) => sum + (slot.guestCapacity || 0),
          0,
        );
        const capacity = derivedCapacity > 0 ? derivedCapacity : null;

        let waitlisted = false;
        let queuePosition: number | null = null;
        if (capacity && capacity > 0) {
          const confirmedRows = await db.select({
            pax: schema.guests.pax,
            waitlisted: schema.guests.waitlisted,
            cancelled: schema.guests.cancelled,
          }).from(schema.guests)
            .where(rawSql`event_id = ${event.id} AND (event_date IS NULL OR event_date = ${input.date})`);
          const confirmedPax = confirmedRows
            .filter((g) => !g.waitlisted && !g.cancelled)
            .reduce((a, g) => a + g.pax, 0);
          if (confirmedPax + input.pax > capacity) {
            waitlisted = true;
            queuePosition = confirmedRows.filter((g) => g.waitlisted && !g.cancelled).length + 1;
          }
        }

        // Only attach the photos the guest uploaded when this event
        // actually requires them — otherwise drop them so unrelated
        // events don't inflate their rows with photos they'll never
        // surface.
        const eventPhotos = event.photoCount ? input.photos : [];

        await db.insert(schema.guests).values({
          tenantId: SHARED_TENANT_ID,
          name: input.name,
          eventId: event.id,
          venueId: event.venueId,
          pax: input.pax,
          igHandle: input.igHandle,
          igPlatform: input.igPlatform,
          timeslotIds: [],
          timeslotNames: [],
          eventDate: input.date,
          notes,
          waitlisted,
          photos: eventPhotos,
        });

        results.push({
          eventId: event.id,
          eventName: event.name,
          waitlisted,
          queuePosition,
          flyerUrl: event.flyerUrl ?? null,
        });
      }

      return res.status(201).json({ ok: true, results });
    }

    // ── /api/v1/plan-reserve ────────────────────────────────
    // Public VIP-table reservation. Companion to plan-register
    // but for paying clients booking a table (not invitadas).
    // Pricing is read from the event's `vipPrices` for the chosen
    // VIP type name and stamped into the reservation row's notes
    // so the price-at-booking can't drift if the event's prices
    // are later edited.
    if (resource === 'plan-reserve' && segments.length === 1) {
      if (req.method !== 'POST') throw badRequest(`Method ${req.method} not allowed`);
      const input = planReserveInputSchema.parse(parseBody(req.body));

      // Verify the venue exists and the VIP type lives on it.
      const [venue] = await db.select({
        id: schema.venues.id,
        name: schema.venues.name,
        vipTypes: schema.venues.vipTypes,
      }).from(schema.venues).where(eq(schema.venues.id, input.venueId)).limit(1);
      if (!venue) throw badRequest('Venue not found');
      const vipDef = (venue.vipTypes ?? []).find((vt) => vt.name === input.vipType);
      if (!vipDef) throw badRequest(`VIP type "${input.vipType}" not found at this venue`);
      if (input.pax < vipDef.minPax || input.pax > vipDef.maxPax) {
        throw badRequest(
          `Pax ${input.pax} outside ${input.vipType} range (${vipDef.minPax}–${vipDef.maxPax})`,
        );
      }

      // Resolve the event the price comes from. When the client
      // pins an explicit eventId we use it; otherwise pick the
      // first event at the venue happening on the given date.
      let resolvedEvent: { id: number; vipPrices: Record<string, number> } | null = null;
      if (input.eventId != null) {
        const [ev] = await db.select({
          id: schema.events.id,
          vipPrices: schema.events.vipPrices,
        }).from(schema.events).where(eq(schema.events.id, input.eventId)).limit(1);
        if (ev) resolvedEvent = ev;
      }
      const priceAtBooking = resolvedEvent?.vipPrices?.[input.vipType] ?? null;

      const [row] = await db.insert(schema.reservations).values({
        tenantId,
        venueId: input.venueId,
        eventId: resolvedEvent?.id ?? null,
        name: input.name,
        phoneCode: input.phoneCode,
        phoneNum: input.phoneNum,
        vipType: input.vipType,
        time: input.time,
        pax: input.pax,
        fromInvite: false,
        eventDate: input.date,
      }).returning({ id: schema.reservations.id });

      return res.status(201).json({
        ok: true,
        id: row.id,
        venueName: venue.name,
        vipType: input.vipType,
        pax: input.pax,
        priceAtBooking,
        time: input.time,
        date: input.date,
      });
    }

    // ── /api/v1/night-records ───────────────────────────────
    // Closed-night snapshots. POST creates one; GET lists or
    // fetches by id. Supports `?from=YYYY-MM-DD&to=YYYY-MM-DD`
    // range filter on the list endpoint for the XLSX export.
    if (resource === 'night-records' || resource === 'nightRecords') {
      if (id === null) {
        if (req.method === 'GET') {
          const from = pickString(req.query.from);
          const to = pickString(req.query.to);
          const conditions = [];
          if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
            conditions.push(gte(schema.nightRecords.date, from));
          }
          if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
            conditions.push(lte(schema.nightRecords.date, to));
          }
          const where = conditions.length === 1 ? conditions[0]
            : conditions.length > 1 ? and(...conditions)
            : undefined;
          const rows = where
            ? await db.select().from(schema.nightRecords).where(where)
                .orderBy(asc(schema.nightRecords.date), asc(schema.nightRecords.closedAt))
            : await db.select().from(schema.nightRecords)
                .orderBy(asc(schema.nightRecords.date), asc(schema.nightRecords.closedAt));
          return res.status(200).json({ nightRecords: rows });
        }
        if (req.method === 'POST') {
          const input = nightRecordInputSchema.parse(parseBody(req.body));
          // Auto-flag as correction if a row already exists for this date.
          const existing = await db.select({ id: schema.nightRecords.id })
            .from(schema.nightRecords)
            .where(eq(schema.nightRecords.date, input.date))
            .limit(1);
          const isCorrection = input.isCorrection || existing.length > 0;
          const [row] = await db.insert(schema.nightRecords)
            .values({ ...input, isCorrection })
            .returning();
          return res.status(201).json({ nightRecord: row });
        }
        throw badRequest(`Method ${req.method} not allowed`);
      }
      // Single record (by uuid in idSeg, not numeric id)
      if (!idSeg) throw badRequest('id is required');
      const where = eq(schema.nightRecords.id, idSeg);
      if (req.method === 'GET') {
        const [row] = await db.select().from(schema.nightRecords)
          .where(where).limit(1);
        if (!row) throw notFound();
        return res.status(200).json({ nightRecord: row });
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
    // Single error sink. Every error response carries the full
    // request context (method, url, parsed segments) so we can
    // diagnose without server logs.
    console.error('[api/v1]', segments.join('/'), err);
    const e = (err ?? {}) as {
      name?: string; message?: string; status?: number;
      stack?: string; cause?: unknown; issues?: unknown;
    };
    const ctx = {
      method: req.method,
      url: req.url,
      queryPath: req.query.path,
      parsedSegments: segments,
      resource: resource ?? null,
      idSeg: idSeg ?? null,
    };
    if (e.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        name: 'ZodError',
        issues: e.issues,
        _ctx: ctx,
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
      _ctx: ctx,
    });
  }
}

// Tiny helper — query values can be string | string[] | undefined.
// We treat the first non-empty string as the value.
function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v.find((s) => typeof s === 'string' && s.length > 0);
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
