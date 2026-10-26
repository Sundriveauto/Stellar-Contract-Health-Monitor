import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ADMIN_API_TOKEN: z.string().optional(),
  CORS_ORIGINS: z.string().default(''),
  INITIAL_LOOKBACK_LEDGERS: z.coerce.number().int().min(0).default(17_280),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(600),
  METRICS_TOKEN: z.string().optional(),
  TRUST_PROXY: bool,
});

export type ApiConfig = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid API configuration:\n${issues}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production') {
    if (cfg.ADMIN_API_TOKEN && cfg.ADMIN_API_TOKEN.length < 24) {
      throw new Error('ADMIN_API_TOKEN must be at least 24 characters in production');
    }
    if (cfg.ADMIN_API_TOKEN === 'change-me-to-a-long-random-string') {
      throw new Error('ADMIN_API_TOKEN is still set to the example value');
    }
  }
  return {
    ...cfg,
    corsOrigins: cfg.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
