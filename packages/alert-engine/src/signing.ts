import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Webhook signature: HMAC-SHA256 over `${timestamp}.${body}` with the destination secret,
 * sent as `sha256=<hex>`. Including the timestamp lets receivers reject replays.
 */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export function verifyWebhookSignature(params: {
  secret: string;
  timestamp: number;
  body: string;
  signature: string;
  toleranceSeconds?: number;
  now?: number;
}): boolean {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const tolerance = params.toleranceSeconds ?? 300;
  if (Math.abs(now - params.timestamp) > tolerance) return false;
  const expected = Buffer.from(signWebhook(params.secret, params.timestamp, params.body));
  const actual = Buffer.from(params.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}
