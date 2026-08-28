import { describe, it, expect } from "vitest";
import { sealDoc, openDoc, sealSnapshot } from "../src/crypto-flows.ts";
import { DecryptError } from "@hush/envelope";

describe("crypto flows", () => {
  it("seal → open round-trips text and recovers edit token from edit fragment", async () => {
    const { payload, fragment, viewFragment } = await sealDoc("# secret note", "");
    const opened = await openDoc(payload, fragment, "");
    expect(opened.text).toBe("# secret note");
    expect(opened.editToken).toBeDefined();
    const viewer = await openDoc(payload, viewFragment, "");
    expect(viewer.editToken).toBeUndefined();
  });
  it("password path: right password opens, wrong throws DecryptError", async () => {
    const { payload, fragment } = await sealDoc("x", "pw123");
    await expect(openDoc(payload, fragment, "wrong")).rejects.toBeInstanceOf(DecryptError);
    expect((await openDoc(payload, fragment, "pw123")).text).toBe("x");
  });
  it("sealSnapshot output opens with the same content key", async () => {
    const { payload, fragment } = await sealDoc("v1", "");
    const { contentKey } = await openDoc(payload, fragment, "");
    const snap2 = await sealSnapshot("v2", contentKey);
    const reopened = await openDoc({ ...payload, snapshot: snap2 }, fragment, "");
    expect(reopened.text).toBe("v2");
  }, 30000);
});
