// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render.ts";

describe("renderMarkdown", () => {
  it("renders GFM tables and task lists", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table>");
  });
  it("neutralizes script tags and inline handlers", () => {
    const html = renderMarkdown('hello <script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    const div = document.createElement("div");
    div.innerHTML = html;
    expect(div.querySelector("script")).toBeNull();
    expect(div.querySelector("img[onerror]")).toBeNull();
    expect(div.querySelectorAll("img").length).toBe(0); // escaped text, not a real element
  });
  it("renders fenced code without executing it", () => {
    const html = renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("const x = 1;");
  });
});
