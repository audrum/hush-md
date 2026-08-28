import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import { openDb, getSecretState } from "../src/db.ts";
import { hashToken, toB64url, randomBytes } from "@hush/envelope";

const b = () => toB64url(randomBytes(24));
const EDIT = "edit-token-value";

async function makeDoc(app: ReturnType<typeof buildApp>, extra: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: "POST", url: "/api/docs",
    payload: { snapshot: b(), wrappedKey: b(), kdfSalt: b(), editTokenHash: await hashToken(EDIT), ...extra },
  });
  return res.json().id as string;
}

async function makeSecret(app: ReturnType<typeof buildApp>, extra: Record<string, unknown> = {}) {
  return app.inject({ method: "POST", url: "/api/secrets", payload: { blob: b(), ...extra } });
}

describe("secrets API", () => {
  it("creates a secret and burns it on first read; later reads get 410 with burnedAt", async () => {
    const app = buildApp(openDb(":memory:"));
    const blob = b();
    const created = await makeSecret(app, { blob });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    const first = await app.inject({ method: "GET", url: `/api/secrets/${id}` });
    expect(first.statusCode).toBe(200);
    expect(first.json().blob).toBe(blob);
    const second = await app.inject({ method: "GET", url: `/api/secrets/${id}` });
    expect(second.statusCode).toBe(410);
    expect(second.json().error).toBe("burned");
    expect(second.json().burnedAt).toBeTypeOf("number");
  });

  it("missing secret is 404 and rejects bad payloads", async () => {
    const app = buildApp(openDb(":memory:"));
    expect((await app.inject({ method: "GET", url: "/api/secrets/nonexistent" })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/secrets", payload: {} })).statusCode).toBe(400);
  });

  it("binding at doc creation stamps doc_id so doc burn cascades", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const sid = (await makeSecret(app)).json().id as string;
    const docId = await makeDoc(app, { secretIds: [sid], maxViews: 1 });
    // one non-editor view burns the doc; the secret must cascade away
    expect((await app.inject({ method: "GET", url: `/api/docs/${docId}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/secrets/${sid}` })).statusCode).toBe(404);
  });

  it("binding to an existing doc requires the edit token", async () => {
    const db = openDb(":memory:");
    const app = buildApp(db);
    const docId = await makeDoc(app);
    const noToken = await makeSecret(app, { docId });
    expect(noToken.statusCode).toBe(401);
    const withToken = await app.inject({
      method: "POST", url: "/api/secrets",
      headers: { "x-edit-token": EDIT },
      payload: { blob: b(), docId },
    });
    expect(withToken.statusCode).toBe(201);
    expect(getSecretState(db, withToken.json().id).state).toBe("live");
  });

  it("rejects invalid secretIds on doc creation instead of ignoring them", async () => {
    const app = buildApp(openDb(":memory:"));
    const res = await app.inject({
      method: "POST", url: "/api/docs",
      payload: { snapshot: b(), wrappedKey: b(), kdfSalt: b(), editTokenHash: await hashToken(EDIT), secretIds: "not-an-array" },
    });
    expect(res.statusCode).toBe(400);
  });
});
