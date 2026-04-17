import sharp from "sharp";
import heicConvert from "heic-convert";
import { optimizeForStorage, validateImageMagicBytes } from "@/lib/image/optimize";

jest.mock("sharp");
jest.mock("heic-convert");

// Minimal valid magic-byte buffers (not real images, just enough bytes to pass detection)
function makeJpeg() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

function makePng() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function makeWebp() {
  // RIFF at offset 0, WEBP at offset 8 (not checked — we only verify the RIFF header)
  return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
}

/**
 * Build a minimal HEIC-like buffer.
 * Real HEIC files have an ftyp box: [size(4 bytes)][ftyp(4 bytes)][brand(4 bytes)]...
 * The box size can vary — common values are 0x14, 0x18, 0x1c, 0x20, etc.
 */
function makeHeic(boxSize: number) {
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(boxSize, 0); // bytes 0-3: box size (variable)
  buf.write("ftyp", 4, "ascii"); // bytes 4-7: box type (always "ftyp")
  buf.write("heic", 8, "ascii"); // bytes 8-11: major brand
  return buf;
}

// ─── optimizeForStorage ────────────────────────────────────────────────────────

const mockToBuffer = jest.fn();
const mockPipeline = {
  rotate: jest.fn().mockReturnThis(),
  toColorspace: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  withMetadata: jest.fn().mockReturnThis(),
  toBuffer: mockToBuffer,
};

const mockHeicConvert = heicConvert as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (sharp as unknown as jest.Mock).mockReturnValue(mockPipeline);
  mockToBuffer.mockResolvedValue({
    data: Buffer.alloc(100),
    info: { width: 800, height: 600, size: 100 },
  });
  // Default: heic-convert returns a small JPEG-like ArrayBuffer
  mockHeicConvert.mockResolvedValue(new ArrayBuffer(64));
});

/** Build a minimal HEIC ftyp-box buffer (8+ bytes with "ftyp" at offset 4) */
function makeHeicBuffer() {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(0x18, 0);   // box size
  buf.write("ftyp", 4, "ascii"); // box type
  buf.write("heic", 8, "ascii"); // major brand
  return buf;
}

describe("optimizeForStorage", () => {
  it("passes pages:1 and limitInputPixels:false to sharp", async () => {
    const buf = Buffer.alloc(32);
    await optimizeForStorage(buf);
    expect(sharp).toHaveBeenCalledWith(buf, { pages: 1, limitInputPixels: false });
  });

  it("calls toColorspace('srgb') to normalise wide-gamut color spaces", async () => {
    await optimizeForStorage(Buffer.alloc(32));
    expect(mockPipeline.toColorspace).toHaveBeenCalledWith("srgb");
  });

  it("converts to WebP at the requested quality", async () => {
    await optimizeForStorage(Buffer.alloc(32), { quality: 75 });
    expect(mockPipeline.webp).toHaveBeenCalledWith({ quality: 75 });
  });

  it("returns width, height and sizeBytes from sharp info", async () => {
    const result = await optimizeForStorage(Buffer.alloc(32));
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.sizeBytes).toBe(100);
  });

  describe("HEIC pre-decoding", () => {
    it("calls heic-convert for HEIC buffers before sharp", async () => {
      const heicBuf = makeHeicBuffer();
      await optimizeForStorage(heicBuf);
      expect(mockHeicConvert).toHaveBeenCalledWith({
        buffer: Uint8Array.from(heicBuf),
        format: "JPEG",
        quality: 1,
      });
    });

    it("passes the decoded JPEG buffer to sharp, not the original HEIC buffer", async () => {
      const heicBuf = makeHeicBuffer();
      const decodedJpeg = new ArrayBuffer(64);
      mockHeicConvert.mockResolvedValueOnce(decodedJpeg);
      await optimizeForStorage(heicBuf);
      // sharp should receive the converted buffer, not the raw HEIC bytes
      const sharpArg = (sharp as unknown as jest.Mock).mock.calls[0][0] as Buffer;
      expect(sharpArg).toEqual(Buffer.from(decodedJpeg));
      expect(sharpArg).not.toEqual(heicBuf);
    });

    it("skips heic-convert for non-HEIC buffers (JPEG)", async () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      await optimizeForStorage(jpegBuf);
      expect(mockHeicConvert).not.toHaveBeenCalled();
    });

    it("skips heic-convert for non-HEIC buffers (PNG)", async () => {
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await optimizeForStorage(pngBuf);
      expect(mockHeicConvert).not.toHaveBeenCalled();
    });
  });
});

// ─── validateImageMagicBytes ───────────────────────────────────────────────────

describe("validateImageMagicBytes", () => {
  it("accepts JPEG", () => {
    expect(validateImageMagicBytes(makeJpeg())).toBe(true);
  });

  it("accepts PNG", () => {
    expect(validateImageMagicBytes(makePng())).toBe(true);
  });

  it("accepts WebP", () => {
    expect(validateImageMagicBytes(makeWebp())).toBe(true);
  });

  it("accepts HEIC with box size 0x18 (24 bytes)", () => {
    expect(validateImageMagicBytes(makeHeic(0x18))).toBe(true);
  });

  it("accepts HEIC with box size 0x1c (28 bytes)", () => {
    expect(validateImageMagicBytes(makeHeic(0x1c))).toBe(true);
  });

  it("accepts HEIC with box size 0x14 (20 bytes)", () => {
    expect(validateImageMagicBytes(makeHeic(0x14))).toBe(true);
  });

  it("accepts HEIC with box size 0x20 (32 bytes)", () => {
    expect(validateImageMagicBytes(makeHeic(0x20))).toBe(true);
  });

  it("rejects a plain text file", () => {
    expect(validateImageMagicBytes(Buffer.from("not an image"))).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(validateImageMagicBytes(Buffer.alloc(0))).toBe(false);
  });

  it("rejects a buffer that is too short to contain ftyp", () => {
    expect(validateImageMagicBytes(Buffer.alloc(6, 0x00))).toBe(false);
  });

  it("rejects a buffer with ftyp-like bytes at the wrong offset", () => {
    // ftyp at offset 0 instead of 4 — should not match
    const buf = Buffer.from("ftyp heic", "ascii");
    expect(validateImageMagicBytes(buf)).toBe(false);
  });
});
