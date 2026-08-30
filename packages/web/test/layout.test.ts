import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/style.css", import.meta.url)), "utf8");

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  return m ? m[1].trim() : "";
}

// Alignment between prose and wide blocks was got wrong three separate times,
// each time by giving prose a measure of its own. A table or a code block
// cannot be capped without squeezing its contents, so the moment prose has a
// different width the two stop sharing a left edge and the text visibly sits
// in a narrower column. These are tripwires: changing a measure is allowed,
// but it has to be a decision, not a side effect.
describe("document measures", () => {
  it("keeps prose on the same width as tables and code blocks", () => {
    expect(token("measure")).toBe("100%");
  });

  it("keeps the source pane on one width too", () => {
    expect(token("measure-source")).toBe("100%");
  });

  it("does not cap wide blocks, which would squeeze their contents", () => {
    expect(css).toMatch(/\.doc > \.table-wrap[\s\S]*?max-width:\s*none/);
  });

  it("gives both panes the same gutter, in a unit that resolves the same in each", () => {
    const gutter = token("pane-gutter");
    expect(gutter).not.toBe("");
    // A percentage resolves against each element's own containing block: the
    // preview's padding against the whole split, an editor line's against just
    // that pane. The two panes then show visibly different gutters.
    expect(gutter).not.toMatch(/%/);
    expect(gutter).toMatch(/vw|vmin/);
  });

  it("uses the shared gutter in both panes rather than a hardcoded value", () => {
    expect(css).toMatch(/\.pane-preview\s*\{[^}]*var\(--pane-gutter\)/);
    const editor = readFileSync(fileURLToPath(new URL("../src/editor.ts", import.meta.url)), "utf8");
    expect(editor).toMatch(/cm-line[\s\S]{0,80}var\(--pane-gutter\)/);
  });

  it("gives the table itself the full width so its columns share it", () => {
    // display:block on a table sizes its columns to content and leaves it
    // hugging the left edge of its box; the wrapper carries the overflow.
    expect(css).toMatch(/\.table-wrap table\s*\{[^}]*width:\s*100%/);
    expect(css).not.toMatch(/\.doc table\s*\{[^}]*display:\s*block/);
  });
});
