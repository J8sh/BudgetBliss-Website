import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Time-based one-time passwords (RFC 6238) for authenticator apps.
 * Uses the settings every common app supports: SHA-1, 6 digits, 30-second steps.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
const SECRET_BYTES = 20;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** A new random secret, base32-encoded for authenticator apps */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

/** The time step (30-second window number) for a given moment */
export function timeStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** The code an authenticator app shows for a secret at a given time step */
export function totpAt(secret: string, step: number, digits: number = TOTP_DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/**
 * Checks a code against the current step and one step either side (to allow for clock drift).
 * Returns the matching time step, so callers can reject a code that was already used,
 * or null if the code is wrong.
 */
export function verifyTotp(
  secret: string,
  code: string,
  nowMs: number = Date.now(),
  window = 1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;

  const current = timeStep(nowMs);
  const given = Buffer.from(code);
  let matched: number | null = null;

  // Check every step in the window (no early exit) so timing doesn't reveal which one matched
  for (let step = current - window; step <= current + window; step++) {
    const expected = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(expected, given) && matched === null) {
      matched = step;
    }
  }

  return matched;
}

/** The otpauth:// link that authenticator apps read from a QR code */
export function buildOtpauthUrl({
  secret,
  account,
  issuer,
}: {
  secret: string;
  account: string;
  issuer: string;
}): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
