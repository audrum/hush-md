// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/render.ts";

function dom(src: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = renderMarkdown(src);
  return d;
}

describe("math markup", () => {
  it("carries inline TeX as an attribute, never as markup", () => {
    const el = dom("Euler: $e^{i\\pi}+1=0$ is neat.");
    const math = el.querySelector<HTMLElement>(".hush-math");
    expect(math).not.toBeNull();
    expect(math!.dataset.tex).toBe("e^{i\\pi}+1=0");
    expect(math!.textContent).toBe(""); // KaTeX fills it in later, past the sanitizer
    expect(math!.classList.contains("hush-math-block")).toBe(false);
  });

  it("recognises display math on its own lines", () => {
    const el = dom("before\n\n$$\n\\int_0^1 x^2 dx\n$$\n\nafter");
    const block = el.querySelector<HTMLElement>(".hush-math-block");
    expect(block).not.toBeNull();
    expect(block!.dataset.tex).toBe("\\int_0^1 x^2 dx");
    expect(el.querySelectorAll("p").length).toBe(2);
  });

  it("recognises single-line display math", () => {
    expect(dom("$$a^2+b^2=c^2$$").querySelector<HTMLElement>(".hush-math-block")!.dataset.tex).toBe("a^2+b^2=c^2");
  });

  it("leaves prices alone", () => {
    for (const src of ["It costs $5 and $10 total.", "Between $100 and $200.", "$ spaced $"]) {
      expect(dom(src).querySelector(".hush-math")).toBeNull();
    }
  });

  it("does not treat an unclosed dollar as math", () => {
    expect(dom("A lone $ sign.").querySelector(".hush-math")).toBeNull();
  });

  it("respects an escaped dollar", () => {
    expect(dom("\\$not math\\$").querySelector(".hush-math")).toBeNull();
  });

  it("cannot smuggle markup through the TeX attribute", () => {
    // Asserted on the DOM, not on serialized HTML: the payload is *supposed*
    // to survive as attribute text. What matters is that it stays data — no
    // element is created, and it never becomes a sibling of the span.
    const el = dom('$x"><img src=x onerror=alert(1)>$');
    const math = el.querySelector<HTMLElement>(".hush-math")!;
    expect(el.querySelectorAll("img").length).toBe(0);
    expect(math.children.length).toBe(0);
    expect(math.dataset.tex).toBe('x"><img src=x onerror=alert(1)>');
    expect(math.getAttributeNames()).toEqual(["class", "data-tex"]);
  });

  it("does not disturb code spans or fences containing dollars", () => {
    const el = dom("Use `$HOME` and:\n\n```sh\necho $PATH\n```");
    expect(el.querySelector(".hush-math")).toBeNull();
    expect(el.querySelector("code")!.textContent).toContain("$HOME");
  });
});
