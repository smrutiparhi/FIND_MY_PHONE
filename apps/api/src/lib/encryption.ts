import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * Application-level encryption for fields the master spec names "...Encrypted"
 * (Device.imei1Encrypted, imei2Encrypted, serialNumberEncrypted). These values
 * must be recoverable in full - Part 13/14 display the real IMEI when
 * drafting a police complaint or CEIR submission - so this is reversible
 * AES-256-GCM, not one-way hashing. phoneNumberMasked is a different
 * strategy: the full number is never persisted at all, only a masked display
 * form (see maskPhoneNumber below).
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

function getKey(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY is not configured. Generate one with `openssl rand -base64 32` and set it in apps/api/.env before storing encrypted fields.',
    );
  }
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes (got ${key.length}). Generate one with \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** Encrypts a plaintext string, returning a single base64 payload (iv + authTag + ciphertext). */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Reverses encryptField. Throws if the payload was tampered with or the key is wrong (GCM auth tag check). */
export function decryptField(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Reduces a phone number to a display-safe masked form (e.g. "+91 98••••210").
 * The full number is never passed to a repository or persisted - only this
 * masked string is, matching the Device.phoneNumberMasked field name.
 */
export function maskPhoneNumber(fullNumber: string): string {
  const digitsOnly = fullNumber.replace(/[^\d+]/g, '');
  const visibleStart = digitsOnly.startsWith('+') ? 3 : 2;
  const visibleEnd = 4;
  if (digitsOnly.length <= visibleStart + visibleEnd) {
    return '•'.repeat(Math.max(digitsOnly.length - visibleEnd, 0)) + digitsOnly.slice(-visibleEnd);
  }
  const start = digitsOnly.slice(0, visibleStart);
  const end = digitsOnly.slice(-visibleEnd);
  const maskedMiddleLength = digitsOnly.length - visibleStart - visibleEnd;
  return `${start}${'•'.repeat(maskedMiddleLength)}${end}`;
}
