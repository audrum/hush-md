export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function toB64url(b: Uint8Array): string {
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
