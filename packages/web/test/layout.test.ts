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

  it("applies the gutter inside each pane, so a percentage means percent of the pane", () => {
    // .pane-preview's containing block is the whole split, not the pane, so a
    // percentage gutter there is roughly double what the editor gets and the
    // two panes visibly disagree. It has to go on something already inside the
    // pane: the rendered document, and an editor line.
    expect(css).toMatch(/\.pane-preview\s*>\s*\.doc\s*\{[^}]*padding-inline:\s*var\(--pane-gutter\)/);
    expect(css).not.toMatch(/\.pane-preview\s*\{[^}]*padding:[^;}]*var\(--pane-gutter\)/);
    const editor = readFileSync(fileURLToPath(new URL("../src/editor.ts", import.meta.url)), "utf8");
    expect(editor).toMatch(/cm-line[\s\S]{0,80}var\(--pane-gutter\)/);
  });

  it("keeps the gutter usable at both extremes", () => {
    const gutter = token("pane-gutter");
    expect(gutter).toMatch(/^clamp\(/); // a bare percentage collapses on a phone
  });

  it("gives the table itself the full width so its columns share it", () => {
    // display:block on a table sizes its columns to content and leaves it
    // hugging the left edge of its box; the wrapper carries the overflow.
    expect(css).toMatch(/\.table-wrap table\s*\{[^}]*width:\s*100%/);
    expect(css).not.toMatch(/\.doc table\s*\{[^}]*display:\s*block/);
  });
});
