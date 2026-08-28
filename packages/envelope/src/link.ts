import { randomBytes, toB64url, fromB64url } from "./bytes.ts";

export function newDocKeys() {
  return {
    docId: toB64url(randomBytes(16)),
    linkKey: randomBytes(32),
    contentKey: randomBytes(32),
    editToken: toB64url(randomBytes(32)),
  };
}

export function buildFragment(linkKey: Uint8Array, editToken?: string): string {
  const base = `k=${toB64url(linkKey)}`;
  return editToken ? `${base}&e=${editToken}` : base;
}

export function parseFragment(fragment: string): { linkKey: Uint8Array; editToken?: string } {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const k = params.get("k");
  if (!k) throw new Error("invalid link");
  let linkKey: Uint8Array;
  try {
    linkKey = fromB64url(k);
  } catch {
    throw new Error("invalid link");
  }
  if (linkKey.length !== 32) throw new Error("invalid link");
  return { linkKey, editToken: params.get("e") || undefined };
}
