# PromHub Mobile

Aplicación móvil de PromHub (gestión de noches y promotores en Barcelona) construida con
**Ionic React + Capacitor**, lista para compilarse como **APK** (Android) e **IPA** (iOS).

> Es el port del MVP `promhub_v4.html` (vanilla JS) a una arquitectura escalable
> feature-based, manteniendo **al pie de la letra** las fórmulas de cálculo del
> original (`src/features/summary/calculations.ts`).

---

## ¿Por qué Ionic + Capacitor (y no React Native)?

React Native e Ionic son **mutuamente excluyentes** dentro de una misma vista:
- **React Native** renderiza con vistas nativas (`View`, `Text`, …) vía Metro/JSI.
- **Ionic React** renderiza con HTML/CSS dentro de un WebView empaquetado nativamente vía Capacitor.

Para este proyecto, Ionic + Capacitor es la mejor decisión porque:
1. El MVP original es 100% HTML/CSS/JS — el port es directo, sin reescribir UX.
2. Capacitor permite generar **APK** e **IPA** desde el mismo código fuente.
3. `IonModal`, `IonMenu`, `IonTabs` cubren todos los modales/drawer/tabs sin reinventar.
4. La curva es mucho menor para un equipo con experiencia web.

Si en el futuro se requieren componentes nativos puros (cámara, sensores), Capacitor
expone APIs nativas a través de plugins sin abandonar la base actual.

---

## Estructura

```
promhub-mobile/
├── android/                   # generado por Capacitor (no committed)
├── ios/                       # generado por Capacitor (no committed)
├── public/
├── src/
│   ├── main.tsx               # bootstrap React + Ionic CSS
│   ├── App.tsx                # IonReactRouter + IonTabs + IonMenu + ModalsHost + Onboarding
│   ├── theme/
│   │   └── variables.css      # design tokens del MVP + overrides Ionic
│   ├── core/                  # capa pura (sin dependencias UI)
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── utils/
│   ├── store/                 # estado global (Zustand)
│   │   ├── useAppStore.ts     # datos persistentes (venues, events, guests, reservations)
│   │   └── useUIStore.ts      # orquestación de modales (sustituye openSheet del MVP)
│   ├── services/
│   │   └── storage.ts         # wrapper Capacitor Preferences
│   ├── components/            # UI compartida (Pill, DayChips, SlotChips, EventCard, ...)
│   └── features/              # feature-based modules
│       ├── ModalsHost.tsx     # mount-point único para todos los modales
│       ├── onboarding/
│       ├── home/
│       ├── events/            # EventsPage + EventFormModal + EventDetailModal
│       ├── guests/
│       ├── reservations/
│       ├── venues/            # VenuesPage + VenueFormModal + VenueEditor (rows reutilizables)
│       └── summary/
│           ├── calculations.ts  # ← TODAS las fórmulas (port byte-a-byte del MVP)
│           └── SummaryPage.tsx  # 4 paneles (Today / Monthly / Yearly / Influencers)
├── capacitor.config.ts
├── ionic.config.json
├── vite.config.ts
└── package.json
```

### Capas

- **`core/`** → tipos y utilidades puras, **sin** dependencias de React ni Ionic.
- **`store/`** → Zustand (`useAppStore` para datos, `useUIStore` para modales).
- **`services/`** → IO (Capacitor Preferences hoy; Firestore/REST mañana).
- **`features/`** → cada feature aglutina su Page + Modales + lógica.
- **`components/`** → UI agnóstica de feature.

### ¿Dónde están las fórmulas de cálculo?

Todas en **un solo módulo**: [`src/features/summary/calculations.ts`](src/features/summary/calculations.ts).

Mantiene byte-a-byte la lógica del MVP:

```ts
// commCalc — fórmula central de comisiones
export function commCalc(r: Reservation, venues: Venue[]): CommissionResult {
  const price    = getVipPrice(r.venueId, r.vipType, venues);
  const promoter = round2(price    * (r.commissionPct || 0) / 100);
  const woman    = r.fromInvite ? round2(promoter * (r.womanPct || 0) / 100) : 0;
  return { price, tableTotal: price, promoter, woman };
}
// netToYou — Math.round((promoter - woman) * 100) / 100
export const netToYou = (c) => round2(c.promoter - c.woman);
```

