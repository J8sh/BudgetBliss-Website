import sharp from "sharp";
import heicConvert from "heic-convert";
import { logger } from "@/lib/logger";

/** Valid image MIME types accepted for upload */
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Magic bytes for image format detection */
const MAGIC_BYTES: Array<{ bytes: number[]; offset?: number; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" }, // RIFF....WEBP
  // HEIC/HEIF uses ISO Base Media File Format — the ftyp box type is always at
  // bytes 4-7, regardless of the box size stored in bytes 0-3.
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mime: "image/heic" }, // "ftyp"
];

/**
 * Validates that a buffer's magic bytes match a known image format.
 * This prevents MIME type spoofing (e.g., renaming a .txt to .jpg).
 */
export function validateImageMagicBytes(buffer: Buffer): boolean {
  return MAGIC_BYTES.some(({ bytes, offset = 0 }) =>
    buffer.length >= offset + bytes.length &&
    bytes.every((byte, i) => buffer[offset + i] === byte),
  );
}

/**
 * Returns true if the buffer is a HEIC/HEIF file.
 * HEIC uses the ISOBMFF container — the "ftyp" box type is always at bytes 4–7.
 */
function isHeicBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70    // p
  );
}

/**
 * Pre-decodes a HEIC/HEIF buffer to JPEG using heic-convert.
 *
 * sharp bundles libheif without HEVC codec support (patent licensing), so it
 * cannot read iPhone HEIC files directly. heic-convert ships its own HEVC
 * decoder and produces a standard JPEG buffer that sharp can process normally.
 */
async function decodeHeic(buffer: Buffer): Promise<Buffer> {
  const arrayBuffer = await heicConvert({
    buffer: Uint8Array.from(buffer),
    format: "JPEG",
    quality: 1,
  });
  return Buffer.from(arrayBuffer);
}

export interface OptimizeOptions {
  /** Max width in pixels. Defaults to 1800. */
  maxWidth?: number;
  /** Max height in pixels. Defaults to 2400. */
  maxHeight?: number;
  /** WebP quality 1-100. Defaults to 85. */
  quality?: number;
}

export interface OptimizeResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Optimizes a receipt image for storage:
 * - Converts to WebP
 * - Resizes to max dimensions (never upscales)
 * - Strips EXIF metadata (privacy)
 *
 * sharp options:
 *   pages: 1  — only decode the primary image from multi-image containers
 *               (HEIC burst shots, HDR + depth map pairs, etc.)
 *   limitInputPixels: false  — don't reject large HEIC files from high-res iPhone cameras
 */
export async function optimizeForStorage(
  inputBuffer: Buffer,
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const { maxWidth = 1800, maxHeight = 2400, quality = 85 } = options;

  // sharp's bundled libheif lacks the HEVC codec (patent restrictions).
  // Pre-decode HEIC/HEIF to JPEG with heic-convert before handing off to sharp.
  const sharpInput = isHeicBuffer(inputBuffer)
    ? await decodeHeic(inputBuffer)
    : inputBuffer;

  const pipeline = sharp(sharpInput, { pages: 1, limitInputPixels: false })
    .rotate() // auto-rotate based on EXIF orientation before stripping
    .toColorspace("srgb") // normalise P3/wide-gamut HEIC to sRGB before WebP encode
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true, // never upscale
    })
    .webp({ quality })
    .withMetadata({}); // strips all metadata except orientation

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  logger.debug(
    { originalBytes: inputBuffer.length, optimizedBytes: data.length, width: info.width, height: info.height },
    "Image optimized for storage",
  );

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: data.length,
  };
}

/**
 * Resizes an already-optimized image to a smaller size for sending to Claude API.
 * Smaller = fewer tokens = lower cost.
 */
export async function optimizeForClaude(inputBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(inputBuffer)
    .resize(1000, 1500, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  logger.debug(
    { bytes: data.length, width: info.width, height: info.height },
    "Image resized for Claude API",
  );

  return data;
}
