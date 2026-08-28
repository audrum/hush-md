import { describe, it, expect } from "vitest";
import { encryptBlob, decryptBlob, DecryptError, randomBytes, utf8, fromUtf8 } from "@hush/envelope";

describe("aead", () => {
  it("round-trips", async () => {
    const key = randomBytes(32);
    const blob = await encryptBlob(key, utf8("# hello"));
    expect(fromUtf8(await decryptBlob(key, blob))).toBe("# hello");
  });
  it("produces different ciphertext each call (fresh IV)", async () => {
    const key = randomBytes(32);
    const a = await encryptBlob(key, utf8("x"));
    const b = await encryptBlob(key, utf8("x"));
    expect(a).not.toEqual(b);
  });
  it("throws DecryptError on wrong key", async () => {
    const blob = await encryptBlob(randomBytes(32), utf8("x"));
    await expect(decryptBlob(randomBytes(32), blob)).rejects.toBeInstanceOf(DecryptError);
  });
  it("throws DecryptError on tampered ciphertext", async () => {
    const key = randomBytes(32);
    const blob = await encryptBlob(key, utf8("x"));
    blob[blob.length - 1] ^= 0xff;
    await expect(decryptBlob(key, blob)).rejects.toBeInstanceOf(DecryptError);
  });
});