`round2(x) = Math.round(x * 100) / 100` está en `src/core/utils/format.ts`.

Funciones expuestas en `calculations.ts` (todas portadas del MVP):
- `commCalc`, `netToYou` — comisiones por reserva.
- `getVipPrice`, `getVipOptionsForPax` — precios y filtros por pax.
- `venueVipSlotsUsed`, `venueVipSlotsLeft` — capacidad de mesas VIP.
- `venueGuestCount` — pax totales por venue.
- `slotById`, `slotLabel` — lookup de timeslots.
- `summarizeToday` — totales del día (`totP`, `totW`, `net`, influencers, guests por tipo).
- `summarizeYearlyGuestsByMonth` — bars del Yearly panel.
- `summarizeInfluencers` — ranking del Influencers panel.
- `summarizeVipCapacity` — matriz de capacidad VIP (Today panel).

---

## Funcionalidades del MVP — estado del port

| Funcionalidad | Estado |
|---|---|
| Página Home (lista de eventos del día) | ✅ |
| Página Events (filtros This/Next week/All) | ✅ |
| Página Guests (filtro por venue) | ✅ |
| Página Reservations (con preview de comisión) | ✅ |
| Página Venues (capacidad + edit/del) | ✅ |
| Summary > Today (totales, capacidad VIP, breakdown por reserva) | ✅ |
| Summary > Monthly (calendario con día seleccionable) | ✅ |
| Summary > Yearly (bars por mes) | ✅ |
| Summary > Influencers (ranking por visitas) | ✅ |
| Modal **addEvent / editEvent** (días, slots, privado, late club) | ✅ |
| Modal **eventDetail** (con invitaciones a privado) | ✅ |
| Modal **addGuest / editGuest** (event picker, club picker, invite types, platform) | ✅ |
| Modal **guestDetail** (toggleArrived, visit count, link IG/TT) | ✅ |
| Modal **addRes / editRes** (preview live de comisión, pax→VIP filter) | ✅ |
| Modal **resDetail** (breakdown completo) | ✅ |
| Modal **addVenue / editVenue** (timeslots / VIP / invite types editables) | ✅ |
| Onboarding 4 pasos (welcome → venue → event → done) | ✅ |
| Drawer (IonMenu) con Manage + Quick add | ✅ |
| Bottom-nav (IonTabs) Home / Guests / Reservations / More | ✅ |
| Persistencia (Capacitor Preferences) | ✅ |

---

## Setup inicial

> Requisitos: **Node ≥ 20**, **npm ≥ 10**.
> Para builds nativos: **Android Studio** y/o **Xcode + CocoaPods**.

```bash
cd /Users/laura/promhub-mobile

# 1) Instala dependencias
npm install

# 2) Instala el CLI de Ionic (opcional pero recomendado)
npm install -g @ionic/cli

# 3) Añade las plataformas nativas (genera /android y /ios)
npx cap add android
npx cap add ios            # solo en macOS con Xcode
```

---

## Correr en local (browser, hot-reload)

```bash
npm run dev
# abre http://localhost:8100
```

### Live-reload sobre dispositivo físico (opcional, recomendado)

```bash
# 1) Encuentra tu IP local (192.168.x.x)
# 2) Lanza Vite en esa IP
npm run dev -- --host 0.0.0.0

# 3) En otra terminal, arranca con live-reload (requiere @ionic/cli)
ionic cap run android -l --external
ionic cap run ios     -l --external
```

---

## Build de producción

```bash
npm run build       # genera /dist
npx cap sync        # copia /dist a /android y /ios + instala plugins nativos
```

---

## Generar APK (Android)

### Opción A — desde Android Studio (recomendado)

```bash
npm run android   # build + sync + abre Android Studio
```

Luego en Android Studio:
1. **Build → Generate Signed Bundle / APK…**
2. Elige **APK**.
3. Configura tu keystore (créalo si no tienes).
4. Selecciona variant **release**.

El APK se genera en `android/app/release/app-release.apk`.

