import { toB64url, fromB64url } from "@hush/envelope";

export interface CreateInput {
  snapshot: Uint8Array; wrappedKey: Uint8Array; kdfSalt: Uint8Array;
  editTokenHash: string; expiresIn?: number; maxViews?: number;
}
export interface FetchedDoc {
  snapshot: Uint8Array; wrappedKey: Uint8Array; kdfSalt: Uint8Array; expiresAt: number;
}

export function makeApi(f: typeof fetch = fetch) {
  return {
    async createDoc(input: CreateInput): Promise<string> {
      const res = await f("/api/docs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          snapshot: toB64url(input.snapshot), wrappedKey: toB64url(input.wrappedKey),
          kdfSalt: toB64url(input.kdfSalt), editTokenHash: input.editTokenHash,
          ...(input.expiresIn !== undefined ? { expiresIn: input.expiresIn } : {}),
          ...(input.maxViews !== undefined ? { maxViews: input.maxViews } : {}),
        }),
      });
      if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
      return (await res.json()).id as string;
    },
    async fetchDoc(id: string, editToken?: string): Promise<FetchedDoc | null> {
      const res = await f(`/api/docs/${id}`, {
        headers: editToken ? { "x-edit-token": editToken } : {},
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const j = await res.json();
      return {
        snapshot: fromB64url(j.snapshot), wrappedKey: fromB64url(j.wrappedKey),
        kdfSalt: fromB64url(j.kdfSalt), expiresAt: j.expiresAt as number,
      };
    },
    async putSnapshot(id: string, snapshot: Uint8Array, editToken: string): Promise<void> {
      const res = await f(`/api/docs/${id}/snapshot`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-edit-token": editToken },
        body: JSON.stringify({ snapshot: toB64url(snapshot) }),
      });
      if (res.status !== 204) throw new Error(`save failed: ${res.status}`);
    },
  };
}

export const api = makeApi();
