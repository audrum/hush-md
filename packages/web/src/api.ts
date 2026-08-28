import { toB64url, fromB64url } from "@hush/envelope";

export interface CreateInput {
  snapshot: Uint8Array; wrappedKey: Uint8Array; kdfSalt: Uint8Array;
  editTokenHash: string; expiresIn?: number; maxViews?: number; secretIds?: string[];
}

export type FetchedSecret =
  | { state: "live"; blob: Uint8Array }
  | { state: "burned"; burnedAt: number }
  | { state: "gone" };
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
          ...(input.secretIds !== undefined && input.secretIds.length > 0 ? { secretIds: input.secretIds } : {}),
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
    async createSecret(blob: Uint8Array, opts: { docId?: string; editToken?: string } = {}): Promise<string> {
      const res = await f("/api/secrets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.editToken ? { "x-edit-token": opts.editToken } : {}),
        },
        body: JSON.stringify({
          blob: toB64url(blob),
          ...(opts.docId ? { docId: opts.docId } : {}),
        }),
      });
      if (res.status !== 201) throw new Error(`secret create failed: ${res.status}`);
      return (await res.json()).id as string;
    },
    async fetchSecret(id: string): Promise<FetchedSecret> {
      const res = await f(`/api/secrets/${id}`);
      if (res.status === 404) return { state: "gone" };
      if (res.status === 410) return { state: "burned", burnedAt: (await res.json()).burnedAt as number };
      if (!res.ok) throw new Error(`secret fetch failed: ${res.status}`);
      return { state: "live", blob: fromB64url((await res.json()).blob) };
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