### Opción B — desde terminal (debug APK)

```bash
npm run build && npx cap sync android
cd android
./gradlew assembleDebug
# APK en android/app/build/outputs/apk/debug/app-debug.apk
```

### Opción C — release APK firmado por terminal

```bash
# 1) Crea keystore (una vez)
keytool -genkey -v -keystore promhub-release.keystore \
  -alias promhub -keyalg RSA -keysize 2048 -validity 10000

# 2) Crea android/key.properties con:
#    storePassword=...
#    keyPassword=...
#    keyAlias=promhub
#    storeFile=/ruta/absoluta/a/promhub-release.keystore

# 3) Build release
cd android
./gradlew assembleRelease
# APK en android/app/build/outputs/apk/release/app-release.apk
```

> Para subir a Google Play, usa `bundleRelease` en lugar de `assembleRelease`
> y tendrás el `.aab` en `android/app/build/outputs/bundle/release/`.

---

## Generar IPA (iOS)

> **Solo macOS** con Xcode + CocoaPods (`sudo gem install cocoapods`).

### Build + abrir Xcode

```bash
npm run ios       # build + sync + abre Xcode
```

Luego en Xcode:
1. Selecciona el target **App**.
2. **Signing & Capabilities** → tu Team de Apple Developer.
3. Esquema **Any iOS Device (arm64)** o un dispositivo conectado.
4. **Product → Archive**.
5. En el organizador de Archives → **Distribute App**:
   - **App Store Connect** → para publicación / TestFlight.
   - **Ad Hoc** o **Development** → para genera un `.ipa` local.

El IPA se exporta a la carpeta de destino que elijas.

### Build IPA por terminal (CI / sin abrir Xcode)

```bash
npm run build && npx cap sync ios
cd ios/App
pod install

# Archive
xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Release -sdk iphoneos \
  -archivePath ./build/App.xcarchive archive

# Export IPA (necesita ExportOptions.plist con tu teamID y método de export)
xcodebuild -exportArchive \
  -archivePath ./build/App.xcarchive \
  -exportPath ./build/ipa \
  -exportOptionsPlist ./ExportOptions.plist
# IPA en ios/App/build/ipa/App.ipa
```

---

## Flujo funcional completo (de prueba)

1. Al primer arranque dispara el **onboarding**:
   - Step 1 → crea venue *Carpe Diem* (con seeds *Tardeo* / VIP / SUPER VIP).
   - Step 2 → crea evento *The Sailor* en Saturday.
2. Pulsa **+ Add** en *Reservations* → introduce contacto, 4 pax, selecciona VIP €500,
   `commission %` = 10, marca *Via invitation* con 50%.
   - El bloque de comisión se actualiza **en vivo** a medida que cambias los campos.
3. Ve a **Summary → Today**:
   - *Total earnings* = €50.0
   - *To pay via invitation* = €25.0
   - *Net earnings* = €25.0
4. Comprueba **VIP table capacity** (1 / 5 tables left, barra al 20%).
5. Marca al guest como llegado desde el detalle (`Mark arrived`).

---

## Scripts disponibles

| Script | Acción |
|---|---|
| `npm run dev` | Vite dev-server con hot-reload |
| `npm run build` | Build de producción a `/dist` |
| `npm run preview` | Sirve el build local |
| `npm run sync` | `build` + `cap sync` (refresca android/ios) |
| `npm run android` | Build + sync + abrir Android Studio |
| `npm run ios` | Build + sync + abrir Xcode |
| `npm run android:run` | Build + sync + correr en device/emulator Android |
| `npm run ios:run` | Build + sync + correr en device/emulator iOS |

---

## Stack y decisiones

- **React 18 + TypeScript** — strict mode, paths con `@/*`.
- **Ionic React 8** — componentes mobile, modo iOS por consistencia visual.
- **React Router 5** — requerido por `@ionic/react-router`.
- **Capacitor 6** — runtime nativo + Preferences/StatusBar/Keyboard.
- **Zustand** — estado global ligero (sin Redux ni Context drilling).
- **Vite** — bundler rápido con HMR.
- **CSS plano + variables** — port literal del MVP, sin frameworks de utilidades.

