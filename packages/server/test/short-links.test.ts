import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import { openDb } from "../src/db.ts";
import { hashToken, toB64url, randomBytes } from "@hush/envelope";

const b = () => toB64url(randomBytes(24));
const sid = () => toB64url(randomBytes(32)); // 43-char lookup id, like sha256(token)

async function makeDoc(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: "POST", url: "/api/docs",
    payload: { snapshot: b(), wrappedKey: b(), kdfSalt: b(), editTokenHash: await hashToken("t") },
  });
  return res.json().id as string;
}

describe("short links", () => {
  it("stores and returns the encrypted blob by lookup id", async () => {
    const app = buildApp(openDb(":memory:"));
    const docId = await makeDoc(app);
    const id = sid();
    const blob = b();
    const created = await app.inject({ method: "POST", url: "/api/short", payload: { id, blob, docId } });
    expect(created.statusCode).toBe(201);
    const got = await app.inject({ method: "GET", url: `/api/short/${id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().blob).toBe(blob);
  });

  it("rejects short links for missing docs, bad payloads, and duplicate ids", async () => {
    const app = buildApp(openDb(":memory:"));
    const docId = await makeDoc(app);
    expect((await app.inject({ method: "POST", url: "/api/short", payload: { id: sid(), blob: b(), docId: "A".repeat(22) } })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/short", payload: { id: "short", blob: b(), docId } })).statusCode).toBe(400);
    const id = sid();
    expect((await app.inject({ method: "POST", url: "/api/short", payload: { id, blob: b(), docId } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/short", payload: { id, blob: b(), docId } })).statusCode).toBe(409);
  });

  it("short links die with their document", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const docId = await makeDoc(app);
    const id = sid();
    await app.inject({ method: "POST", url: "/api/short", payload: { id, blob: b(), docId } });
    db.prepare("UPDATE docs SET expires_at = 1 WHERE id = ?").run(docId);
    // lazy doc expiry deletes the doc and cascades
    await app.inject({ method: "GET", url: `/api/docs/${docId}` });
    expect((await app.inject({ method: "GET", url: `/api/short/${id}` })).statusCode).toBe(404);
  });

  it("expired short links 404 even if the row still exists", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const docId = await makeDoc(app);
    const id = sid();
    await app.inject({ method: "POST", url: "/api/short", payload: { id, blob: b(), docId } });
    db.prepare("UPDATE short_links SET expires_at = 1 WHERE id = ?").run(id);
    expect((await app.inject({ method: "GET", url: `/api/short/${id}` })).statusCode).toBe(404);
  });
});
