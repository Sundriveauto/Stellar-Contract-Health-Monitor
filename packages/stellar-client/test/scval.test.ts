import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { decodeScVal, decodeScValXdr, toJsonSafe } from '../src';

describe('decodeScVal', () => {
  it('renders symbols as plain strings', () => {
    const v = decodeScVal(nativeToScVal('transfer', { type: 'symbol' }));
    expect(v.display).toBe('transfer');
    expect(v.json).toBe('transfer');
  });

  it('renders i128 as a decimal string', () => {
    const v = decodeScVal(
      nativeToScVal(170141183460469231731687303715884105727n, { type: 'i128' }),
    );
    expect(v.display).toBe('170141183460469231731687303715884105727');
    expect(v.json).toBe('170141183460469231731687303715884105727');
  });

  it('renders addresses as StrKeys', () => {
    const id = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    const v = decodeScVal(new Address(id).toScVal());
    expect(v.display).toBe(id);
  });

  it('renders bytes as hex', () => {
    const v = decodeScVal(xdr.ScVal.scvBytes(Buffer.from([0xde, 0xad, 0xbe, 0xef])));
    expect(v.display).toBe('deadbeef');
  });

  it('renders void as "void"', () => {
    expect(decodeScVal(xdr.ScVal.scvVoid()).display).toBe('void');
  });

  it('renders composite values as JSON and round-trips XDR', () => {
    const scv = nativeToScVal({ amount: 5n, to: 'abc' });
    const v = decodeScVal(scv);
    expect(JSON.parse(v.display)).toEqual({ amount: '5', to: 'abc' });
    expect(decodeScValXdr(v.xdr).display).toBe(v.display);
  });
});

describe('toJsonSafe', () => {
  it('converts nested bigints and Maps', () => {
    const m = new Map<unknown, unknown>([['a', 1n]]);
    expect(toJsonSafe({ list: [1n, 'x'], m })).toEqual({ list: ['1', 'x'], m: { a: '1' } });
  });
});