### Persistencia
`@capacitor/preferences` se usa como almacenamiento clave-valor. En web (dev) emula con `localStorage`; en nativo persiste en `NSUserDefaults` (iOS) / `SharedPreferences` (Android).

### Orquestación de modales
El MVP tiene un `openSheet(mode, data)` global. Aquí lo replico con `useUIStore` (Zustand)
y un único `<ModalsHost />` montado en `App.tsx`. Cualquier botón abre cualquier modal con:

```tsx
useUIStore.getState().open('addRes', { eventId: 3 });
```

---

## Asunciones del port (declaradas)

1. **Drawer del MVP → IonMenu** lateral (sustituye al panel custom; UX más estándar mobile).
2. **Bottom-nav 4 ítems** mantenido: Home / Guests / Reservations / More. **More** abre el menú con Events / Venues / Summary y los Quick add.
3. `alert()` y `confirm()` del MVP → se mantienen tal cual; en producción se pueden reemplazar por `IonAlert`.
4. **Date anchor**: el MVP fija `TODAY = new Date(2026, 3, 27)`. Se mantiene en `core/constants.ts` para reproducibilidad. Para producción real cambiar a `new Date()`.
5. Los toggles **This week / Next week / All** del MVP no filtran por fecha (son presentacionales en el MVP — aquí también).

---

## Roadmap razonable

- Migrar persistencia a Firestore / Supabase a través de `services/` (sin tocar `store/` ni `features/`).
- Reemplazar `alert/confirm` nativos por `IonAlert` / `IonToast`.
- Añadir tests unitarios sobre `calculations.ts` (las fórmulas son determinísticas y testeables).
- Sustituir el calendar mock del Monthly panel con datos reales por día.

---

## Public guest-registration link

Each event can expose a public link (`/register/<token>`) where guests
fill in their own details. Submissions are stored in **Vercel Blob**
with an embedded expiry of `eventDate + 24h`. Expired blobs are deleted
lazily on the next read of the same token (good enough for our volume —
storage is cheap and reads always check `expiresAt` before returning).

> **Why Blob and not KV (Redis):** Vercel's KV / Redis offering moved
> behind a paid plan. Vercel Blob is on the free tier (1 GB storage,
> 10 GB bandwidth/month) which is plenty for this use case — each
> event + submission is a few hundred bytes of JSON.

### Setup (one-time, on Vercel)

1. In the Vercel dashboard open the project → **Storage** → **Create
   Database** → **Blob**. Free tier.
2. Click **Connect Project** and Vercel injects `BLOB_READ_WRITE_TOKEN`
   automatically.
3. Redeploy. Nothing else needed — the `@vercel/blob` SDK reads the env
   var on its own.

### Architecture

- **API endpoints** (Vercel Serverless Functions in `/api/`):
  - `POST /api/event` — promoter publishes event metadata
  - `GET  /api/event?token=X` — public, fetches metadata for the form
  - `POST /api/registration` — public, submits a sign-up
  - `GET  /api/registration?token=X` — promoter lists submissions

- **Blob paths**:
  - `events/<token>.json` — event metadata (overwritten on each publish)
  - `registrations/<token>/<subId>.json` — one blob per submission
  - Every JSON document carries an `expiresAt` ISO instant; reads
    return 404 (and delete the blob) once it passes.

- **Frontend**:
  - `SharePanel` inside the event-detail modal: generates the link,
    copies / shares it, pulls submissions on demand.
  - Public route `/register/:token` (in `src/features/public/`) renders
    outside the app shell — no drawer, no onboarding, no auth.

### Local dev with the backend

The serverless `/api/*` functions don't run under `npm run dev` (Vite
alone). To exercise them locally, install Vercel CLI and use:

```bash
npm i -g vercel
vercel link                  # one-time, attach to your Vercel project
vercel env pull .env.local   # pulls KV_REST_API_* into the project
vercel dev                   # runs Vite + the API functions together
```

Without `vercel dev` the share button will fail when it tries to POST
to `/api/event` — that's expected; the rest of the app works fine.

