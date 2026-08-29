import type MarkdownIt from "markdown-it";

// TeX never reaches the DOM as markup. The markdown-it rules below emit an
// empty element carrying the source in a data attribute, so DOMPurify sees
// only an attribute value; KaTeX renders into that element afterwards, on the
// safe side of the sanitizer. Same shape as the secret chips and code buttons.

const DOLLAR = 0x24;
const BACKSLASH = 0x5c;

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

// Inline: $x^2$. Deliberately conservative so prose about money is not math:
// no whitespace just inside the delimiters, and no digit right after the close
// (which is what "$5 and $10" looks like).
function mathInline(state: any, silent: boolean): boolean {
  const src: string = state.src;
  const start: number = state.pos;
  if (src.charCodeAt(start) !== DOLLAR) return false;
  if (src.charCodeAt(start + 1) === DOLLAR) return false; // display form
  if (start > 0 && src.charCodeAt(start - 1) === BACKSLASH) return false;

  let end = -1;
  for (let i = start + 1; i < state.posMax; i++) {
    if (src.charCodeAt(i) === BACKSLASH) {
      i++;
      continue;
    }
    if (src.charCodeAt(i) === DOLLAR) {
      end = i;
      break;
    }
  }
  if (end < 0) return false;

  const tex = src.slice(start + 1, end);
  if (tex.length === 0) return false;
  if (isSpace(tex[0]) || isSpace(tex[tex.length - 1])) return false;
  if (/^\d/.test(src.slice(end + 1))) return false;

  if (!silent) {
    const token = state.push("hush_math_inline", "", 0);
    token.meta = { tex };
  }
  state.pos = end + 1;
  return true;
}

// Block: $$ on its own line, TeX, then $$ on its own line. A single-line
// $$x$$ is accepted too.
function mathBlock(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  const begin = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false; // indented code
  if (begin + 2 > max) return false;
  if (state.src.slice(begin, begin + 2) !== "$$") return false;

  const firstLine = state.src.slice(begin + 2, max);
  let tex = "";
  let line = startLine;
  let closed = false;

  if (firstLine.trimEnd().endsWith("$$") && firstLine.trim().length > 2) {
    tex = firstLine.trimEnd().slice(0, -2);
    closed = true;
  } else {
    tex = firstLine;
    while (!closed && ++line < endLine) {
      const from = state.bMarks[line] + state.tShift[line];
      const to = state.eMarks[line];
      const text = state.src.slice(from, to);
      if (text.trim() === "$$") {
        closed = true;
        break;
      }
      tex += `\n${text}`;
    }
  }
  if (!closed) return false;
  if (silent) return true;

  state.line = line + 1;
  const token = state.push("hush_math_block", "", 0);
  token.meta = { tex: tex.trim() };
  token.map = [startLine, state.line];
  token.block = true;
  return true;
}

export function mathPlugin(md: InstanceType<typeof MarkdownIt>): void {
  md.inline.ruler.before("escape", "hush_math_inline", mathInline);
  md.block.ruler.before("fence", "hush_math_block", mathBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  const attr = (tex: string) => md.utils.escapeHtml(tex);
  md.renderer.rules.hush_math_inline = (tokens: any[], i: number) =>
    `<span class="hush-math" data-tex="${attr(tokens[i].meta.tex)}"></span>`;
  md.renderer.rules.hush_math_block = (tokens: any[], i: number) =>
    `<div class="hush-math hush-math-block" data-tex="${attr(tokens[i].meta.tex)}"></div>\n`;
}

// KaTeX is ~280 KB, so it only arrives once a document actually contains math.
let katexModule: Promise<typeof import("katex")> | undefined;

export function hasMath(root: ParentNode): boolean {
  return root.querySelector(".hush-math") !== null;
}

export async function decorateMath(root: HTMLElement, stillCurrent: () => boolean): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>(".hush-math")];
  if (nodes.length === 0) return;
  katexModule ??= Promise.all([import("katex"), import("./katex-bundle.ts")]).then(([lib]) => lib);
  let katex;
  try {
    katex = (await katexModule).default;
  } catch {
    return; // chunk failed to load: the TeX source stays in the data attribute
  }
  if (!stillCurrent()) return;
  for (const el of nodes) {
    const tex = el.dataset.tex ?? "";
    try {
      katex.render(tex, el, {
        displayMode: el.classList.contains("hush-math-block"),
        throwOnError: false,
        output: "htmlAndMathml",
       // KaTeX's own guard against \includegraphics-style escapes.
        trust: false,
        strict: false,
      });
    } catch {
      // KaTeX only throws here for non-TeX reasons; keep the source visible.
      el.textContent = tex;
      el.classList.add("hush-math-failed");
    }
  }
}
