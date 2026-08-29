// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderMarkdown } from "../src/render.ts";
import { renderPreview } from "../src/preview.ts";
import { wireCodeCopy, wireCopyText } from "../src/copy.ts";

const FENCE = "```js\nconst x = 1;\n```";

function writeTextSpy() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

describe("code-block copy buttons", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  it("adds no copy markup to the sanitized HTML itself", () => {
    // The security boundary: buttons are attached as DOM nodes afterwards, so
    // nothing resembling them may appear in what DOMPurify returns.
    const html = renderMarkdown(FENCE);
    expect(html).not.toContain("code-copy");
    expect(html).not.toContain("<button");
  });

  it("wraps each pre and attaches exactly one button", () => {
    renderPreview(root, `${FENCE}\n\ntext\n\n${FENCE}`);
    expect(root.querySelectorAll(".code-block").length).toBe(2);
    expect(root.querySelectorAll("button.code-copy").length).toBe(2);
    expect(root.querySelector(".code-block > pre")).not.toBeNull();
  });

  it("does not double-wrap when the preview re-renders", () => {
    renderPreview(root, FENCE);
    renderPreview(root, FENCE);
    expect(root.querySelectorAll(".code-block").length).toBe(1);
    expect(root.querySelectorAll("button.code-copy").length).toBe(1);
  });

  it("copies the code text, not the surrounding markup", async () => {
    const writeText = writeTextSpy();
    renderPreview(root, FENCE);
    wireCodeCopy(root);
    root.querySelector<HTMLButtonElement>("button.code-copy")!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("const x = 1;\n"));
  });

  it("leaves documents without code blocks untouched", () => {
    renderPreview(root, "# Just a heading");
    expect(root.querySelectorAll("button").length).toBe(0);
  });
});

describe("toolbar copy button", () => {
  it("copies the current text each time it is clicked", async () => {
    const writeText = writeTextSpy();
    let text = "first";
    const btn = document.createElement("button");
    wireCopyText(btn, () => text);
    btn.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith("first"));
    text = "second";
    btn.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenLastCalledWith("second"));
  });

  it("marks failure instead of claiming success when the clipboard is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    const btn = document.createElement("button");
    wireCopyText(btn, () => "x");
    btn.click();
    await vi.waitFor(() => expect(btn.classList.contains("copy-failed")).toBe(true));
    expect(btn.classList.contains("copied")).toBe(false);
  });
});
