import { describe, it, expect } from "vitest";
import { makeShortLink, resolveShortLink, shortLookupId } from "../src/crypto-flows.ts";
import { DecryptError } from "@hush/envelope";

const URL_ = "https://hush.md/d/AAAAAAAAAAAAAAAAAAAAAA#k=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("short-link crypto", () => {
  it("round-trips the full URL through token-derived key material", async () => {
    const { token, id, blob } = await makeShortLink(URL_);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await shortLookupId(token)).toBe(id); // resolver derives the same lookup id
    expect(await resolveShortLink(token, blob)).toBe(URL_);
  });

  it("the lookup id cannot decrypt the blob (server knowledge is insufficient)", async () => {
    const { id, blob } = await makeShortLink(URL_);
    // treat the 43-char id as if it were a token; its derived key must fail
    await expect(resolveShortLink(id.slice(0, 22), blob)).rejects.toBeInstanceOf(DecryptError);
  });

  it("a different token cannot resolve someone else's blob", async () => {
    const a = await makeShortLink(URL_);
    const b = await makeShortLink(URL_);
    await expect(resolveShortLink(b.token, a.blob)).rejects.toBeInstanceOf(DecryptError);
  });
});
