import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, maskPhoneNumber } from '../../src/lib/encryption';

describe('encryptField / decryptField', () => {
  it('round-trips a value', () => {
    const ciphertext = encryptField('356789101234567');
    expect(ciphertext).not.toContain('356789101234567');
    expect(decryptField(ciphertext)).toBe('356789101234567');
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const first = encryptField('same-value');
    const second = encryptField('same-value');
    expect(first).not.toBe(second);
    expect(decryptField(first)).toBe('same-value');
    expect(decryptField(second)).toBe('same-value');
  });

  it('throws rather than returning tampered plaintext when ciphertext is modified', () => {
    const ciphertext = encryptField('sensitive-value');
    const tampered = ciphertext.slice(0, -4) + (ciphertext.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(() => decryptField(tampered)).toThrow();
  });
});

describe('maskPhoneNumber', () => {
  it('keeps the country code prefix and last 4 digits visible', () => {
    expect(maskPhoneNumber('+919876543210')).toBe('+91••••••3210');
  });

  it('handles a number without a country code prefix', () => {
    expect(maskPhoneNumber('9876543210')).toBe('98••••3210');
  });

  it('degrades gracefully for very short input rather than throwing', () => {
    expect(() => maskPhoneNumber('123')).not.toThrow();
  });
});
