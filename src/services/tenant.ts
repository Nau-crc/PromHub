import { storage } from './storage';
import { safeUuid } from '@/core/utils/format';

// ─────────────────────────────────────────────────────────────
//  Device-scoped tenant identity.
//
//  Until real auth ships, every install gets a UUID that travels
//  with each API call as `X-Tenant-Id`. The backend creates a
//  matching `tenants` row on first contact. When auth lands,
//  the tenant is "claimed" by the user account.
//
//  We cache the value in module scope to avoid hitting Capacitor
//  Preferences on every request — the hot path needs to be fast.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'promhub.tenant.v1';
let cached: string | null = null;
let inflight: Promise<string> | null = null;

export async function getTenantId(): Promise<string> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const existing = await storage.get<string>(STORAGE_KEY);
    if (existing && typeof existing === 'string') {
      cached = existing;
      return existing;
    }
    const fresh = safeUuid();
    await storage.set(STORAGE_KEY, fresh);
    cached = fresh;
    return fresh;
  })();
  try { return await inflight; }
  finally { inflight = null; }
}

/** Reset the local tenant (testing/debug only — wipes server linkage). */
export async function resetTenantId(): Promise<void> {
  cached = null;
  await storage.remove(STORAGE_KEY);
}
