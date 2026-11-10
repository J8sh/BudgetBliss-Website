import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";
import { env } from "@/lib/config";

/**
 * Encrypts small secrets (the TOTP seed) before they are stored in MongoDB, so a copy of the
 * database alone is not enough to generate login codes.
 *
 * The key is derived from NEXTAUTH_SECRET. Changing NEXTAUTH_SECRET makes stored 2FA secrets
 * unreadable, so turn two-factor off (or clear it in the DB) before rotating that secret.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function deriveKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.nextauthSecret, "budgetbliss", "totp-secret-v1", 32));
}

export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unrecognized sealed secret format");
  }

  const decipher = createDecipheriv(ALGORITHM, deriveKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
