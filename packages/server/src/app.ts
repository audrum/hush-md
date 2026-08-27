import Fastify, { type FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { toB64url, fromB64url, randomBytes, hashToken } from "@hush/envelope";
import { type Db, createDoc, getDoc, deleteDoc, bumpViewCount, updateSnapshot, deleteExpired } from "./db.ts";

const EXPIRES_MIN = 60, EXPIRES_MAX = 7776000, EXPIRES_DEFAULT = 604800;

function b64Field(v: unknown): Buffer | null {
  if (typeof v !== "string" || v.length === 0) return null;
  try { return Buffer.from(fromB64url(v)); } catch { return null; }
}

function safeHashEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex"), b = Buffer.from(bHex, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

async function requireEditor(db: Db, id: string, tokenHeader: unknown):
  Promise<{ ok: true; doc: NonNullable<ReturnType<typeof getDoc>> } | { ok: false; code: 401 | 404 }> {
  const doc = getDoc(db, id);
  if (!doc || doc.expiresAt < Date.now()) {
    if (doc) deleteDoc(db, id);
    return { ok: false, code: 404 };
  }
  if (typeof tokenHeader !== "string" || !safeHashEqual(await hashToken(tokenHeader), doc.editTokenHash)) {
    return { ok: false, code: 401 };
  }
  return { ok: true, doc };
}

export function buildApp(db: Db, staticDir?: string): FastifyInstance {
  const app = Fastify({ bodyLimit: 2 * 1024 * 1024 });

  app.get("/healthz", async () => ({ ok: true }));

  app.post("/api/docs", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const snapshot = b64Field(body.snapshot);
    const wrappedKey = b64Field(body.wrappedKey);
    const kdfSalt = b64Field(body.kdfSalt);
    const editTokenHash = typeof body.editTokenHash === "string" && /^[0-9a-f]{64}$/.test(body.editTokenHash)
      ? body.editTokenHash : null;
    if (!snapshot || !wrappedKey || !kdfSalt || !editTokenHash) {
      return reply.code(400).send({ error: "bad_request" });
    }
    const expiresInRaw = typeof body.expiresIn === "number" ? body.expiresIn : EXPIRES_DEFAULT;
    const expiresIn = Math.min(Math.max(Math.floor(expiresInRaw), EXPIRES_MIN), EXPIRES_MAX);
    const maxViews = typeof body.maxViews === "number" && Number.isInteger(body.maxViews) && body.maxViews > 0
      ? body.maxViews : null;
    const id = toB64url(randomBytes(16));
    createDoc(db, {
      id, snapshot, wrappedKey, kdfSalt, editTokenHash,
      expiresAt: Date.now() + expiresIn * 1000, maxViews,
    });
    return reply.code(201).send({ id });
  });

  app.get("/api/docs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const doc = getDoc(db, id);
    if (!doc) return reply.code(404).send({ error: "not_found" });
    if (doc.expiresAt < Date.now()) {
      deleteDoc(db, id);
      return reply.code(404).send({ error: "not_found" });
    }
    const token = req.headers["x-edit-token"];
    const isEditor = typeof token === "string" && safeHashEqual(await hashToken(token), doc.editTokenHash);
    let burnAfterServe = false;
    if (!isEditor) {
      const views = bumpViewCount(db, id);
      if (doc.maxViews !== null && views >= doc.maxViews) burnAfterServe = true;
    }
    const payload = {
      snapshot: toB64url(doc.snapshot), wrappedKey: toB64url(doc.wrappedKey),
      kdfSalt: toB64url(doc.kdfSalt), expiresAt: doc.expiresAt,
    };
    if (burnAfterServe) deleteDoc(db, id);
    return reply.send(payload);
  });

  app.put("/api/docs/:id/snapshot", async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = await requireEditor(db, id, req.headers["x-edit-token"]);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.code === 401 ? "unauthorized" : "not_found" });
    const snapshot = b64Field((req.body as Record<string, unknown> | null)?.snapshot);
    if (!snapshot) return reply.code(400).send({ error: "bad_request" });
    updateSnapshot(db, id, snapshot);
    return reply.code(204).send();
  });

  app.delete("/api/docs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = await requireEditor(db, id, req.headers["x-edit-token"]);
    if (!auth.ok) return reply.code(auth.code).send({ error: auth.code === 401 ? "unauthorized" : "not_found" });
    deleteDoc(db, id);
    return reply.code(204).send();
  });

  if (staticDir) {
    app.register(import("@fastify/static"), { root: staticDir, prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "not_found" });
      return reply.sendFile("index.html");
    });
  }

  return app;
}

export function startSweep(db: Db, intervalMs = 600000): NodeJS.Timeout {
  const t = setInterval(() => deleteExpired(db, Date.now()), intervalMs);
  t.unref();
  return t;
}
