import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { validateContractId } from '../src';

const XLM_SAC_TESTNET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

describe('validateContractId', () => {
  it('accepts a valid contract id', () => {
    expect(validateContractId(XLM_SAC_TESTNET)).toEqual({
      valid: true,
      contractId: XLM_SAC_TESTNET,
    });
  });

  it('trims whitespace and upper-cases input', () => {
    expect(validateContractId(`  ${XLM_SAC_TESTNET.toLowerCase()} \n`)).toEqual({
      valid: true,
      contractId: XLM_SAC_TESTNET,
    });
  });

  it('accepts any correctly encoded contract id', () => {
    const id = StrKey.encodeContract(Buffer.alloc(32, 7));
    expect(validateContractId(id).valid).toBe(true);
  });

  it('rejects account addresses with a helpful message', () => {
    const result = validateContractId(Keypair.random().publicKey());
    expect(result).toMatchObject({ valid: false });
    expect(!result.valid && result.reason).toMatch(/account address/);
  });

  it('rejects empty input', () => {
    expect(validateContractId('   ')).toEqual({ valid: false, reason: 'Contract ID is required' });
  });

  it('rejects wrong length', () => {
    const r = validateContractId('CABC');
    expect(!r.valid && r.reason).toMatch(/56 characters/);
  });

  it('rejects a bad checksum', () => {
    const tampered = XLM_SAC_TESTNET.slice(0, -1) + (XLM_SAC_TESTNET.endsWith('C') ? 'D' : 'C');
    const r = validateContractId(tampered);
    expect(!r.valid && r.reason).toMatch(/checksum/);
  });
});
