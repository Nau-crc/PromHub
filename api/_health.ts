import { safe } from './_safe';

// /api/_health — diagnostic endpoint. Open in a browser to verify
// the function infra runs AND that the relevant env vars are
// present, without touching Blob or Postgres.

export default safe(async () => async (_req, res) => {
  // Scan for any DATABASE_URL-shaped variable (covers Vercel's
  // custom-prefix integrations like `promhubbd_DATABASE_URL`).
  const dbVarPresent = Object.entries(process.env).some(
    ([key, value]) => !!value && /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(key),
  );

  res.status(200).json({
    ok: true,
    runtime: process.version,
    region: process.env.VERCEL_REGION ?? null,
    env: {
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
      DATABASE_URL: dbVarPresent,
    },
    timestamp: new Date().toISOString(),
  });
});