(In `.env.local` you only need `BLOB_READ_WRITE_TOKEN` for the Blob
SDK — `vercel env pull` brings it down automatically.)

### Trade-offs declared

- **Same token reads & writes**: anyone with the link could `GET
  /api/registration?token=X` and see submissions. Acceptable while
  the data is just name + Instagram. If we need to harden, split into
  a public `writeToken` and a private `readSecret` and require the
  latter as a header on GET.
- **No rate-limiting**: fine while sharing with friends; before going
  wider, add a captcha or cap per-IP via Vercel Edge middleware.
- **Dedupe on import** uses the submission UUID. If you delete an
  imported guest in the app, a re-sync will not re-import that same
  submission. To force re-import, clear local data.

---

## Backend (Neon Postgres + Drizzle)

The app is no longer Preferences-only. Venues, events, guests and
reservations live in a Postgres database. The Capacitor app reads
and writes via `/api/v1/*` endpoints; local Preferences only holds
the device tenant UUID and the onboarding flag.

### One-time provisioning

1. In the Vercel dashboard open the project → **Storage** →
   **Create Database** → **Neon Postgres** (free tier "Hobby" is
   plenty for testing).
2. Click **Connect to Project** — Vercel injects `DATABASE_URL`
   (and `POSTGRES_URL`) automatically across all environments.
3. Locally, pull them: `vercel env pull .env.local`.
4. Generate and apply the schema:
   ```bash
   npm run db:generate     # writes SQL to api/_lib/migrations
   npm run db:push         # applies the schema to Neon
   ```
   (Use `npm run db:migrate` instead of `db:push` once you commit
   the generated SQL — `push` is for first-time bootstrap and
   prototyping.)
5. Optional dev UI: `npm run db:studio` opens Drizzle Studio.

### Architecture

```
/api/
  v1/
    venues/{index,[id]}.ts        — list/create + GET/PATCH/DELETE
    events/{index,[id]}.ts
    guests/{index,[id]}.ts
    reservations/{index,[id]}.ts
    sync.ts                       — one-shot snapshot upload
  _lib/
    schema.ts                     — Drizzle tables
    db.ts                         — Neon HTTP client
    tenancy.ts                    — resolves tenant from X-Tenant-Id
    validators.ts                 — Zod schemas
    errors.ts                     — typed HttpError
    migrations/                   — generated by drizzle-kit
  _handler.ts                     — error boundary + body parsing
  _health.ts                      — diagnostic endpoint
  event.ts, registration.ts       — public-form (Blob, unchanged)
```

### Tenancy (until login lands)

Every install generates a UUID v4 on first launch and stores it in
Capacitor Preferences. Every API call sends it in `X-Tenant-Id`. The
backend `resolveTenant()` either looks up the row or creates it.

When real auth ships, migrating from device-tenants to user-tenants
is a single SQL UPDATE — no schema change needed.

### First-run migration from local data

If a user has data from the Preferences era (`promhub.state.v1`),
the store reads it on first launch, POSTs it as a snapshot to
`/api/v1/sync`, and marks `promhub.migrated.v1: true` so it doesn't
run again. The local snapshot stays as a safety backup until the
sync succeeds.

### Where the business logic lives

- **Validation, persistence, integrity, cascades**: backend
  (`api/v1` + `api/_lib`).
- **Pure formulas** (commission, capacity, occurrence dates):
  `src/features/summary/calculations.ts`. Kept on the client so
  the UI stays responsive when the user types (pax → commission
  recompute happens instantly, no round trip). If we ever need
  these server-side too (e.g. for reports), the module can be
  imported from `/api/_lib/` with no changes.

### Trade-offs declared

- **Network-bound mutations**: every save hits the API. No outbox
  / optimistic-with-rollback yet. If you save offline you get an
  error. Adding optimistic UI later requires a separate "pending"
  state in the store.
- **Single token, no auth**: anyone who steals the device UUID can
  read/write that tenant's data. Acceptable until login ships;
  rotate to real auth before going public.
- **Snapshot migration is once-only**: re-running `/api/v1/sync`
  for the same tenant duplicates data. Gated by the
  `promhub.migrated.v1` flag in Preferences.
