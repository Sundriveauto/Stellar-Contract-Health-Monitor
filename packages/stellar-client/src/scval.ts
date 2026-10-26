import { scValToNative, xdr } from '@stellar/stellar-sdk';

/** Converts a value produced by scValToNative into something JSON-serialisable. */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) out[String(toDisplayString(k))] = toJsonSafe(v);
    return out;
  }
  if (typeof value === 'object') {
    const maybeAddr = value as { toString?: () => string; constructor?: { name?: string } };
    const ctor = maybeAddr.constructor?.name;
    if (ctor === 'Address' || ctor === 'Contract') return String(maybeAddr.toString?.());
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toJsonSafe(v);
    return out;
  }
  return String(value);
}

function toDisplayString(native: unknown): string {
  if (native === null || native === undefined) return 'void';
  if (typeof native === 'string') return native;
  if (typeof native === 'number' || typeof native === 'bigint' || typeof native === 'boolean') {
    return String(native);
  }
  if (native instanceof Uint8Array) return Buffer.from(native).toString('hex');
  return JSON.stringify(toJsonSafe(native));
}

export interface DecodedScVal {
  /** Compact human-readable form, used for topic display and matching. */
  display: string;
  /** JSON-safe decoded value. */
  json: unknown;
  /** Base64 XDR of the original value. */
  xdr: string;
}

export function decodeScVal(value: xdr.ScVal): DecodedScVal {
  const xdrB64 = value.toXDR('base64');
  try {
    const native = scValToNative(value);
    return { display: toDisplayString(native), json: toJsonSafe(native), xdr: xdrB64 };
  } catch {
    // Unknown/unsupported value types: fall back to the raw XDR so nothing is lost.
    return { display: `xdr:${xdrB64}`, json: { xdr: xdrB64 }, xdr: xdrB64 };
  }
}

export function decodeScValXdr(base64: string): DecodedScVal {
  return decodeScVal(xdr.ScVal.fromXDR(base64, 'base64'));
}
