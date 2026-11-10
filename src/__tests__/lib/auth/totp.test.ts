import {
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  generateTotpSecret,
  timeStep,
  totpAt,
  verifyTotp,
} from "@/lib/auth/totp";

// RFC 6238 appendix B test secret ("12345678901234567890" as ASCII)
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32", () => {
  it("encodes the RFC test secret", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("round-trips random bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 17]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("accepts lowercase and spaces", () => {
    expect(base32Decode("gezd gnbv")).toEqual(base32Decode("GEZDGNBV"));
  });

  it("rejects invalid characters", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("totpAt", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches RFC 6238 SHA-1 vectors at t=%i", (seconds, expected) => {
    const step = timeStep(seconds * 1000);
    expect(totpAt(RFC_SECRET, step, 8)).toBe(expected);
    expect(totpAt(RFC_SECRET, step)).toBe(expected.slice(-6));
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;
  const secret = generateTotpSecret();
  const current = timeStep(now);

  it("accepts the current code and returns its step", () => {
    expect(verifyTotp(secret, totpAt(secret, current), now)).toBe(current);
  });

  it("accepts one step of clock drift either way", () => {
    expect(verifyTotp(secret, totpAt(secret, current - 1), now)).toBe(current - 1);
    expect(verifyTotp(secret, totpAt(secret, current + 1), now)).toBe(current + 1);
  });

  it("rejects codes outside the window", () => {
    const old = totpAt(secret, current - 3);
    // Guard against the rare chance the old code collides with one in the window
    const inWindow = [current - 1, current, current + 1].map((s) => totpAt(secret, s));
    if (!inWindow.includes(old)) {
      expect(verifyTotp(secret, old, now)).toBeNull();
    }
  });

  it("rejects malformed input", () => {
    expect(verifyTotp(secret, "12345", now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", now)).toBeNull();
    expect(verifyTotp(secret, "1234567", now)).toBeNull();
  });
});

describe("generateTotpSecret", () => {
  it("returns a 32-character base32 secret (160 bits)", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(secret);
  });
});

describe("buildOtpauthUrl", () => {
  it("builds a URL authenticator apps understand", () => {
    const url = new URL(buildOtpauthUrl({ secret: "ABC", account: "me@example.com", issuer: "BudgetBliss" }));
    expect(url.protocol).toBe("otpauth:");
    expect(decodeURIComponent(url.pathname)).toContain("BudgetBliss:me@example.com");
    expect(url.searchParams.get("secret")).toBe("ABC");
    expect(url.searchParams.get("issuer")).toBe("BudgetBliss");
    expect(url.searchParams.get("digits")).toBe("6");
    expect(url.searchParams.get("period")).toBe("30");
  });
});
