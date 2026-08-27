import { describe, it, expect } from "vitest";
import { newDocKeys, buildFragment, parseFragment, toB64url } from "@hush/envelope";

describe("link", () => {
  it("newDocKeys shapes", () => {
    const k = newDocKeys();
    expect(k.linkKey).toHaveLength(32);
    expect(k.contentKey).toHaveLength(32);
    expect(k.docId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(k.editToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("fragment round-trips with and without edit token", () => {
    const { linkKey, editToken } = newDocKeys();
    const view = parseFragment(buildFragment(linkKey));
    expect(toB64url(view.linkKey)).toBe(toB64url(linkKey));
    expect(view.editToken).toBeUndefined();
    const edit = parseFragment("#" + buildFragment(linkKey, editToken));
    expect(edit.editToken).toBe(editToken);
  });
  it("rejects fragment without k", () => {
    expect(() => parseFragment("#e=zzz")).toThrow("invalid link");
  });
});
