import { localDateString, viewerNow } from "@/lib/utils/dates";

describe("localDateString", () => {
  it("formats the local calendar date", () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("viewerNow", () => {
  // 6pm in the central US is already the next day in UTC
  const server = new Date("2026-11-11T00:07:00Z");

  it("uses the viewer's date when the server's UTC date has moved on", () => {
    expect(viewerNow("2026-11-10", server).toISOString()).toBe("2026-11-10T12:00:00.000Z");
  });

  it("accepts a viewer a day ahead (east of UTC in the morning)", () => {
    expect(viewerNow("2026-11-12", server).toISOString()).toBe("2026-11-12T12:00:00.000Z");
  });

  it("ignores a missing, malformed or far-off date", () => {
    expect(viewerNow(undefined, server)).toBe(server);
    expect(viewerNow("11/10/2026", server)).toBe(server);
    expect(viewerNow("2026-11-08", server)).toBe(server);
    expect(viewerNow("2027-11-10", server)).toBe(server);
  });
});
