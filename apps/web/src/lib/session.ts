export const SESSION_COOKIE = 'schm_session';

export function apiBaseUrl(): string {
  return (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}
