/** Error raised by the RPC wrapper with enough context to decide on retries and user messaging. */
export class RpcError extends Error {
  constructor(
    message: string,
    readonly kind:
      'network' | 'rate_limited' | 'server' | 'invalid_request' | 'not_found' | 'unknown',
    readonly retryable: boolean,
    readonly rpcCode?: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

const RETRYABLE_NET_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'ECONNABORTED',
  'ERR_NETWORK',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/** Maps the various shapes the SDK throws (axios errors, JSON-RPC error objects) into RpcError. */
export function classifyRpcError(err: unknown): RpcError {
  if (err instanceof RpcError) return err;
  const e = err as {
    code?: unknown;
    message?: unknown;
    response?: { status?: number; data?: unknown };
    status?: number;
  } | null;
  const message = typeof e?.message === 'string' ? e.message : String(err);
  const status = e?.response?.status ?? (typeof e?.status === 'number' ? e.status : undefined);

  if (status === 429)
    return new RpcError('RPC rate limit exceeded', 'rate_limited', true, undefined, err);
  if (status !== undefined && status >= 500) {
    return new RpcError(`RPC server error (HTTP ${status})`, 'server', true, undefined, err);
  }
  if (status !== undefined && status >= 400) {
    return new RpcError(
      `RPC request rejected (HTTP ${status}): ${message}`,
      'invalid_request',
      false,
      undefined,
      err,
    );
  }
  if (typeof e?.code === 'string' && RETRYABLE_NET_CODES.has(e.code)) {
    return new RpcError(
      `RPC network error (${e.code}): ${message}`,
      'network',
      true,
      undefined,
      err,
    );
  }
  if (typeof e?.code === 'number') {
    // JSON-RPC: -32600..-32602 are caller errors; -32603 and custom server codes are transient.
    const invalid = e.code === -32600 || e.code === -32601 || e.code === -32602;
    return new RpcError(message, invalid ? 'invalid_request' : 'server', !invalid, e.code, err);
  }
  if (/timeout|socket hang up|network/i.test(message)) {
    return new RpcError(`RPC network error: ${message}`, 'network', true, undefined, err);
  }
  return new RpcError(message, 'unknown', false, undefined, err);
}

/**
 * RPC returns this when a requested start ledger / cursor is outside the retention window,
 * e.g. "startLedger must be between the oldest ledger: 100 and the latest ledger: 200".
 */
export function isOutOfRetentionError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err);
  return /must be between the oldest ledger|before the oldest ledger|cursor.*(too old|out of range|invalid)|ledger range/i.test(
    msg,
  );
}
