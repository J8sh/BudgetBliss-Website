import { openSecret, sealSecret } from "@/lib/auth/secretBox";

const ORIGINAL_SECRET = process.env["NEXTAUTH_SECRET"];

beforeEach(() => {
  process.env["NEXTAUTH_SECRET"] = "test-secret-for-secret-box-0123456789";
});

afterAll(() => {
  process.env["NEXTAUTH_SECRET"] = ORIGINAL_SECRET;
});

describe("secretBox", () => {
  it("round-trips a secret", () => {
    const sealed = sealSecret("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(openSecret(sealed)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("uses a fresh IV each time", () => {
    expect(sealSecret("same")).not.toBe(sealSecret("same"));
  });

  it("rejects tampered ciphertext", () => {
    const [version, iv, tag, ciphertext] = sealSecret("JBSWY3DPEHPK3PXP").split(".");
    const flipped = Buffer.from(ciphertext!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => openSecret([version, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("can't be opened with a different NEXTAUTH_SECRET", () => {
    const sealed = sealSecret("JBSWY3DPEHPK3PXP");
    process.env["NEXTAUTH_SECRET"] = "a-completely-different-secret-value-xyz";
    expect(() => openSecret(sealed)).toThrow();
  });

  it("rejects unknown formats", () => {
    expect(() => openSecret("plain-text")).toThrow("Unrecognized sealed secret format");
  });
});
