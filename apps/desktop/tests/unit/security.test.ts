import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  hashPin,
  verifyPin,
} from '@bazaar/shared-utils';

describe('Security & PIN Hashing (@bazaar/shared-utils)', () => {
  it('computes deterministic SHA-256 hexadecimal hash', async () => {
    const hash1 = await sha256Hex('1234');
    const hash2 = await sha256Hex('1234');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256 bits = 64 hex characters
  });

  it('generates different hashes for different inputs', async () => {
    const hash1 = await sha256Hex('1234');
    const hash2 = await sha256Hex('4321');
    expect(hash1).not.toBe(hash2);
  });

  it('hashes 4-digit PIN and verifies matching PIN', async () => {
    const hashed = await hashPin('5566');
    expect(hashed).toBeDefined();

    const isMatch = await verifyPin('5566', hashed);
    expect(isMatch).toBe(true);
  });

  it('rejects incorrect PIN during verification', async () => {
    const hashed = await hashPin('9988');
    const isMatch = await verifyPin('1122', hashed);
    expect(isMatch).toBe(false);
  });

  it('handles empty or null inputs gracefully without crashing', () => {
    const hashed = hashPin('');
    expect(verifyPin('', hashed)).toBe(false);
    expect(verifyPin('1234', '')).toBe(false);
    expect(verifyPin('', undefined)).toBe(false);
  });
});
