import { describe, it, expect } from "vitest";
import { sealSecretContent, openSecretContent, secretPlaceholder } from "../src/crypto-flows.ts";
import { SECRET_PLACEHOLDER_RE } from "../src/render.ts";
import { DecryptError } from "@hush/envelope";

describe("secret crypto", () => {
  it("seals and opens secret content with its own key", async () => {
    const { blob, keyB64 } = await sealSecretContent("api-key-123 🤫");
    expect(await openSecretContent(blob, keyB64)).toBe("api-key-123 🤫");
  });

  it("wrong key fails to open", async () => {
    const { blob } = await sealSecretContent("x");
    const other = await sealSecretContent("y");
    await expect(openSecretContent(blob, other.keyB64)).rejects.toBeInstanceOf(DecryptError);
  });

  it("placeholder format matches what the renderer recognizes", async () => {
    const { keyB64 } = await sealSecretContent("x");
    const id = "C".repeat(22);
    const m = SECRET_PLACEHOLDER_RE.exec(secretPlaceholder(id, keyB64));
    expect(m).not.toBeNull();
    expect(m![1]).toBe(id);
    expect(m![2]).toBe(keyB64);
  });
});
