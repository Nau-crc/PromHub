#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  PromHub backend doctor.
//
//  Run with:   node scripts/doctor.mjs https://<your-app>.vercel.app
//  (Trailing slash optional.)
//
//  Prints a single report of what's deployed, what env vars Vercel
//  has injected, whether the migrations folder exists locally,
//  whether the latest local commit was pushed, and how each API
//  endpoint responds.
//
//  Safe to share the output — it ONLY reports BOOLEAN env presence,
//  never values. Connection strings, tokens, etc. never appear.
// ─────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const rawHost = process.argv[2];
if (!rawHost) {
  console.error('Usage: node scripts/doctor.mjs https://<your-app>.vercel.app');
  process.exit(1);
}
const host = rawHost.replace(/\/+$/, '');

const line = (s = '') => console.log(s);
const ok = (s) => console.log(`  ✓ ${s}`);
const warn = (s) => console.log(`  ⚠ ${s}`);
const fail = (s) => console.log(`  ✗ ${s}`);

function section(title) {
  console.log('');
  console.log(`── ${title} ──`);
}

function safeExec(cmd) {
  try { return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

// ── 1. Local git state ────────────────────────────────────
section('Local git state');
const branch = safeExec('git rev-parse --abbrev-ref HEAD');
const headSha = safeExec('git rev-parse --short HEAD');
const upstream = safeExec('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null');
const ahead = safeExec('git rev-list --count @{u}..HEAD 2>/dev/null');
const dirty = safeExec('git status --porcelain');
ok(`branch: ${branch ?? 'unknown'}`);
ok(`head:   ${headSha ?? 'unknown'}`);
if (upstream) ok(`upstream: ${upstream}`);
if (ahead && ahead !== '0') {
  fail(`${ahead} unpushed commit(s) — Vercel can't deploy them. Run \`git push\`.`);
}
if (dirty) {
  warn(`Uncommitted changes (${dirty.split('\n').length} files). These won't deploy until committed + pushed.`);
}

// ── 2. Local files Vercel needs ───────────────────────────
section('Local repo health');
const checks = [
  { path: 'package.json', why: 'project manifest' },
  { path: 'vercel.json', why: 'Vercel config' },
  { path: 'drizzle.config.ts', why: 'migration config' },
  { path: 'api/_lib/schema.ts', why: 'DB schema' },
  // The whole versioned API now lives in a single catch-all router
  // to stay under Vercel Hobby's 12-function limit.
  { path: 'api/v1/[...path].ts', why: 'v1 router (catch-all)' },
  { path: 'scripts/migrate-ci.mjs', why: 'CI migration runner' },
];
for (const c of checks) {
  if (existsSync(resolve(repoRoot, c.path))) ok(`${c.path} (${c.why})`);
  else fail(`MISSING ${c.path} (${c.why})`);
}

const migrationsDir = resolve(repoRoot, 'api/_lib/migrations');
if (existsSync(migrationsDir)) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  if (files.length) ok(`Migrations: ${files.length} SQL file(s) → ${files.join(', ')}`);
  else fail('Migrations folder exists but no .sql files. Run `npm run db:generate`.');
} else {
  fail('No api/_lib/migrations/ folder. Run `npm run db:generate` and commit the output.');
}

// ── 3. Deployed endpoints ─────────────────────────────────
section(`Deployed at ${host}`);

async function probe(label, path, init = {}) {
  const url = `${host}${path}`;
  const method = init.method ?? 'GET';
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    const status = `${res.status} ${res.statusText}`;
    const tag = res.ok ? ok : fail;
    tag(`${label} → ${method} ${path} :: ${status}`);

    // Print key response headers so we can see if Vercel intercepted
    // before reaching our handler.
    const showHeaders = ['x-vercel-id', 'x-vercel-cache', 'server', 'content-type', 'x-matched-path'];
    for (const h of showHeaders) {
      const v = res.headers.get(h);
      if (v) console.log(`        ${h}: ${v}`);
    }

    // Print the body. If JSON, pretty-print full. If string, strip HTML.
    if (body && typeof body === 'object') {
      console.log('        body:', JSON.stringify(body, null, 2).split('\n').map((s, i) => i === 0 ? s : '              ' + s).join('\n'));
    } else if (typeof body === 'string') {
      const stripped = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('        body (plain):', stripped.slice(0, 400) || '(empty)');
    } else {
      console.log('        body: (empty)');
    }
    return { res, body };
  } catch (err) {
    fail(`${label}: network error — ${err.message}`);
    return null;
  }
}

// /api/v1/ping is handled by the unified router and uses zero DB.
// If THIS responds with 200, Vercel is serving the new code and
// the router itself works. If it 404s, the router file isn't
// deployed; if it 500s with JSON, we have a real bug to debug.
const pingResult = await probe('GET /api/v1/ping (router + zero-deps)', '/api/v1/ping');
const healthResult = await probe('GET /api/health  (env presence)', '/api/health');

// DB read via router — no tenant header needed any more (shared workspace).
await probe('list venues', '/api/v1/venues');

// Method tests: the v1 router must accept PATCH and DELETE on item paths.
// We pick id=999999 (almost certainly nonexistent) so we never mutate
// real data — the expected response is a 404 from our router with a
// JSON body explaining 'not found', NOT a bare Vercel 404 with empty body.
section('Method routing (events/999999 — should NOT exist; we want JSON 404 or 200)');
await probe('GET item',    '/api/v1/events/999999');
await probe('PATCH item',  '/api/v1/events/999999', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'doctor-probe' }),
});
await probe('DELETE item', '/api/v1/events/999999', { method: 'DELETE' });

// Deploy-freshness check: compare local HEAD with what's deployed
const deployedSha = healthResult?.body?.commitSha
  ?? pingResult?.body?.commitSha
  ?? null;
if (deployedSha && headSha && !deployedSha.startsWith(headSha)) {
  section('Deploy freshness');
  warn(`Local HEAD is ${headSha} but Vercel is serving ${deployedSha.slice(0, 7)}.`);
  warn('Push your local commits (or wait for the in-flight build) so the fix actually goes live.');
}

line('');
line('── Done ──');
line('Paste the full output above (it contains no secrets) and we\'ll diagnose.');
