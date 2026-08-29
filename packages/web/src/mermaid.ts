import DOMPurify from "dompurify";
import { currentTheme } from "./theme.ts";

// Mermaid is the heaviest thing in the app by far, so it is imported only when
// a document actually contains a diagram. Its SVG output is sanitized before
// it goes into the page: mermaid's own strict mode already refuses scripts and
// click handlers, and DOMPurify is the second lock on someone else's diagram.

let mermaidModule: Promise<typeof import("mermaid")> | undefined;
let configuredFor: string | undefined;
let seq = 0;

export function mermaidBlocks(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("pre > code.language-mermaid")];
}

async function load(theme: string) {
  mermaidModule ??= import("mermaid");
  const mermaid = (await mermaidModule).default;
  if (configuredFor !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      // Labels must be SVG <text>, not HTML in a <foreignObject>: sanitizing
      // the diagram strips foreignObject, which silently erases every label.
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    });
    configuredFor = theme;
  }
  return mermaid;
}

export async function decorateMermaid(root: HTMLElement, stillCurrent: () => boolean): Promise<void> {
  const blocks = mermaidBlocks(root);
  if (blocks.length === 0) return;
  const theme = currentTheme();
  let mermaid;
  try {
    mermaid = await load(theme);
  } catch {
    return; // chunk failed to load: the diagram source stays readable as code
  }
  if (!stillCurrent()) return;

  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre) continue;
    const source = code.textContent ?? "";
    const figure = document.createElement("figure");
    figure.className = "mermaid-figure";
    try {
      const { svg } = await mermaid.render(`hush-mmd-${++seq}`, source);
      if (!stillCurrent()) return;
      figure.innerHTML = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true, html: true },
      });
    } catch {
      // A syntax error in the diagram must not cost the reader its content.
      figure.className = "mermaid-figure mermaid-failed";
      const fallback = document.createElement("pre");
      const codeEl = document.createElement("code");
      codeEl.textContent = source;
      fallback.appendChild(codeEl);
      const note = document.createElement("p");
      note.className = "mermaid-note";
      note.textContent = "This diagram could not be drawn. Its source is below.";
      figure.append(note, fallback);
    }
    if (!stillCurrent()) return;
    (pre.parentElement?.classList.contains("code-block") ? pre.parentElement : pre).replaceWith(figure);
  }
}
