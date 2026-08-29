// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render.ts";
import { decorateCallouts } from "../src/callouts.ts";

function dom(src: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = renderMarkdown(src);
  decorateCallouts(d);
  return d;
}

describe("callouts", () => {
  it("labels a typed blockquote and keeps its body", () => {
    const el = dom("> [!warning] Watch out\n> The link is the key.");
    const quote = el.querySelector("blockquote")!;
    expect(quote.classList.contains("callout")).toBe(true);
    expect(quote.classList.contains("callout-warning")).toBe(true);
    expect(quote.querySelector(".callout-title span")!.textContent).toBe("Watch out");
    expect(quote.textContent).toContain("The link is the key.");
    expect(quote.textContent).not.toContain("[!warning]");
  });

  it("falls back to the type as the title", () => {
    const el = dom("> [!tip]\n> Body only.");
    expect(el.querySelector(".callout-title span")!.textContent).toBe("Tip");
  });

  it("folds each alias onto the type it is an alias of", () => {
    const kind = (src: string) => dom(`> [!${src}] x`).querySelector("blockquote")!.className;
    expect(kind("caution")).toContain("callout-warning");
    expect(kind("tldr")).toContain("callout-abstract");
    expect(kind("fail")).toContain("callout-failure");
    expect(kind("error")).toContain("callout-danger");
    expect(kind("done")).toContain("callout-success");
    expect(kind("unknownkind")).toContain("callout-note");
  });

  it("keeps every Obsidian type visually distinct by icon", () => {
    const types = ["note", "abstract", "info", "todo", "tip", "success", "question",
                   "warning", "failure", "danger", "bug", "example", "quote"];
    const shapes = types.map((t) => {
      const quote = dom(`> [!${t}] x`).querySelector("blockquote")!;
      expect(quote.className).toContain(`callout-${t}`); // no type folds into another
      return quote.querySelector("svg")!.innerHTML;
    });
    expect(new Set(shapes).size).toBe(types.length);
  });

  it("leaves ordinary blockquotes untouched", () => {
    const quote = dom("> Just a quotation.").querySelector("blockquote")!;
    expect(quote.classList.contains("callout")).toBe(false);
    expect(quote.querySelector(".callout-title")).toBeNull();
  });

  it("takes the title as text, so markup in it cannot execute", () => {
    const el = dom("> [!note] <img src=x onerror=alert(1)>\n> body");
    expect(el.querySelectorAll("img").length).toBe(0);
    expect(el.querySelector(".callout-title span")!.textContent).toContain("<img");
  });

  it("is idempotent across repeated decoration", () => {
    const d = document.createElement("div");
    d.innerHTML = renderMarkdown("> [!note] Once\n> body");
    decorateCallouts(d);
    decorateCallouts(d);
    expect(d.querySelectorAll(".callout-title").length).toBe(1);
  });
});
