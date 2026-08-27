import { describe, it, expect } from "vitest";
import {
  deriveWrappingKey, wrapContentKey, unwrapContentKey, hashToken,
  DecryptError, randomBytes,
} from "@hush/envelope";

describe("keys", () => {
  it("wrap/unwrap round-trips with empty password", async () => {
    const linkKey = randomBytes(32), salt = randomBytes(16), ck = randomBytes(32);
    const wk = await deriveWrappingKey(linkKey, "", salt);
    expect(await unwrapContentKey(await wrapContentKey(ck, wk), wk)).toEqual(ck);
  });
  it("wrong password fails to unwrap", async () => {
    const linkKey = randomBytes(32), salt = randomBytes(16), ck = randomBytes(32);
    const wrapped = await wrapContentKey(ck, await deriveWrappingKey(linkKey, "right", salt));
    const bad = await deriveWrappingKey(linkKey, "wrong", salt);
    await expect(unwrapContentKey(wrapped, bad)).rejects.toBeInstanceOf(DecryptError);
  });
  it("derivation is deterministic and salt-sensitive", async () => {
    const lk = randomBytes(32), salt = randomBytes(16);
    expect(await deriveWrappingKey(lk, "p", salt)).toEqual(await deriveWrappingKey(lk, "p", salt));
    expect(await deriveWrappingKey(lk, "p", randomBytes(16))).not.toEqual(await deriveWrappingKey(lk, "p", salt));
  }, 30000);
  it("hashToken is stable lowercase hex", async () => {
    const h = await hashToken("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
