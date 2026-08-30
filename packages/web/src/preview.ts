import { renderMarkdown } from "./render.ts";
import { decorateCodeBlocks } from "./copy.ts";
import { decorateCallouts } from "./callouts.ts";
import { decorateMath } from "./math.ts";
import { decorateMermaid } from "./mermaid.ts";
import { decorateHeadings } from "./outline.ts";
import { shouldRestore } from "./split.ts";

// The single way markdown reaches the screen: sanitize first, decorate after.
// Keeping the order here (rather than at each call site) is what guarantees no
// affordance or renderer markup can be introduced before DOMPurify has run.
//
// Decoration is partly async (KaTeX and Mermaid are loaded on demand), while
// the preview re-renders on every keystroke. Each render bumps a generation
// counter; async work checks it and abandons results for a superseded render.

const state = new WeakMap<HTMLElement, { seq: number; src: string }>();

export const THEME_EVENT = "hush:theme";

export function renderPreview(el: HTMLElement, src: string): Promise<void> {
  const s = state.get(el) ?? { seq: 0, src };
  s.seq += 1;
  s.src = src;
  state.set(el, s);
  const mine = s.seq;
  const stillCurrent = () => state.get(el)?.seq === mine;

  // The pane, not the document element, is what scrolls. Replacing the whole
  // document below throws away its height for a moment, and the async
  // decorations only give it back a frame or two later, so the reader's
  // position has to be carried across by hand.
  const scroller = el.closest<HTMLElement>(".pane-preview");
  const wanted = scroller?.scrollTop ?? 0;

  el.innerHTML = renderMarkdown(src);
  decorateCodeBlocks(el);
  decorateCallouts(el);
  decorateHeadings(el);

  let settled = wanted;
  if (scroller) {
    scroller.scrollTop = wanted;
    settled = scroller.scrollTop; // the browser clamps this to the new height
  }

  return Promise.all([decorateMath(el, stillCurrent), decorateMermaid(el, stillCurrent)]).then(() => {
    // Diagrams and formulas have their real height now. If the position was
    // clamped on the way in and the reader has not scrolled since, put it back.
    if (scroller && stillCurrent() && shouldRestore(wanted, settled, scroller.scrollTop)) {
      scroller.scrollTop = wanted;
    }
  });
}

// Mermaid bakes the theme into its SVG, so a theme switch has to redraw.
export function wireThemedPreview(el: HTMLElement): void {
  document.addEventListener(THEME_EVENT, () => {
    const s = state.get(el);
    if (s && el.isConnected) void renderPreview(el, s.src);
  });
}

// Renders into a detached element and waits for every decoration to settle.
// Used by the export path, which needs the finished DOM rather than the live
// preview's in-progress one.
export async function renderComplete(src: string): Promise<HTMLElement> {
  const el = document.createElement("div");
  el.className = "doc";
  await renderPreview(el, src);
  return el;
}
