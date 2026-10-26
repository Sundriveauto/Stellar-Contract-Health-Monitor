import { xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  buildStorageKeyScVal,
  contractDataLedgerKey,
  contractInstanceLedgerKey,
  ledgerKeyToXdr,
} from '../src';

const ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

describe('ledger keys', () => {
  it('builds the instance key matching what RPC returns', () => {
    expect(ledgerKeyToXdr(contractInstanceLedgerKey(ID))).toBe(
      'AAAABgAAAAHXkotywnA8z+r365/0701QSlWouXn8m0UOoshCtNHOYQAAABQAAAAB',
    );
  });

  it('builds symbol and enum-variant storage keys', () => {
    expect(buildStorageKeyScVal('symbol', 'Admin').switch().name).toBe('scvSymbol');
    const variant = buildStorageKeyScVal('enum_variant', 'Admin');
    expect(variant.switch().name).toBe('scvVec');
    expect(variant.vec()?.[0]?.sym().toString()).toBe('Admin');
  });

  it('accepts raw XDR keys', () => {
    const b64 = xdr.ScVal.scvU32(7).toXDR('base64');
    expect(buildStorageKeyScVal('xdr', b64).u32()).toBe(7);
  });

  it('encodes durability', () => {
    const key = contractDataLedgerKey(ID, buildStorageKeyScVal('symbol', 'x'), 'TEMPORARY');
    expect(key.contractData().durability().name).toBe('temporary');
  });
});
