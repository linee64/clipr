import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientIp, rateLimit } from "@/lib/apiRateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit then blocks within the window", () => {
    expect(rateLimit("k1", 2, 1000)).toBe(true);
    expect(rateLimit("k1", 2, 1000)).toBe(true);
    expect(rateLimit("k1", 2, 1000)).toBe(false);
  });

  it("allows again once the window has passed", () => {
    expect(rateLimit("k2", 1, 1000)).toBe(true);
    expect(rateLimit("k2", 1, 1000)).toBe(false);
    vi.setSystemTime(1001);
    expect(rateLimit("k2", 1, 1000)).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 1000)).toBe(true);
    expect(rateLimit("b", 1, 1000)).toBe(true);
    expect(rateLimit("a", 1, 1000)).toBe(false);
  });
});

describe("clientIp", () => {
  const req = (h: Record<string, string>) =>
    ({ headers: { get: (k: string) => h[k.toLowerCase()] ?? null } }) as unknown as Request;

  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' with no proxy headers", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
