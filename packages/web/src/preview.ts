import { renderMarkdown } from "./render.ts";
import { decorateCodeBlocks } from "./copy.ts";

// The single way markdown reaches the screen: sanitize first, decorate after.
// Keeping the order here (rather than at each call site) is what guarantees no
// affordance markup can be introduced before DOMPurify has run.
export function renderPreview(el: HTMLElement, src: string): void {
  el.innerHTML = renderMarkdown(src);
  decorateCodeBlocks(el);
}
