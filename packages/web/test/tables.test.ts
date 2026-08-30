// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render.ts";
import { decorateTables } from "../src/tables.ts";

function doc(src: string): HTMLElement {
  const d = document.createElement("div");
  d.className = "doc";
  d.innerHTML = renderMarkdown(src);
  decorateTables(d);
  return d;
}

const TABLE = "| A | B |\n|---|---|\n| 1 | 2 |";

describe("decorateTables", () => {
  it("wraps a table so the scroll box is the wrapper, not the table", () => {
    const d = doc(TABLE);
    const wrap = d.querySelector(".table-wrap");
    expect(wrap).not.toBeNull();
    expect(wrap!.parentElement).toBe(d);
    expect(wrap!.querySelector("table")).not.toBeNull();
  });

  it("leaves the table itself a real table, so its columns can share the width", () => {
    const d = doc(TABLE);
    // display:block on the table is what made columns size to content and the
    // block read as shoved left; the wrapper carries the overflow instead.
    expect(d.querySelector("table")!.parentElement!.className).toBe("table-wrap");
  });

  it("keeps the table's contents intact", () => {
    const d = doc(TABLE);
    expect(d.querySelectorAll("td").length).toBe(2);
    expect(d.querySelector("table")!.textContent).toContain("1");
  });

  it("wraps every table in the document", () => {
    const d = doc(`${TABLE}\n\ntext\n\n${TABLE}`);
    expect(d.querySelectorAll(".table-wrap").length).toBe(2);
    expect(d.querySelectorAll(".table-wrap table").length).toBe(2);
  });

  it("is idempotent, since the preview re-decorates on every keystroke", () => {
    const d = document.createElement("div");
    d.innerHTML = renderMarkdown(TABLE);
    decorateTables(d);
    decorateTables(d);
    expect(d.querySelectorAll(".table-wrap").length).toBe(1);
  });

  it("does nothing to a document with no tables", () => {
    const d = doc("Just a paragraph.");
    expect(d.querySelectorAll(".table-wrap").length).toBe(0);
  });
});
