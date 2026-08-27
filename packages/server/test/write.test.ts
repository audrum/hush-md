import { describe, it, expect } from "vitest";
import { buildApp, startSweep } from "../src/app.ts";
import { openDb, getDoc } from "../src/db.ts";
import { hashToken, toB64url, randomBytes } from "@hush/envelope";

const b = () => toB64url(randomBytes(24));
const EDIT = "edit-token-value";

async function make(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: "POST", url: "/api/docs",
    payload: { snapshot: b(), wrappedKey: b(), kdfSalt: b(), editTokenHash: await hashToken(EDIT) },
  });
  return res.json().id as string;
}

describe("app: writes", () => {
  it("snapshot update requires the edit token", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const id = await make(app);
    const newSnap = b();
    expect((await app.inject({ method: "PUT", url: `/api/docs/${id}/snapshot`, payload: { snapshot: newSnap } })).statusCode).toBe(401);
    expect((await app.inject({
      method: "PUT", url: `/api/docs/${id}/snapshot`,
      headers: { "x-edit-token": "wrong" }, payload: { snapshot: newSnap },
    })).statusCode).toBe(401);
    expect((await app.inject({
      method: "PUT", url: `/api/docs/${id}/snapshot`,
      headers: { "x-edit-token": EDIT }, payload: { snapshot: newSnap },
    })).statusCode).toBe(204);
    expect(toB64url(getDoc(db, id)!.snapshot)).toBe(newSnap);
  });
  it("delete requires the edit token", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const id = await make(app);
    expect((await app.inject({ method: "DELETE", url: `/api/docs/${id}` })).statusCode).toBe(401);
    expect((await app.inject({ method: "DELETE", url: `/api/docs/${id}`, headers: { "x-edit-token": EDIT } })).statusCode).toBe(204);
    expect(getDoc(db, id)).toBeUndefined();
  });
  it("sweep deletes expired docs on its own", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const id = await make(app);
    db.prepare("UPDATE docs SET expires_at = 1 WHERE id = ?").run(id);
    const t = startSweep(db, 20);
    await new Promise((r) => setTimeout(r, 80));
    clearInterval(t);
    expect(getDoc(db, id)).toBeUndefined();
  });
});
