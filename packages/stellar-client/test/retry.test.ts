import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, classifyRpcError, isOutOfRetentionError, RpcError, withRetry } from '../src';

describe('withRetry', () => {
  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValue(42);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      withRetry(fn, { retries: 3, baseDelayMs: 10, maxDelayMs: 100, sleep }),
    ).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 1, maxDelayMs: 1, sleep: async () => {} }),
    ).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new RpcError('bad', 'invalid_request', false));
    await expect(
      withRetry(fn, {
        retries: 5,
        baseDelayMs: 1,
        maxDelayMs: 1,
        sleep: async () => {},
        shouldRetry: (e) => e instanceof RpcError && e.retryable,
      }),
    ).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('backoffDelay', () => {
  it('grows exponentially and is capped', () => {
    expect(backoffDelay(1, 100, 10_000, () => 1)).toBe(100);
    expect(backoffDelay(3, 100, 10_000, () => 1)).toBe(400);
    expect(backoffDelay(20, 100, 1_000, () => 1)).toBe(1_000);
    expect(backoffDelay(3, 100, 10_000, () => 0)).toBe(200);
  });
});

describe('classifyRpcError', () => {
  it('treats 429 and 5xx as retryable', () => {
    expect(classifyRpcError({ response: { status: 429 }, message: 'x' })).toMatchObject({
      kind: 'rate_limited',
      retryable: true,
    });
    expect(classifyRpcError({ response: { status: 503 }, message: 'x' })).toMatchObject({
      kind: 'server',
      retryable: true,
    });
  });

  it('treats 4xx and invalid params as permanent', () => {
    expect(classifyRpcError({ response: { status: 400 }, message: 'x' }).retryable).toBe(false);
    expect(classifyRpcError({ code: -32602, message: 'invalid params' }).retryable).toBe(false);
  });

  it('treats connection errors as retryable', () => {
    expect(classifyRpcError({ code: 'ECONNRESET', message: 'reset' })).toMatchObject({
      kind: 'network',
      retryable: true,
    });
  });
});

describe('isOutOfRetentionError', () => {
  it('recognises the RPC retention error message', () => {
    expect(
      isOutOfRetentionError(
        new Error('startLedger must be between the oldest ledger: 100 and the latest ledger: 200'),
      ),
    ).toBe(true);
    expect(isOutOfRetentionError(new Error('something else'))).toBe(false);
  });
});
