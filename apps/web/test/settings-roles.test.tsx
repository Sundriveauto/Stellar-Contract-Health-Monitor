import type * as ApiModule from '@/lib/api';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/lib/api';

let role: Role = 'VIEWER';
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof ApiModule>()),
  useMe: () => ({ data: { principal: { type: 'token', id: 't', name: 'Tester', role } } }),
  useApi: () => ({ data: undefined, isLoading: false, mutate: vi.fn() }),
  api: vi.fn(),
}));
vi.mock('@/components/app-shell', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const { default: SettingsPage } = await import('@/app/settings/page');

beforeEach(() => {
  role = 'VIEWER';
});

describe('Settings role gating', () => {
  it.each<[Role, boolean]>([
    ['VIEWER', false],
    ['EDITOR', false],
    ['ADMIN', true],
  ])('%s sees token management and audit log: %s', (r, visible) => {
    role = r;
    render(<SettingsPage />);
    expect(screen.queryByRole('heading', { name: 'API tokens' }) !== null).toBe(visible);
    expect(screen.queryByRole('heading', { name: 'Audit log' }) !== null).toBe(visible);
    expect(screen.queryByText(/requires an admin token/) !== null).toBe(!visible);
    expect(screen.getByRole('heading', { name: 'RPC providers' })).toBeInTheDocument();
  });
});
