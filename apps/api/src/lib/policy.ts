export const ROLES = ['VIEWER', 'EDITOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2 };

export function hasRole(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}

/** Routes that expose credentials or account administration: admins only, even for reads. */
const ADMIN_ONLY_PREFIXES = ['/settings/tokens', '/audit-log'];

/**
 * Minimum role for a request, decided from its method and route pattern:
 * - reads need VIEWER, except token management and the audit log (ADMIN);
 * - changes to settings (RPC providers, notification preferences) need ADMIN;
 * - every other change needs EDITOR.
 * The probe endpoint `POST /settings/networks/test` only reads, so EDITOR is enough.
 */
export function requiredRole(method: string, route: string): Role {
  if (ADMIN_ONLY_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`))) return 'ADMIN';
  const read = method === 'GET' || method === 'HEAD';
  if (read) return 'VIEWER';
  if (route === '/settings/networks/test') return 'EDITOR';
  if (route.startsWith('/settings/')) return 'ADMIN';
  return 'EDITOR';
}
