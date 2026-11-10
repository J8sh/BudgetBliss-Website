import {
  checkFailureThrottle,
  clearFailures,
  recordFailure,
  resetFailureThrottles,
} from "@/lib/rateLimit";

afterEach(() => {
  resetFailureThrottles();
  jest.useRealTimers();
});

describe("failure throttle", () => {
  it("blocks a key once it reaches the limit", () => {
    for (let i = 0; i < 2; i++) recordFailure("k", 60_000);
    expect(checkFailureThrottle("k", 3).blocked).toBe(false);
    recordFailure("k", 60_000);
    const result = checkFailureThrottle("k", 3);
    expect(result.blocked).toBe(true);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps keys separate", () => {
    for (let i = 0; i < 3; i++) recordFailure("a", 60_000);
    expect(checkFailureThrottle("a", 3).blocked).toBe(true);
    expect(checkFailureThrottle("b", 3).blocked).toBe(false);
  });

  it("clears on success", () => {
    for (let i = 0; i < 3; i++) recordFailure("k", 60_000);
    clearFailures("k");
    expect(checkFailureThrottle("k", 3).blocked).toBe(false);
  });

  it("unblocks when the window ends", () => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    for (let i = 0; i < 3; i++) recordFailure("k", 60_000);
    expect(checkFailureThrottle("k", 3).blocked).toBe(true);
    jest.setSystemTime(1_000_000 + 60_001);
    expect(checkFailureThrottle("k", 3).blocked).toBe(false);
  });
});
