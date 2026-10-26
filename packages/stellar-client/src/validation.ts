import { StrKey } from '@stellar/stellar-sdk';

export type ContractIdValidation =
  { valid: true; contractId: string } | { valid: false; reason: string };

/**
 * Validates a Soroban contract ID (StrKey "C..." with a valid checksum).
 * Whitespace is trimmed and the result is upper-cased, since StrKeys are case-sensitive base32.
 */
export function validateContractId(input: string): ContractIdValidation {
  const contractId = input.trim().toUpperCase();
  if (contractId.length === 0) return { valid: false, reason: 'Contract ID is required' };
  if (!contractId.startsWith('C')) {
    if (contractId.startsWith('G')) {
      return {
        valid: false,
        reason: 'This is an account address (G...), not a contract ID (C...)',
      };
    }
    return { valid: false, reason: 'Contract IDs start with "C"' };
  }
  if (contractId.length !== 56) {
    return {
      valid: false,
      reason: `Contract IDs are 56 characters long (got ${contractId.length})`,
    };
  }
  if (!StrKey.isValidContract(contractId)) {
    return { valid: false, reason: 'Invalid contract ID checksum' };
  }
  return { valid: true, contractId };
}

export function isValidContractId(input: string): boolean {
  return validateContractId(input).valid;
}
