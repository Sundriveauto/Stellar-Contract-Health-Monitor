import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { toPage } from '../../src/lib/pagination';
import { contractHealth } from '../../src/lib/serialize';
import { generateApiToken, hashToken, safeEqual } from '../../src/lib/tokens';

describe('loadConfig', () => {
  const base = { DATABASE_URL: 'postgresql://x' };

  it('applies defaults and splits CORS origins', () => {
    const cfg = loadConfig({ ...base, CORS_ORIGINS: 'https://a.com, https://b.com ,' });
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(cfg.TRUST_PROXY).toBe(false);
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejects weak or example admin tokens in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', ADMIN_API_TOKEN: 'short' })).toThrow(
      /24 characters/,
    );
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        ADMIN_API_TOKEN: 'change-me-to-a-long-random-string',
      }),
    ).toThrow(/example value/);
    expect(
      loadConfig({ ...base, NODE_ENV: 'production', ADMIN_API_TOKEN: 'x'.repeat(32) })
        .ADMIN_API_TOKEN,
    ).toHaveLength(32);
  });
});

describe('tokens', () => {
  it('generates prefixed, unique tokens and stable hashes', () => {
    const a = generateApiToken();
    const b = generateApiToken();
    expect(a).toMatch(/^schm_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it('compares in constant time regardless of length', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('toPage', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
  it('returns a cursor only when more rows exist', () => {
    expect(toPage(rows(3), 3)).toEqual({ items: rows(3), nextCursor: null });
    expect(toPage(rows(4), 3)).toEqual({ items: rows(3), nextCursor: '2' });
  });
});

describe('contractHealth', () => {
  const ok = { status: 'ACTIVE' as const, consecutiveFailures: 0, lastPolledAt: new Date() };
  it('classifies contract state', () => {
    expect(contractHealth({ ...ok, lastPolledAt: null })).toBe('pending');
    expect(contractHealth(ok)).toBe('healthy');
    expect(contractHealth({ ...ok, status: 'PAUSED' })).toBe('paused');
    expect(contractHealth({ ...ok, consecutiveFailures: 2 })).toBe('warning');
    expect(contractHealth(ok, { openAlerts: 1 })).toBe('warning');
    expect(contractHealth({ ...ok, consecutiveFailures: 5 })).toBe('critical');
    expect(contractHealth(ok, { nearestExpiryLedgers: 0 })).toBe('critical');
  });
});
