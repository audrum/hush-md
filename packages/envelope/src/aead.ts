import { concatBytes, randomBytes } from "./bytes.ts";

export class DecryptError extends Error {
  constructor() { super("cannot decrypt: wrong key/password or corrupted data"); }
}

const subtle = globalThis.crypto.subtle;

async function importKey(key32: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey("raw", key32 as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptBlob(key32: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = randomBytes(12);
  const key = await importKey(key32);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext as BufferSource));
  return concatBytes(iv, ct);
}

export async function decryptBlob(key32: Uint8Array, blob: Uint8Array): Promise<Uint8Array> {
  try {
    const key = await importKey(key32);
    const pt = await subtle.decrypt(
      { name: "AES-GCM", iv: blob.slice(0, 12) as BufferSource },
      key,
      blob.slice(12) as BufferSource,
    );
    return new Uint8Array(pt);
  } catch {
    throw new DecryptError();
  }
}
