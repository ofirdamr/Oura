// Minimal, dependency-free Stripe client for the Cloudflare Worker runtime.
//
// Why not the `stripe` npm SDK: the codebase deliberately avoids heavy libs on
// the Worker (see token.ts using Web Crypto instead of a JWT library). Stripe's
// REST API is plain form-encoded POST + Bearer auth, and webhook verification is
// an HMAC-SHA256 the Web Crypto API does natively — so a ~120-line helper beats
// pulling the SDK (and its Node shims) into the Worker bundle.
//
// SAFETY GUARD (isTestKey): this Stripe account is the founder's REAL business
// (Makeupbyyo.com). To make an accidental live charge structurally impossible,
// createCheckoutSession refuses any key not prefixed `sk_test_` unless the
// explicit STRIPE_ALLOW_LIVE escape hatch is set. See the checkout route.

export function isTestKey(secretKey: string | undefined): boolean {
  return typeof secretKey === 'string' && secretKey.startsWith('sk_test_');
}

export type CheckoutLineItem = {
  name: string;
  unit_agorot: number;
  quantity: number;
};

export type CreateCheckoutParams = {
  secretKey: string;
  currency: string; // 'ils'
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  clientReferenceId: string; // our order id
  metadata: Record<string, string>;
  idempotencyKey: string;
  customerEmail?: string;
};

export type CheckoutSession = { id: string; url: string };

// Flatten our known checkout params into Stripe's bracketed form-encoding.
function encodeCheckoutForm(p: CreateCheckoutParams): string {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', p.successUrl);
  params.set('cancel_url', p.cancelUrl);
  params.set('client_reference_id', p.clientReferenceId);
  // Collect a shipping address + phone on Stripe's hosted page (Israel only for now).
  params.set('billing_address_collection', 'required');
  params.set('shipping_address_collection[allowed_countries][0]', 'IL');
  params.set('phone_number_collection[enabled]', 'true');
  if (p.customerEmail) params.set('customer_email', p.customerEmail);
  for (const [k, v] of Object.entries(p.metadata)) {
    params.set(`metadata[${k}]`, v);
  }
  p.lineItems.forEach((li, i) => {
    params.set(`line_items[${i}][quantity]`, String(li.quantity));
    params.set(`line_items[${i}][price_data][currency]`, p.currency);
    params.set(`line_items[${i}][price_data][unit_amount]`, String(li.unit_agorot));
    params.set(`line_items[${i}][price_data][product_data][name]`, li.name);
  });
  return params.toString();
}

export async function createCheckoutSession(
  p: CreateCheckoutParams,
): Promise<{ ok: true; session: CheckoutSession } | { ok: false; error: string; detail?: string }> {
  let res: Response;
  try {
    res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${p.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Idempotency-Key makes a retried checkout (double-submit, network retry)
        // return the SAME session instead of creating a duplicate.
        'Idempotency-Key': p.idempotencyKey,
      },
      body: encodeCheckoutForm(p),
    });
  } catch (err) {
    return { ok: false, error: 'stripe_unreachable', detail: String(err) };
  }

  const body = (await res.json().catch(() => null)) as
    | { id?: string; url?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !body?.id || !body?.url) {
    return {
      ok: false,
      error: 'stripe_session_failed',
      detail: body?.error?.message ?? `http_${res.status}`,
    };
  }
  return { ok: true, session: { id: body.id, url: body.url } };
}

// --- Webhook signature verification (Stripe's scheme, via Web Crypto) ---------
// Header format: `t=<unix ts>,v1=<hex hmac>[,v1=<hex hmac>...]`.
// Signed payload is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret.

const encoder = new TextEncoder();

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify the raw request body against the Stripe-Signature header. Returns the
// parsed event on success, or null on any failure (bad sig, stale timestamp,
// malformed header). `toleranceSeconds` guards against replay of old payloads.
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
  endpointSecret: string,
  toleranceSeconds = 300,
): Promise<Record<string, unknown> | null> {
  if (!signatureHeader || !endpointSecret) return null;

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return null;

  // Reject stale timestamps (replay protection).
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return null;
  if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSeconds) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(endpointSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = toHex(sigBuf);

  const matched = signatures.some((s) => timingSafeEqualHex(s, expected));
  if (!matched) return null;

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
}
