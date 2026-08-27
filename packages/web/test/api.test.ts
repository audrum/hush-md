import { describe, it, expect, vi } from "vitest";
import { makeApi } from "../src/api.ts";
import { toB64url, randomBytes } from "@hush/envelope";

describe("web api client", () => {
  it("createDoc posts b64url body and returns id", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "abc" }), { status: 201 }));
    const api = makeApi(fetchMock);
    const id = await api.createDoc({
      snapshot: randomBytes(8), wrappedKey: randomBytes(8), kdfSalt: randomBytes(16),
      editTokenHash: "ab".repeat(32), expiresIn: 3600,
    });
    expect(id).toBe("abc");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/docs");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.snapshot).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.expiresIn).toBe(3600);
  });
  it("fetchDoc returns null on 404 and decodes b64url on 200", async () => {
    const snap = randomBytes(8);
    const ok = new Response(JSON.stringify({
      snapshot: toB64url(snap), wrappedKey: toB64url(randomBytes(8)),
      kdfSalt: toB64url(randomBytes(16)), expiresAt: 123,
    }), { status: 200 });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(ok);
    const api = makeApi(fetchMock);
    expect(await api.fetchDoc("gone")).toBeNull();
    const doc = await api.fetchDoc("here", "tok");
    expect(doc!.snapshot).toEqual(snap);
    const [, init] = fetchMock.mock.calls[1]!;
    expect((init as RequestInit).headers).toMatchObject({ "x-edit-token": "tok" });
  });
});
