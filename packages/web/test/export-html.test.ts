// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildExport } from "../src/export-html.ts";
import { makeQr } from "../src/qr.ts";

const DOC = `# Release notes

> [!warning] Read first
> The link is the key.

\`\`\`sh
echo hello
\`\`\`

Some **bold** text.
`;

describe("self-contained HTML export", () => {
  it("produces a complete document named after its heading", async () => {
    const { html, filename } = await buildExport(DOC);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html");
    expect(filename).toBe("release-notes.html");
  });

  it("references nothing off the page", async () => {
    const { html } = await buildExport(DOC);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const external = [...doc.querySelectorAll("[src], [href]")].map(
      (el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "",
    );
    expect(external.filter((u) => /^(https?:)?\/\//.test(u))).toEqual([]);
    expect(doc.querySelectorAll("script").length).toBe(0);
    // Nor may the stylesheet point back at the app's asset paths: a file that
    // only renders while hush.md is reachable is not self-contained.
    expect(html).not.toContain("/assets/");
  });

  it("carries the rendered content, callout included", async () => {
    const { html } = await buildExport(DOC);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("h1")!.textContent).toBe("Release notes");
    expect(doc.querySelector("blockquote.callout-warning")).not.toBeNull();
    expect(doc.querySelector(".callout-title")!.textContent).toContain("Read first");
    expect(doc.querySelector("pre code")!.textContent).toContain("echo hello");
  });

  it("strips controls that would be dead without the app", async () => {
    const { html } = await buildExport("```sh\nls\n```");
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("button").length).toBe(0);
    expect(doc.querySelectorAll(".code-block").length).toBe(0);
    expect(doc.querySelector("pre code")!.textContent).toContain("ls");
  });

  it("replaces a burn-once secret with an explanation rather than a dead chip", async () => {
    const placeholder = `{{secret:${"a".repeat(22)}:${"b".repeat(43)}}}`;
    const { html } = await buildExport(`Token: ${placeholder}`);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector(".secret-chip")).toBeNull();
    expect(doc.querySelector(".secret-static")!.textContent).toContain("burn-once secret");
  });

  it("falls back to a generic name when there is no heading", async () => {
    expect((await buildExport("just a line")).filename).toBe("hush-md-document.html");
  });
});

describe("QR", () => {
  it("encodes a short link as an inline SVG", async () => {
    const { svg, dense } = await makeQr("https://hush.md/s#AbCdEfGhIjKlMnOpQrStUv");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg).toContain("<path");
    expect(dense).toBe(false);
  });

  it("flags a full-length link as too dense to scan comfortably", async () => {
    const full = `https://hush.md/d/${"a".repeat(22)}#k=${"b".repeat(43)}&e=${"c".repeat(43)}`;
    expect((await makeQr(full)).dense).toBe(true);
  });
});
