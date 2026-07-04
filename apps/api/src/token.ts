// Opaque, signed, event-scoped guest token (CLAUDE.md: guests never log in —
// a signed opaque token is their only credential).
//
// Wire format:  base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
// The HMAC key is the Worker secret GUEST_TOKEN_SECRET. It lives only on the
// Worker and is never shipped to the browser. The token is opaque to the guest:
// the payload is readable but not forgeable without the secret, and we never
// trust it until the signature verifies.
//
// We store only SHA-256(token) in guests.token_hash — never the raw token.

export type GuestTokenPayload = {
  event_id: string; // uuid of the event this token is scoped to
  guest_id: string; // uuid of the guest session row
  iat: number; // issued-at, epoch seconds
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function base64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Sign a payload into an opaque event-scoped token. */
export async function signGuestToken(
  payload: GuestTokenPayload,
  secret: string,
): Promise<string> {
  const body = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${base64urlEncode(sig)}`;
}

/**
 * Verify a token's signature and shape. Returns the payload on success, or null
 * if the token is malformed, tampered, or signed with a different key. Callers
 * MUST treat null as "reject" (401) — never fall through to a lookup.
 */
export async function verifyGuestToken(
  token: string,
  secret: string,
): Promise<GuestTokenPayload | null> {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  let provided: Uint8Array;
  try {
    provided = base64urlDecode(sig);
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  let ok = false;
  try {
    // subtle.verify recomputes HMAC(body) and compares it to `provided`.
    ok = await crypto.subtle.verify('HMAC', key, provided, enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const json = JSON.parse(dec.decode(base64urlDecode(body))) as unknown;
    if (
      json &&
      typeof json === 'object' &&
      typeof (json as GuestTokenPayload).event_id === 'string' &&
      typeof (json as GuestTokenPayload).guest_id === 'string' &&
      typeof (json as GuestTokenPayload).iat === 'number'
    ) {
      return json as GuestTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * SHA-256 hex of the raw token — the value stored in guests.token_hash.
 * The raw token itself is never persisted; we hash the presented token the same
 * way at read time and compare hashes.
 */
export async function tokenHash(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(token)));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}
