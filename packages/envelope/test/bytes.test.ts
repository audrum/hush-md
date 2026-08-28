import { describe, it, expect } from "vitest";
import { randomBytes, toB64url, fromB64url, utf8, fromUtf8, concatBytes } from "@hush/envelope";

describe("bytes", () => {
  it("b64url round-trips arbitrary bytes without padding chars", () => {
    const b = randomBytes(33);
    const s = toB64url(b);
    expect(s).not.toMatch(/[=+/]/);
    expect(fromB64url(s)).toEqual(b);
  });
  it("utf8 round-trips", () => {
    expect(fromUtf8(utf8("héllo — ✓"))).toBe("héllo — ✓");
  });
  it("concat joins in order", () => {
    expect(concatBytes(new Uint8Array([1]), new Uint8Array([2, 3]))).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("randomBytes returns requested length and varies", () => {
    expect(randomBytes(32)).toHaveLength(32);
    expect(toB64url(randomBytes(16))).not.toBe(toB64url(randomBytes(16)));
  });
});
