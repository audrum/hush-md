import { renderComplete } from "./preview.ts";
import { hasMath } from "./math.ts";

// Self-contained HTML export: one file, no network dependencies, readable
// years from now with nothing but a browser. Diagrams are already inline SVG
// and math is already plain markup; the work here is collecting the styles
// that make them look right and embedding the fonts they need.

const KEEP = [":root", "[data-theme", "html", "body", "*", ".doc", ".callout", ".hush-math", ".mermaid", ".secret-"];

function wanted(selector: string): boolean {
  return KEEP.some((prefix) => selector.split(",").some((s) => s.trim().startsWith(prefix)));
}

function isKatexSheet(sheet: CSSStyleSheet): boolean {
  return (sheet.href ?? "").includes("katex");
}

function collectCss(needMath: boolean): { css: string; fontFaces: CSSFontFaceRule[] } {
  const parts: string[] = [];
  const fontFaces: CSSFontFaceRule[] = [];
  for (const sheet of [...document.styleSheets] as CSSStyleSheet[]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet, nothing we can read or need
    }
    const katex = isKatexSheet(sheet);
    if (katex && !needMath) continue;
    for (const rule of [...rules]) {
      if (rule instanceof CSSFontFaceRule) {
        if (katex) fontFaces.push(rule);
        continue;
      }
      if (katex) {
        parts.push(rule.cssText);
        continue;
      }
      if (rule instanceof CSSStyleRule && wanted(rule.selectorText)) parts.push(rule.cssText);
      else if (rule instanceof CSSMediaRule && [...rule.cssRules].some((r) => r instanceof CSSStyleRule && wanted(r.selectorText))) {
        parts.push(rule.cssText);
      }
    }
  }
  return { css: parts.join("\n"), fontFaces };
}

function toBase64(bytes: ArrayBuffer): string {
  let s = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) s += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(s);
}

// KaTeX's stylesheet points at same-origin woff2 files. An exported file has no
// origin to resolve them against, so each one is fetched now and embedded.
async function inlineFonts(rules: CSSFontFaceRule[]): Promise<string> {
  const out = await Promise.all(
    rules.map(async (rule) => {
      const match = /url\(["']?([^"')]+\.woff2)["']?\)/.exec(rule.cssText);
      if (!match) return "";
      try {
        const res = await fetch(match[1]);
        if (!res.ok) return "";
        const data = toBase64(await res.arrayBuffer());
        // Rebuilt rather than patched: each rule also lists .woff and .ttf
        // fallbacks by absolute path, which would be dead links in a file that
        // is supposed to stand alone. woff2 alone covers every current browser.
        const s = rule.style;
        const descriptors = ["font-family", "font-style", "font-weight", "unicode-range"]
          .map((d) => (s.getPropertyValue(d) ? `${d}:${s.getPropertyValue(d)};` : ""))
          .join("");
        return `@font-face{${descriptors}src:url(data:font/woff2;base64,${data}) format("woff2");}`;
      } catch {
        return "";
      }
    }),
  );
  return out.filter(Boolean).join("\n");
}

// Buttons and chips depend on the app's JavaScript. In a static file they would
// be dead controls, so they are replaced by what they stood for.
function staticize(root: HTMLElement): void {
  root.querySelectorAll(".code-copy").forEach((b) => b.remove());
  root.querySelectorAll(".code-block").forEach((wrap) => {
    const pre = wrap.querySelector("pre");
    if (pre) wrap.replaceWith(pre);
  });
  root.querySelectorAll(".secret-chip").forEach((chip) => {
    const note = document.createElement("em");
    note.className = "secret-static";
    note.textContent = "[burn-once secret, available only in the live document]";
    chip.replaceWith(note);
  });
}

export async function buildExport(markdown: string): Promise<{ html: string; filename: string }> {
  const rendered = await renderComplete(markdown);
  staticize(rendered);

  const needMath = hasMath(rendered);
  const { css, fontFaces } = collectCss(needMath);
  const fonts = needMath ? await inlineFonts(fontFaces) : "";

  const heading = rendered.querySelector("h1, h2")?.textContent?.trim();
  const title = heading && heading.length > 0 ? heading : "hush.md document";

  const doc = document.implementation.createHTMLDocument(title);
  doc.documentElement.setAttribute("lang", "en");
  const meta = doc.createElement("meta");
  meta.setAttribute("name", "viewport");
  meta.setAttribute("content", "width=device-width, initial-scale=1");
  const charset = doc.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const style = doc.createElement("style");
  style.textContent = `${fonts}\n${css}\n.doc{max-width:44rem;margin:3rem auto;padding:0 1.25rem;}`;
  doc.head.prepend(charset, meta, style);
  doc.body.appendChild(doc.importNode(rendered, true));

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "document";
  return { html: `<!doctype html>\n${doc.documentElement.outerHTML}\n`, filename: `${slug}.html` };
}

export async function downloadExport(markdown: string): Promise<void> {
  const { html, filename } = await buildExport(markdown);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
