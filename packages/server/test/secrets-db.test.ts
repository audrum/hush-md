import { describe, it, expect } from "vitest";
import {
  openDb, createDoc, deleteDoc, deleteExpired,
  createSecret, burnSecret, bindSecrets, getSecretState,
} from "../src/db.ts";

const docRow = (id: string, expiresAt = Date.now() + 60000) => ({
  id, snapshot: Buffer.from([1]), wrappedKey: Buffer.from([2]), kdfSalt: Buffer.from([3]),
  editTokenHash: "aa".repeat(32), expiresAt, maxViews: null,
});

describe("secrets store", () => {
  it("create then burn returns the blob exactly once, then a tombstone with burnedAt", () => {
    const db = openDb(":memory:");
    createSecret(db, { id: "s1", blob: Buffer.from("cipher"), expiresAt: Date.now() + 60000 });
    const first = burnSecret(db, "s1");
    expect(first.state).toBe("burned_now");
    expect(first.state === "burned_now" && first.blob.toString()).toBe("cipher");
    const again = getSecretState(db, "s1");
    expect(again.state).toBe("already_burned");
    expect(again.state === "already_burned" && again.burnedAt).toBeTypeOf("number");
  });

  it("burnSecret on missing or expired secrets reports gone", () => {
    const db = openDb(":memory:");
    expect(burnSecret(db, "nope").state).toBe("gone");
    createSecret(db, { id: "s2", blob: Buffer.from("x"), expiresAt: 1 });
    expect(burnSecret(db, "s2").state).toBe("gone");
  });

  it("bindSecrets stamps doc_id and aligns expiry, only for unbound ids", () => {
    const db = openDb(":memory:");
    createDoc(db, docRow("d1", Date.now() + 500000));
    createSecret(db, { id: "s3", blob: Buffer.from("x"), expiresAt: Date.now() + 1000 });
    createSecret(db, { id: "s4", blob: Buffer.from("y"), expiresAt: Date.now() + 1000, docId: "other" });
    const bound = bindSecrets(db, ["s3", "s4", "missing"], "d1", Date.now() + 500000);
    expect(bound).toBe(1); // only s3 was unbound and real
  });

  it("deleting a doc cascades to its secrets", () => {
    const db = openDb(":memory:");
    createDoc(db, docRow("d2"));
    createSecret(db, { id: "s5", blob: Buffer.from("x"), expiresAt: Date.now() + 60000, docId: "d2" });
    deleteDoc(db, "d2");
    expect(burnSecret(db, "s5").state).toBe("gone");
  });

  it("deleteExpired removes expired secrets too", () => {
    const db = openDb(":memory:");
    createSecret(db, { id: "s6", blob: Buffer.from("x"), expiresAt: 1 });
    createSecret(db, { id: "s7", blob: Buffer.from("y"), expiresAt: Date.now() + 60000 });
    deleteExpired(db, Date.now());
    expect(burnSecret(db, "s6").state).toBe("gone");
    expect(burnSecret(db, "s7").state).toBe("burned_now");
  });
});
