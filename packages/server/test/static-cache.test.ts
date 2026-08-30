import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.ts";
import { openDb } from "../src/db.ts";

// Vite fingerprints everything under /assets, so those files are immutable by
// construction: a change produces a new name. index.html carries the reference
// to them and must always be revalidated, or a deploy stays invisible.
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "hush-static-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "index-AbC12345.js"), "console.log(1)\n");
  writeFileSync(join(dir, "assets", "index-AbC12345.css"), ".a{color:red}\n");
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>t</title>\n");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("static cache headers", () => {
  it("lets fingerprinted assets be cached indefinitely", async () => {
    const app = buildApp(openDb(":memory:"), dir);
    await app.ready();
    for (const file of ["index-AbC12345.js", "index-AbC12345.css"]) {
      const res = await app.inject({ method: "GET", url: `/assets/${file}` });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toContain("immutable");
      expect(res.headers["cache-control"]).toMatch(/max-age=\d{7,}/);
    }
  });

  it("keeps index.html revalidating, so a deploy is picked up", async () => {
    const app = buildApp(openDb(":memory:"), dir);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/index.html" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=0");
    expect(res.headers["cache-control"]).not.toContain("immutable");
  });

  it("keeps the SPA fallback revalidating too", async () => {
    const app = buildApp(openDb(":memory:"), dir);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/d/some-document-id" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=0");
    expect(res.headers["cache-control"]).not.toContain("immutable");
  });

  it("still refuses to cache API responses", async () => {
    const app = buildApp(openDb(":memory:"), dir);
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/docs/nonexistent" });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
