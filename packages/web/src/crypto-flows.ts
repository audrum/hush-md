import {
  newDocKeys, buildFragment, parseFragment, deriveWrappingKey,
  wrapContentKey, unwrapContentKey, encryptBlob, decryptBlob,
  hashToken, randomBytes, utf8, fromUtf8, toB64url, fromB64url,
} from "@hush/envelope";

export interface SealedPayload {
  snapshot: Uint8Array; wrappedKey: Uint8Array; kdfSalt: Uint8Array; editTokenHash: string;
}

export async function sealDoc(text: string, password: string):
  Promise<{ payload: SealedPayload; fragment: string; viewFragment: string }> {
  const { linkKey, contentKey, editToken } = newDocKeys();
  const kdfSalt = randomBytes(16);
  const wrappingKey = await deriveWrappingKey(linkKey, password, kdfSalt);
  return {
    payload: {
      snapshot: await encryptBlob(contentKey, utf8(text)),
      wrappedKey: await wrapContentKey(contentKey, wrappingKey),
      kdfSalt,
      editTokenHash: await hashToken(editToken),
    },
    fragment: buildFragment(linkKey, editToken),
    viewFragment: buildFragment(linkKey),
  };
}

export async function openDoc(
  doc: { snapshot: Uint8Array; wrappedKey: Uint8Array; kdfSalt: Uint8Array },
  fragment: string,
  password: string,
): Promise<{ text: string; contentKey: Uint8Array; editToken?: string }> {
  const { linkKey, editToken } = parseFragment(fragment);
  const wrappingKey = await deriveWrappingKey(linkKey, password, doc.kdfSalt);
  const contentKey = await unwrapContentKey(doc.wrappedKey, wrappingKey);
  const text = fromUtf8(await decryptBlob(contentKey, doc.snapshot));
  return { text, contentKey, editToken };
}

export const sealSnapshot = async (text: string, contentKey: Uint8Array): Promise<Uint8Array> =>
  encryptBlob(contentKey, utf8(text));

// ---- burn-once secrets: each gets its own fresh key, carried in the doc text
// (safe: the doc text is itself E2E encrypted) ----

export async function sealSecretContent(text: string): Promise<{ blob: Uint8Array; keyB64: string }> {
  const key = randomBytes(32);
  return { blob: await encryptBlob(key, utf8(text)), keyB64: toB64url(key) };
}

export async function openSecretContent(blob: Uint8Array, keyB64: string): Promise<string> {
  return fromUtf8(await decryptBlob(fromB64url(keyB64), blob));
}

export const secretPlaceholder = (id: string, keyB64: string): string => `{{secret:${id}:${keyB64}}}`;

// ---- E2E-preserving short links: the token (URL fragment) derives both the
// server-side lookup id and the key that encrypts the full URL. The server
// stores hash(token) -> ciphertext and can recover neither token nor URL. ----

import { sha256Bytes } from "@hush/envelope";

export async function shortLookupId(token: string): Promise<string> {
  return toB64url(await sha256Bytes(utf8(`hush-short-id:${token}`)));
}

export async function makeShortLink(fullUrl: string): Promise<{ token: string; id: string; blob: Uint8Array }> {
  const token = toB64url(randomBytes(16)); // 128 bits in 22 chars
  const key = await sha256Bytes(utf8(`hush-short-key:${token}`));
  return { token, id: await shortLookupId(token), blob: await encryptBlob(key, utf8(fullUrl)) };
}

export async function resolveShortLink(token: string, blob: Uint8Array): Promise<string> {
  const key = await sha256Bytes(utf8(`hush-short-key:${token}`));
  return fromUtf8(await decryptBlob(key, blob));
}
