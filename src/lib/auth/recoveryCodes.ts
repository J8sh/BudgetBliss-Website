import { createHash, randomBytes } from "crypto";
import { base32Encode } from "@/lib/auth/totp";

/**
 * One-time recovery codes for signing in when the authenticator app is unavailable.
 * Each code is 10 base32 characters (50 random bits), shown as "ABCDE-FGHIJ".
 * Only SHA-256 hashes are stored; the codes are random enough that a slow hash isn't needed.
 */

export const RECOVERY_CODE_COUNT = 10;
const CODE_LENGTH = 10;

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(8)).slice(0, CODE_LENGTH);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Strips spaces and dashes and uppercases. Returns null if it can't be a recovery code. */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z2-7]{10}$/.test(cleaned) ? cleaned : null;
}

export function hashRecoveryCode(code: string): string | null {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}
