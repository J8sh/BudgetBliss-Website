import { createHash } from "crypto";

/**
 * Compute a SHA-256 hash of a buffer.
 * The hash is computed on the ORIGINAL raw buffer (before any Sharp modification).
 * This ensures the same physical image always produces the same hash regardless
 * of when or how it was processed.
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
