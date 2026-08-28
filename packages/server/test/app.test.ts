import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import { openDb, getDoc } from "../src/db.ts";
import { hashToken, toB64url, randomBytes } from "@hush/envelope";

const b = () => toB64url(randomBytes(24));
const EDIT = "edit-token-value";

async function createDocReq(app: Awaited<ReturnType<typeof buildApp>>, over: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: "POST", url: "/api/docs",
    payload: { snapshot: b(), wrappedKey: b(), kdfSalt: b(), editTokenHash: await hashToken(EDIT), ...over },
  });
  return res;
}

describe("app: create/fetch", () => {
  it("creates then fetches; snapshot survives round-trip", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const snapshot = b();
    const wrappedKey = b();
    const kdfSalt = b();
    const created = await app.inject({
      method: "POST", url: "/api/docs",
      payload: { snapshot, wrappedKey, kdfSalt, editTokenHash: await hashToken(EDIT) },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    const got = await app.inject({ method: "GET", url: `/api/docs/${id}` });
    expect(got.statusCode).toBe(200);
    const body = got.json();
    expect(body.snapshot).toBe(snapshot);
    expect(body.wrappedKey).toBe(wrappedKey);
    expect(body.kdfSalt).toBe(kdfSalt);
    expect(body.expiresAt).toBeTypeOf("number");
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });
  it("rejects bad payloads", async () => {
    const app = buildApp(openDb(":memory:"));
    const res = await app.inject({ method: "POST", url: "/api/docs", payload: { snapshot: "x" } });
    expect(res.statusCode).toBe(400);
  });
  it("expired docs 404 and are deleted (lazy expiry)", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const { id } = (await createDocReq(app)).json();
    db.prepare("UPDATE docs SET expires_at = 1 WHERE id = ?").run(id);
    const res = await app.inject({ method: "GET", url: `/api/docs/${id}` });
    expect(res.statusCode).toBe(404);
    expect(getDoc(db, id)).toBeUndefined();
  });
  it("rejects an invalid maxViews instead of coercing it to unlimited", async () => {
    const app = buildApp(openDb(":memory:"));
    const res = await createDocReq(app, { maxViews: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "bad_request" });
  });
  it("maxViews: Nth view served then doc deleted; editor fetches don't count", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const { id } = (await createDocReq(app, { maxViews: 2 })).json();
    const editorGet = await app.inject({ method: "GET", url: `/api/docs/${id}`, headers: { "x-edit-token": EDIT } });
    expect(editorGet.statusCode).toBe(200); // does not consume a view
    expect((await app.inject({ method: "GET", url: `/api/docs/${id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/docs/${id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/docs/${id}` })).statusCode).toBe(404);
  });
});
