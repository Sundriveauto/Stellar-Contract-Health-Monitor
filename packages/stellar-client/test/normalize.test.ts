import { Contract, nativeToScVal, type rpc } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { normalizeEvent } from '../src';

const ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

function rawEvent(overrides: Partial<rpc.Api.EventResponse> = {}): rpc.Api.EventResponse {
  return {
    id: '0023178615646584832-0000000001',
    type: 'contract',
    ledger: 5396692,
    ledgerClosedAt: '2026-10-26T09:30:47Z',
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: 'ab'.repeat(32),
    contractId: new Contract(ID),
    topic: [
      nativeToScVal('transfer', { type: 'symbol' }),
      nativeToScVal('native', { type: 'string' }),
    ],
    value: nativeToScVal(100n, { type: 'i128' }),
    ...overrides,
  };
}

describe('normalizeEvent', () => {
  it('decodes topics, value and metadata', () => {
    const e = normalizeEvent(rawEvent());
    expect(e).toMatchObject({
      id: '0023178615646584832-0000000001',
      contractId: ID,
      topics: ['transfer', 'native'],
      value: '100',
      inSuccessfulContractCall: true,
    });
    expect(e.ledgerClosedAt.toISOString()).toBe('2026-10-26T09:30:47.000Z');
    expect(e.topicsXdr).toHaveLength(2);
  });

  it('treats a missing inSuccessfulContractCall (protocol 23+ RPC) as successful', () => {
    const raw = rawEvent();
    delete (raw as Partial<rpc.Api.EventResponse>).inSuccessfulContractCall;
    expect(normalizeEvent(raw).inSuccessfulContractCall).toBe(true);
  });

  it('keeps an explicit false', () => {
    expect(
      normalizeEvent(rawEvent({ inSuccessfulContractCall: false })).inSuccessfulContractCall,
    ).toBe(false);
  });
});
