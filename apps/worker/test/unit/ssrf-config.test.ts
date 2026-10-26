import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { assertPublicUrl, isPrivateAddress } from '../../src/ssrf';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks %s', (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows %s', (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
  it('treats non-IP input as private', () => expect(isPrivateAddress('not-an-ip')).toBe(true));
});

describe('assertPublicUrl', () => {
  it('rejects literal private hosts', async () => {
    await expect(assertPublicUrl('http://127.0.0.1:8080/hook')).rejects.toThrow(/private address/);
    await expect(assertPublicUrl('http://[::1]/hook')).rejects.toThrow(/private address/);
    await expect(assertPublicUrl('http://localhost/hook')).rejects.toThrow(/private address/);
  });
  it('accepts public literal hosts', async () => {
    await expect(assertPublicUrl('https://8.8.8.8/hook')).resolves.toBeUndefined();
  });
});

describe('loadConfig', () => {
  it('applies defaults and parses booleans', () => {
    const cfg = loadConfig({ DATABASE_URL: 'postgresql://x', WEBHOOK_BLOCK_PRIVATE_IPS: 'true' });
    expect(cfg.INGEST_INTERVAL_MS).toBe(10_000);
    expect(cfg.WEBHOOK_MAX_ATTEMPTS).toBe(6);
    expect(cfg.WEBHOOK_BLOCK_PRIVATE_IPS).toBe(true);
    expect(cfg.SMTP_SECURE).toBe(false);
  });
  it('rejects out-of-range values', () => {
    expect(() => loadConfig({ DATABASE_URL: 'x', INGEST_INTERVAL_MS: '10' })).toThrow(
      /INGEST_INTERVAL_MS/,
    );
  });
});
