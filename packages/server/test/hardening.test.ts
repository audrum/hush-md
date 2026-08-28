import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.ts";
import { openDb } from "../src/db.ts";
import { hashToken, toB64url, randomBytes } from "@hush/envelope";

const b = () => toB64url(randomBytes(24));

async function createPayload() {
  return { snapshot: b(), wrappedKey: b(), kdfSalt: b(), editTokenHash: await hashToken("t") };
}

describe("hardening", () => {
  it("sets security headers on every response and no-store on API responses", async () => {
    const app = buildApp(openDb(":memory:"));
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.headers["strict-transport-security"]).toContain("max-age=");
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["referrer-policy"]).toBe("no-referrer");
    expect(health.headers["content-security-policy"]).toContain("default-src 'self'");
    const api = await app.inject({ method: "GET", url: "/api/docs/nonexistent" });
    expect(api.headers["cache-control"]).toBe("no-store");
  });

  it("rate-limits document creation per IP", async () => {
    const app = buildApp(openDb(":memory:"), undefined, { createLimit: { max: 2, timeWindow: 60000 } });
    const payload = await createPayload();
    expect((await app.inject({ method: "POST", url: "/api/docs", payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/docs", payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/docs", payload })).statusCode).toBe(429);
  });

  it("refuses new documents when the database exceeds the storage budget", async () => {
    const app = buildApp(openDb(":memory:"), undefined, { maxDbBytes: 1 });
    const res = await app.inject({ method: "POST", url: "/api/docs", payload: await createPayload() });
    expect(res.statusCode).toBe(507);
    expect(res.json()).toEqual({ error: "storage_full" });
  });

  it("keeps serving reads even when the storage budget is exceeded", async () => {
    const db = openDb(":memory:");
    const writable = buildApp(db);
    const { id } = (await writable.inject({ method: "POST", url: "/api/docs", payload: await createPayload() })).json();
    const full = buildApp(db, undefined, { maxDbBytes: 1 });
    expect((await full.inject({ method: "GET", url: `/api/docs/${id}` })).statusCode).toBe(200);
  });
});
