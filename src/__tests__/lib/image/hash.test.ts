import { hashBuffer } from "@/lib/image/hash";

describe("hashBuffer", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const buffer = Buffer.from("test content");
    const hash = hashBuffer(buffer);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("produces the same hash for the same buffer", () => {
    const buffer = Buffer.from("receipt image data");
    expect(hashBuffer(buffer)).toBe(hashBuffer(buffer));
  });

  it("produces different hashes for different buffers", () => {
    const a = Buffer.from("receipt A");
    const b = Buffer.from("receipt B");
    expect(hashBuffer(a)).not.toBe(hashBuffer(b));
  });

  it("is sensitive to content changes", () => {
    const original = Buffer.from([0x01, 0x02, 0x03]);
    const modified = Buffer.from([0x01, 0x02, 0x04]); // one byte different
    expect(hashBuffer(original)).not.toBe(hashBuffer(modified));
  });

  it("handles empty buffer", () => {
    const hash = hashBuffer(Buffer.alloc(0));
    expect(hash).toHaveLength(64);
  });

  it("handles large buffer", () => {
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024, 0xff); // 10 MB
    const hash = hashBuffer(bigBuffer);
    expect(hash).toHaveLength(64);
  });
});
