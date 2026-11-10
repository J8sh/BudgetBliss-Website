import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from("webp-bytes")),
}));

import { auth } from "@/lib/auth/auth";
import { GET } from "@/app/uploads/[filename]/route";

function get(filename: string) {
  return GET(new NextRequest(`http://localhost/uploads/${filename}`), {
    params: Promise.resolve({ filename }),
  });
}

describe("GET /uploads/[filename]", () => {
  it("returns 401 without a session", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await get("123-abcdef12.webp");
    expect(res.status).toBe(401);
  });

  it("serves the image privately when signed in", async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { email: "admin@test.com" } });
    const res = await get("123-abcdef12.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toContain("private");
  });
});
