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

export const deleteDoc = (db: Db, id: string): boolean =>
  db.prepare("DELETE FROM docs WHERE id = ?").run(id).changes > 0;

export const deleteExpired = (db: Db, now: number): number =>
  db.prepare("DELETE FROM docs WHERE expires_at < ?").run(now).changes;
