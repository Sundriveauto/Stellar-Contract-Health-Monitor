import { describe, expect, it } from 'vitest';
import { formatDuration, formatLedgers, shortId, timeAgo } from '../src/format';

describe('format helpers', () => {
  it('shortens ids', () => {
    expect(shortId('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC')).toBe('CDLZFC…CYSC');
    expect(shortId('short')).toBe('short');
    expect(shortId(null)).toBe('—');
  });
  it('formats durations', () => {
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(3600 * 49)).toBe('2d 1h');
    expect(formatDuration(86400 * 30)).toBe('30d');
  });
  it('formats ledgers with time estimates', () => {
    expect(formatLedgers(17280)).toBe(`${(17280).toLocaleString()} ledgers (~1d)`);
    expect(formatLedgers(0)).toBe('expired');
    expect(formatLedgers(null)).toBe('—');
  });
  it('formats relative time', () => {
    const now = new Date('2026-01-01T00:10:00Z');
    expect(timeAgo('2026-01-01T00:00:00Z', now)).toBe('10m ago');
    expect(timeAgo(null, now)).toBe('never');
  });
});
