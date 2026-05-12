// ─────────────────────────────────────────────────────────────
//  Outbound messaging helpers.
//
//  Instagram has NO public API for sending DMs from a third-party
//  app without going through Meta's Messaging API (requires
//  business account + Facebook Page link + app review). What we
//  CAN do legitimately is:
//    1) Copy the message to the clipboard.
//    2) Deep-link the user to the recipient's IG profile.
//    3) The user taps the airplane icon, pastes, and sends.
//
//  This keeps us within Instagram's TOS and matches the "ya
//  hablaron primero" workflow PromHub uses.
// ─────────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const sanitizeHandle = (h: string) => h.replace(/^@+/, '').trim();

export type MessagingPlatform = 'instagram' | 'tiktok';

export interface SendResult {
  copied: boolean;
  opened: boolean;
}

/**
 * Prepare and trigger an Instagram (or TikTok) outreach:
 *  - Copies `message` to the clipboard.
 *  - Tries to open the native app at the recipient's profile via
 *    a custom-scheme URL. Falls back to the public web profile if
 *    the app is not installed.
 *
 * Returns flags so the caller can show appropriate UI feedback.
 */
export async function sendViaSocial(
  platform: MessagingPlatform,
  handle: string,
  message: string,
): Promise<SendResult> {
  const h = sanitizeHandle(handle);
  if (!h) return { copied: false, opened: false };

  const copied = await copyToClipboard(message);

  const nativeUrl = platform === 'tiktok'
    ? `snssdk1233://user/profile/${h}` // TikTok scheme
    : `instagram://user?username=${h}`;
  const webUrl = platform === 'tiktok'
    ? `https://www.tiktok.com/@${h}`
    : `https://www.instagram.com/${h}/`;

  // On native (iOS/Android Capacitor WebView) the custom scheme
  // launches the IG/TikTok app. On desktop browsers the scheme is
  // silently dropped — we open the web profile in a new tab instead.
  const isNative = isLikelyNative();
  let opened = false;
  try {
    if (isNative) {
      window.location.href = nativeUrl;
    } else {
      const w = window.open(webUrl, '_blank', 'noopener,noreferrer');
      opened = !!w;
      if (!w) {
        // popup blocked — at least navigate this tab
        window.location.href = webUrl;
      }
    }
    opened = true;
  } catch {
    /* opened stays false */
  }
  return { copied, opened };
}

// Heuristic — Capacitor sets specific UA hints, but for our purposes
// any non-desktop user-agent is treated as "native-like" so the
// custom scheme is attempted.
function isLikelyNative(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Capacitor/i.test(ua);
}

// ─────────────────────────────────────────────────────────────
//  WhatsApp dispatch — wa.me deep link.
//
//  `wa.me/<digits>?text=<urlencoded>` opens WhatsApp on the
//  conversation with the given international number, pre-filled
//  with the message text. The user still has to tap Send, which
//  is exactly what we want (and what WhatsApp's TOS requires).
//
//  Both `phoneCode` and `phoneNum` may contain spaces / dashes;
//  we strip everything that isn't a digit. The country code's
//  leading "+" is also dropped for the URL.
// ─────────────────────────────────────────────────────────────
export interface WhatsAppRecipient {
  phoneCode: string;
  phoneNum: string;
}

export function sendViaWhatsApp(to: WhatsAppRecipient, message: string): boolean {
  const code = (to.phoneCode || '').replace(/\D+/g, '');
  const num = (to.phoneNum || '').replace(/\D+/g, '');
  if (!code || !num) return false;
  const url = `https://wa.me/${code}${num}?text=${encodeURIComponent(message)}`;
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
  return true;
}
