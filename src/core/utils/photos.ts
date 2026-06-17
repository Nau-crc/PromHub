// ─────────────────────────────────────────────────────────────
//  Client-side photo resize.
//
//  Phone cameras produce 3-8 MB JPEGs that would blow past
//  Vercel Hobby's 4.5 MB body cap once base64-encoded. Before we
//  send anything to /api/v1/photos we draw the source onto a
//  canvas at a capped longest-edge dimension and re-encode as
//  JPEG with quality 0.82. The output is typically 200-500 KB —
//  more than enough resolution for a door bouncer's quick look.
//
//  HEIC isn't decoded by browsers; iOS Safari converts on file
//  pick automatically when the form uses `<input type="file"
//  accept="image/*">`, so we don't need a polyfill here.
// ─────────────────────────────────────────────────────────────

const MAX_DIM = 1600;
const QUALITY = 0.82;

export async function resizePhotoForUpload(file: File | Blob): Promise<Blob> {
  const bitmap = await loadImage(file);
  const { width: srcW, height: srcH } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context not available');
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) throw new Error('Photo encoding failed');
  return blob;
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}
