import { concatBytes, utf8 } from "./bytes.ts";
import { encryptBlob, decryptBlob } from "./aead.ts";

export const PBKDF2_ITERATIONS = 600000;
const subtle = globalThis.crypto.subtle;

export async function deriveWrappingKey(linkKey: Uint8Array, password: string, salt: Uint8Array): Promise<Uint8Array> {
  const material = await subtle.importKey(
    "raw", concatBytes(linkKey, utf8(password)) as BufferSource, "PBKDF2", false, ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: salt as BufferSource },
    material, 256,
  );
  return new Uint8Array(bits);
}

export const wrapContentKey = (contentKey: Uint8Array, wrappingKey: Uint8Array) =>
  encryptBlob(wrappingKey, contentKey);

export const unwrapContentKey = (wrapped: Uint8Array, wrappingKey: Uint8Array) =>
  decryptBlob(wrappingKey, wrapped);

export async function hashToken(token: string): Promise<string> {
  const d = new Uint8Array(await subtle.digest("SHA-256", utf8(token) as BufferSource));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
