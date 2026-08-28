// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown, SECRET_PLACEHOLDER_RE } from "../src/render.ts";

const ID = "A".repeat(22);
const KEY = "B".repeat(43);
const placeholder = `{{secret:${ID}:${KEY}}}`;

describe("secret placeholders", () => {
  it("renders a reveal chip carrying id and key as data attributes", () => {
    const html = renderMarkdown(`before ${placeholder} after`);
    const div = document.createElement("div");
    div.innerHTML = html;
    const chip = div.querySelector<HTMLButtonElement>("button.secret-chip");
    expect(chip).not.toBeNull();
    expect(chip!.dataset.sid).toBe(ID);
    expect(chip!.dataset.skey).toBe(KEY);
    expect(div.textContent).toContain("before");
    expect(div.textContent).toContain("after");
  });

  it("ignores malformed placeholders (wrong lengths stay literal text)", () => {
    const html = renderMarkdown(`{{secret:short:${KEY}}}`);
    const div = document.createElement("div");
    div.innerHTML = html;
    expect(div.querySelector(".secret-chip")).toBeNull();
    expect(div.textContent).toContain("{{secret:short:");
  });

  it("chips survive sanitization but injected markup around them does not", () => {
    const html = renderMarkdown(`<img src=x onerror=alert(1)> ${placeholder}`);
    const div = document.createElement("div");
    div.innerHTML = html;
    expect(div.querySelector("img")).toBeNull();
    expect(div.querySelector(".secret-chip")).not.toBeNull();
  });

  it("exports the placeholder regex used by the editor insert flow", () => {
    expect(SECRET_PLACEHOLDER_RE.test(placeholder)).toBe(true);
  });
});
