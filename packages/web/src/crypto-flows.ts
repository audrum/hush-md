import {
  newDocKeys, buildFragment, parseFragment, deriveWrappingKey,
  wrapContentKey, unwrapContentKey, encryptBlob, decryptBlob,
  hashToken, randomBytes, utf8, fromUtf8,
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
