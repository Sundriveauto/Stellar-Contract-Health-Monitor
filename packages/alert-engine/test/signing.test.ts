import { describe, expect, it } from 'vitest';
import { generateWebhookSecret, signWebhook, verifyWebhookSignature } from '../src';

describe('webhook signing', () => {
  const secret = 'whsec_test_secret_value';
  const body = JSON.stringify({ hello: 'world' });

  it('produces a stable sha256 signature', () => {
    expect(signWebhook(secret, 1700000000, body)).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signWebhook(secret, 1700000000, body)).toBe(signWebhook(secret, 1700000000, body));
  });

  it('verifies valid signatures and rejects tampering or stale timestamps', () => {
    const ts = 1700000000;
    const sig = signWebhook(secret, ts, body);
    expect(
      verifyWebhookSignature({ secret, timestamp: ts, body, signature: sig, now: ts + 10 }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({ secret, timestamp: ts, body: body + ' ', signature: sig, now: ts }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({ secret: 'other', timestamp: ts, body, signature: sig, now: ts }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({ secret, timestamp: ts, body, signature: sig, now: ts + 1000 }),
    ).toBe(false);
  });

  it('generates unique secrets', () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
    expect(generateWebhookSecret()).toMatch(/^whsec_/);
  });
});
