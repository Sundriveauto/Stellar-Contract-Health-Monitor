import type * as ApiModule from '@/lib/api';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractLabel } from '@/components/contract-label';
import type { Role } from '@/lib/api';

const apiMock = vi.fn();
let role: Role | undefined = 'EDITOR';
let failWith: string | null = null;
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof ApiModule>()),
  useMe: () =>
    role
      ? { data: { principal: { type: 'token', id: 't', name: 'Tester', role } } }
      : { data: undefined },
  api: async (...args: unknown[]) => {
    apiMock(...args);
    if (failWith) throw new Error(failWith);
    return {};
  },
}));

beforeEach(() => {
  apiMock.mockReset();
  role = 'EDITOR';
  failWith = null;
});

describe('ContractLabel', () => {
  it.each(['EDITOR', 'ADMIN'] as const)('%s can rename a contract', async (r) => {
    role = r;
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ContractLabel id="c1" label="Token" onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: 'Rename contract' }));
    const input = screen.getByLabelText('Contract name');
    expect(input).toHaveValue('Token');
    await user.clear(input);
    await user.type(input, 'Treasury');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByLabelText('Contract name')).not.toBeInTheDocument());
    expect(apiMock).toHaveBeenCalledWith('/contracts/c1', {
      method: 'PATCH',
      body: { label: 'Treasury' },
    });
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByText('Token')).toBeInTheDocument();
  });

  it('sends an empty label to clear it', async () => {
    const user = userEvent.setup();
    render(<ContractLabel id="c1" label="Token" />);
    await user.click(screen.getByRole('button', { name: 'Rename contract' }));
    await user.clear(screen.getByLabelText('Contract name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/contracts/c1', {
        method: 'PATCH',
        body: { label: '' },
      }),
    );
  });

  it('keeps the editor open and shows the API error', async () => {
    failWith = 'Label too long';
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ContractLabel id="c1" label="Token" onSaved={onSaved} />);
    await user.click(screen.getByRole('button', { name: 'Rename contract' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Label too long');
    expect(screen.getByLabelText('Contract name')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('cancel discards the draft without calling the API', async () => {
    const user = userEvent.setup();
    render(<ContractLabel id="c1" label="Token" />);
    await user.click(screen.getByRole('button', { name: 'Rename contract' }));
    await user.type(screen.getByLabelText('Contract name'), ' no');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiMock).not.toHaveBeenCalled();
    expect(screen.getByText('Token')).toBeInTheDocument();
  });

  it.each([undefined, 'VIEWER'] as const)('hides rename when the role is %s', (r) => {
    role = r;
    render(<ContractLabel id="c1" label={null} />);
    expect(screen.getByText('Unnamed contract')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename contract' })).not.toBeInTheDocument();
  });
});
