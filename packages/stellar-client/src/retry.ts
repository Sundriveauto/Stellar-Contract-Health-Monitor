export interface RetryOptions {
  retries: number;
  /** Base delay in ms for exponential backoff. */
  baseDelayMs: number;
  maxDelayMs: number;
  /** Return false to stop retrying immediately. */
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Full-jitter exponential backoff delay for the given (1-based) retry attempt. */
export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random = Math.random,
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(exp / 2 + random() * (exp / 2));
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const retryable = opts.shouldRetry ? opts.shouldRetry(err) : true;
      if (!retryable || attempt > opts.retries) throw err;
      const delay = backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      opts.onRetry?.(err, attempt, delay);
      await sleep(delay);
    }
  }
}
