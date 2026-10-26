import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

/**
 * Encrypts secrets stored in the database (webhook signing secrets, custom header values)
 * with AES-256-GCM. Values written before encryption was enabled stay readable and are
 * re-encrypted when next written.
 */
export interface SecretBox {
  /** True when a key is configured; without one, values are stored as given. */
  readonly enabled: boolean;
  seal(value: string): string;
  open(value: string): string;
  isSealed(value: string): boolean;
}

/** Accepts 32 bytes as 64 hex characters or base64 (e.g. `openssl rand -base64 32`). */
export function parseEncryptionKey(material: string): Buffer {
  const trimmed = material.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64');
  if (key.length !== 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be 32 bytes, as 64 hex characters or base64');
  }
  return key;
}

export function createSecretBox(keyMaterial?: string | null): SecretBox {
  const key = keyMaterial ? parseEncryptionKey(keyMaterial) : null;
  const isSealed = (value: string) => value.startsWith(PREFIX);
  return {
    enabled: key !== null,
    isSealed,
    seal(value) {
      if (!key || isSealed(value)) return value;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
    },
    open(value) {
      if (!isSealed(value)) return value;
      if (!key) throw new Error('SECRETS_ENCRYPTION_KEY is required to read encrypted secrets');
      const [iv, tag, data] = value.slice(PREFIX.length).split(':');
      if (!iv || !tag || data === undefined) throw new Error('Malformed encrypted secret');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}

type WebhookConfigLike = { secret?: unknown; headers?: unknown } & Record<string, unknown>;

function mapSensitive(config: unknown, fn: (v: string) => string): Record<string, unknown> {
  const c = { ...((config ?? {}) as WebhookConfigLike) };
  if (typeof c.secret === 'string') c.secret = fn(c.secret);
  if (c.headers && typeof c.headers === 'object') {
    c.headers = Object.fromEntries(
      Object.entries(c.headers as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === 'string' ? fn(v) : v,
      ]),
    );
  }
  return c;
}

/** Encrypts the secret and header values of a webhook destination config. */
export function sealWebhookConfig(box: SecretBox, config: unknown): Record<string, unknown> {
  return mapSensitive(config, (v) => box.seal(v));
}

/** Decrypts the secret and header values of a webhook destination config. */
export function openWebhookConfig(box: SecretBox, config: unknown): Record<string, unknown> {
  return mapSensitive(config, (v) => box.open(v));
}
