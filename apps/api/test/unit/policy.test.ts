import { describe, expect, it } from 'vitest';
import { hasRole, requiredRole } from '../../src/lib/policy';

describe('requiredRole', () => {
  it.each([
    ['GET', '/contracts', 'VIEWER'],
    ['GET', '/settings/networks', 'VIEWER'],
    ['POST', '/contracts', 'EDITOR'],
    ['POST', '/alerts/:id/acknowledge', 'EDITOR'],
    ['DELETE', '/destinations/:id', 'EDITOR'],
    ['POST', '/settings/networks/test', 'EDITOR'],
    ['PUT', '/settings/networks/:network', 'ADMIN'],
    ['PUT', '/settings/notifications', 'ADMIN'],
    ['GET', '/settings/tokens', 'ADMIN'],
    ['POST', '/settings/tokens', 'ADMIN'],
    ['GET', '/audit-log', 'ADMIN'],
  ])('%s %s needs %s', (method, route, role) => {
    expect(requiredRole(method, route)).toBe(role);
  });
});

describe('hasRole', () => {
  it('ranks roles', () => {
    expect(hasRole('ADMIN', 'EDITOR')).toBe(true);
    expect(hasRole('EDITOR', 'EDITOR')).toBe(true);
    expect(hasRole('VIEWER', 'EDITOR')).toBe(false);
    expect(hasRole('EDITOR', 'ADMIN')).toBe(false);
  });
});
