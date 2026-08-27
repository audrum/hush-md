import { describe, it, expect } from "vitest";
import { openDb, createDoc, getDoc, updateSnapshot, bumpViewCount, deleteDoc, deleteExpired } from "../src/db.ts";

const row = (over: Partial<Parameters<typeof createDoc>[1]> = {}) => ({
  id: "doc1", snapshot: Buffer.from([1]), wrappedKey: Buffer.from([2]),
  kdfSalt: Buffer.from([3]), editTokenHash: "aa".repeat(32),
  expiresAt: Date.now() + 60000, maxViews: null, ...over,
});

describe("db", () => {
  it("create/get round-trips", () => {
    const db = openDb(":memory:");
    createDoc(db, row());
    const d = getDoc(db, "doc1")!;
    expect(d.snapshot).toEqual(Buffer.from([1]));
    expect(d.viewCount).toBe(0);
    expect(getDoc(db, "nope")).toBeUndefined();
  });
  it("updateSnapshot, bumpViewCount, deleteDoc", () => {
    const db = openDb(":memory:");
    createDoc(db, row());
    expect(updateSnapshot(db, "doc1", Buffer.from([9]))).toBe(true);
    expect(getDoc(db, "doc1")!.snapshot).toEqual(Buffer.from([9]));
    expect(bumpViewCount(db, "doc1")).toBe(1);
    expect(bumpViewCount(db, "doc1")).toBe(2);
    expect(deleteDoc(db, "doc1")).toBe(true);
    expect(deleteDoc(db, "doc1")).toBe(false);
  });
  it("bumpViewCount on missing doc returns 0", () => {
    const db = openDb(":memory:");
    expect(bumpViewCount(db, "missing")).toBe(0);
  });
  it("deleteExpired removes only past-expiry rows", () => {
    const db = openDb(":memory:");
    createDoc(db, row({ id: "old", expiresAt: 1000 }));
    createDoc(db, row({ id: "new" }));
    expect(deleteExpired(db, Date.now())).toBe(1);
    expect(getDoc(db, "old")).toBeUndefined();
    expect(getDoc(db, "new")).toBeDefined();
  });
});
