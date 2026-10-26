import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { StrKey } from '@stellar/stellar-sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_CONTRACTS_PER_REQUEST, StellarRpcClient } from '../src';

let server: Server;
let url: string;
const requests: { method: string; params: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const msg = JSON.parse(body);
      requests.push(msg);
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            events: [],
            cursor: '0000000000000001000-0000000000',
            latestLedger: 1000,
            oldestLedger: 500,
          },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => StrKey.encodeContract(Buffer.alloc(32, i + 1)));

describe('getEvents', () => {
  it('splits contract IDs into filters of at most five', async () => {
    const client = new StellarRpcClient({ rpcUrl: url, retries: 0 });
    const page = await client.getEvents({ contractIds: ids(12), cursor: 'abc', limit: 50 });
    expect(page).toMatchObject({ cursor: '0000000000000001000-0000000000', latestLedger: 1000 });
    const params = requests.at(-1)!.params as {
      filters: { contractIds: string[] }[];
      pagination: { cursor: string; limit: number };
    };
    expect(params.filters.map((f) => f.contractIds.length)).toEqual([5, 5, 2]);
    expect(params.filters.flatMap((f) => f.contractIds)).toEqual(ids(12));
    expect(params.pagination).toMatchObject({ cursor: 'abc', limit: 50 });
  });

  it('rejects empty and oversized requests without calling the RPC', async () => {
    const client = new StellarRpcClient({ rpcUrl: url, retries: 0 });
    const before = requests.length;
    await expect(client.getEvents({ contractIds: [], startLedger: 1 })).rejects.toThrow(/1-25/);
    await expect(
      client.getEvents({ contractIds: ids(MAX_CONTRACTS_PER_REQUEST + 1), startLedger: 1 }),
    ).rejects.toThrow(/1-25/);
    expect(requests.length).toBe(before);
  });
});
