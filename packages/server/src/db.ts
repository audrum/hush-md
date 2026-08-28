import Database from "better-sqlite3";

export type Db = Database.Database;

export interface DocRow {
  id: string; snapshot: Buffer; wrappedKey: Buffer; kdfSalt: Buffer;
  editTokenHash: string; createdAt: number; expiresAt: number;
  maxViews: number | null; viewCount: number;
}

export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    snapshot BLOB NOT NULL,
    wrapped_key BLOB NOT NULL,
    kdf_salt BLOB NOT NULL,
    edit_token_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    max_views INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_docs_expires ON docs(expires_at)");
  db.exec(`CREATE TABLE IF NOT EXISTS secrets (
    id TEXT PRIMARY KEY,
    doc_id TEXT,
    blob BLOB,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    burned_at INTEGER
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_secrets_expires ON secrets(expires_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_secrets_doc ON secrets(doc_id)");
  return db;
}

export function createDoc(db: Db, d: Omit<DocRow, "createdAt" | "viewCount">): void {
  db.prepare(`INSERT INTO docs (id, snapshot, wrapped_key, kdf_salt, edit_token_hash, created_at, expires_at, max_views)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(d.id, d.snapshot, d.wrappedKey, d.kdfSalt, d.editTokenHash, Date.now(), d.expiresAt, d.maxViews);
}

export function getDoc(db: Db, id: string): DocRow | undefined {
  const r = db.prepare(`SELECT id, snapshot, wrapped_key, kdf_salt, edit_token_hash, created_at, expires_at, max_views, view_count
                        FROM docs WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!r) return undefined;
  return {
    id: r.id as string, snapshot: r.snapshot as Buffer, wrappedKey: r.wrapped_key as Buffer,
    kdfSalt: r.kdf_salt as Buffer, editTokenHash: r.edit_token_hash as string,
    createdAt: r.created_at as number, expiresAt: r.expires_at as number,
    maxViews: r.max_views as number | null, viewCount: r.view_count as number,
  };
}

export const updateSnapshot = (db: Db, id: string, snapshot: Buffer): boolean =>
  db.prepare("UPDATE docs SET snapshot = ? WHERE id = ?").run(snapshot, id).changes > 0;

export function bumpViewCount(db: Db, id: string): number {
  const row = db.prepare("UPDATE docs SET view_count = view_count + 1 WHERE id = ? RETURNING view_count").get(id) as { view_count: number } | undefined;
  return row?.view_count ?? 0;
}

export const deleteDoc = (db: Db, id: string): boolean => {
  db.prepare("DELETE FROM secrets WHERE doc_id = ?").run(id);
  return db.prepare("DELETE FROM docs WHERE id = ?").run(id).changes > 0;
};

export const deleteExpired = (db: Db, now: number): number => {
  db.prepare("DELETE FROM secrets WHERE expires_at < ?").run(now);
  return db.prepare("DELETE FROM docs WHERE expires_at < ?").run(now).changes;
};

// ---- burn-once secrets ----

export function createSecret(db: Db, s: { id: string; blob: Buffer; expiresAt: number; docId?: string }): void {
  db.prepare("INSERT INTO secrets (id, doc_id, blob, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(s.id, s.docId ?? null, s.blob, Date.now(), s.expiresAt);
}

export type SecretState =
  | { state: "gone" }
  | { state: "already_burned"; burnedAt: number }
  | { state: "live"; blob: Buffer };

export function getSecretState(db: Db, id: string): SecretState {
  const r = db.prepare("SELECT blob, expires_at, burned_at FROM secrets WHERE id = ?").get(id) as
    { blob: Buffer | null; expires_at: number; burned_at: number | null } | undefined;
  if (!r || r.expires_at < Date.now()) return { state: "gone" };
  if (r.burned_at !== null) return { state: "already_burned", burnedAt: r.burned_at };
  return { state: "live", blob: r.blob! };
}

export type BurnResult =
  | { state: "gone" }
  | { state: "already_burned"; burnedAt: number }
  | { state: "burned_now"; blob: Buffer };

// Read + null-out inside one transaction; better-sqlite3 is synchronous, so the
// pair is atomic with respect to other requests in this process.
export function burnSecret(db: Db, id: string): BurnResult {
  const burn = db.transaction((sid: string): BurnResult => {
    const s = getSecretState(db, sid);
    if (s.state !== "live") return s;
    db.prepare("UPDATE secrets SET blob = NULL, burned_at = ? WHERE id = ?").run(Date.now(), sid);
    return { state: "burned_now", blob: s.blob };
  });
  return burn(id);
}

export function bindSecrets(db: Db, ids: string[], docId: string, docExpiresAt: number): number {
  const stmt = db.prepare("UPDATE secrets SET doc_id = ?, expires_at = ? WHERE id = ? AND doc_id IS NULL");
  let bound = 0;
  for (const id of ids) bound += stmt.run(docId, docExpiresAt, id).changes;
  return bound;
}
