import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "@/lib/auth/recoveryCodes";

describe("recovery codes", () => {
  it("generates unique codes shaped ABCDE-FGHIJ", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    }
  });

  it("normalizes case, spaces and dashes", () => {
    expect(normalizeRecoveryCode(" abcde-fghij ")).toBe("ABCDEFGHIJ");
    expect(normalizeRecoveryCode("ABCDE FGHIJ")).toBe("ABCDEFGHIJ");
  });

  it("rejects anything that can't be a recovery code", () => {
    expect(normalizeRecoveryCode("123456")).toBeNull();
    expect(normalizeRecoveryCode("ABCDE-FGHI1")).toBeNull();
    expect(hashRecoveryCode("short")).toBeNull();
  });

  it("hashes equivalent spellings the same way", () => {
    const hash = hashRecoveryCode("ABCDE-FGHIJ");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRecoveryCode("abcdefghij")).toBe(hash);
  });
});
