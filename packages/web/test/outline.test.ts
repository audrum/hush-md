// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render.ts";
import { decorateHeadings, readOutline, renderOutline } from "../src/outline.ts";

function doc(src: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = renderMarkdown(src);
  decorateHeadings(d);
  return d;
}

describe("decorateHeadings", () => {
  it("gives every heading an id to scroll to", () => {
    const d = doc("# One\n\n## Two\n\n### Three");
    const ids = [...d.querySelectorAll("h1,h2,h3")].map((h) => h.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps ids unique when two headings share a title", () => {
    const d = doc("## Notes\n\ntext\n\n## Notes");
    const ids = [...d.querySelectorAll("h2")].map((h) => h.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("is idempotent, so re-rendering does not renumber the document", () => {
    const d = doc("# One\n\n## Two");
    const before = [...d.querySelectorAll("h1,h2")].map((h) => h.id);
    decorateHeadings(d);
    const after = [...d.querySelectorAll("h1,h2")].map((h) => h.id);
    expect(after).toEqual(before);
  });
});

describe("readOutline", () => {
  it("reads level and text in document order", () => {
    const entries = readOutline(doc("# Title\n\n## Alpha\n\n### Beta\n\n## Gamma"));
    expect(entries.map((e) => e.text)).toEqual(["Title", "Alpha", "Beta", "Gamma"]);
    expect(entries.map((e) => e.level)).toEqual([1, 2, 3, 2]);
  });

  it("takes the heading as text, so markup in it cannot execute", () => {
    const entries = readOutline(doc("# Hi `code` and **bold**"));
    expect(entries[0].text).toBe("Hi code and bold");
  });

  it("returns nothing for a document with no headings", () => {
    expect(readOutline(doc("Just a paragraph."))).toEqual([]);
  });
});

describe("renderOutline", () => {
  it("builds one button per heading, carrying its target id", () => {
    const panel = document.createElement("div");
    const d = doc("# Title\n\n## Alpha");
    renderOutline(panel, readOutline(d), () => {});
    const items = panel.querySelectorAll("button[data-target]");
    expect(items.length).toBe(2);
    expect(items[0].getAttribute("data-target")).toBe(d.querySelector("h1")!.id);
  });

  it("puts heading text in as text, never as markup", () => {
    const panel = document.createElement("div");
    renderOutline(panel, [{ id: "h-0", level: 1, text: "<img src=x onerror=alert(1)>" }], () => {});
    expect(panel.querySelectorAll("img").length).toBe(0);
    expect(panel.querySelector("button")!.textContent).toContain("<img");
  });

  it("reports which heading was picked", () => {
    const panel = document.createElement("div");
    const picked: string[] = [];
    renderOutline(panel, [{ id: "h-1", level: 2, text: "Alpha" }], (id) => picked.push(id));
    panel.querySelector<HTMLButtonElement>("button[data-target]")!.click();
    expect(picked).toEqual(["h-1"]);
  });

  it("says so plainly when there is nothing to outline", () => {
    const panel = document.createElement("div");
    renderOutline(panel, [], () => {});
    expect(panel.querySelectorAll("button[data-target]").length).toBe(0);
    expect(panel.textContent).toMatch(/heading/i);
  });

  it("replaces the previous list rather than appending to it", () => {
    const panel = document.createElement("div");
    renderOutline(panel, [{ id: "a", level: 1, text: "A" }], () => {});
    renderOutline(panel, [{ id: "b", level: 1, text: "B" }], () => {});
    expect(panel.querySelectorAll("button[data-target]").length).toBe(1);
  });
});
