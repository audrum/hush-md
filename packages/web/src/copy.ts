// Copy-to-clipboard affordances: one for the whole document, one per code
// block. Both are built from authored constants and attached as real DOM
// nodes — no copy markup ever passes through the markdown/sanitize pipeline.

export const COPY_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><rect x="9" y="8.5" width="11" height="11.5" rx="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 5.6A1.6 1.6 0 0 0 13.9 4H6a2 2 0 0 0-2 2v7.9a1.6 1.6 0 0 0 1.6 1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 12.4 9.8 17.2 19 6.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FLASH_MS = 1600;

// Toolbar button markup. id and label are authored call-site constants.
export function copyIconHTML(id: string, label: string): string {
  return `<button id="${id}" class="icon-btn copy-btn" type="button" title="${label}" aria-label="${label}">${COPY_SVG}</button>`;
}

async function flash(btn: HTMLButtonElement, text: string, fallback?: Element | null): Promise<void> {
  const restore = btn.title;
  try {
    await navigator.clipboard.writeText(text);
    btn.innerHTML = CHECK_SVG;
    btn.classList.add("copied");
  } catch {
    // Clipboard denied: select the text so the keyboard shortcut still works.
    if (fallback) {
      const range = document.createRange();
      range.selectNodeContents(fallback);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    btn.title = "Copy blocked by the browser. Use the keyboard shortcut";
    btn.classList.add("copy-failed");
  }
  setTimeout(() => {
    btn.innerHTML = COPY_SVG;
    btn.title = restore;
    btn.classList.remove("copied", "copy-failed");
  }, FLASH_MS);
}

export function wireCopyText(btn: HTMLButtonElement, getText: () => string): void {
  btn.addEventListener("click", () => flash(btn, getText()));
}

// Called after every preview render: the container's innerHTML is replaced
// wholesale, so the wrappers and buttons are rebuilt each time.
export function decorateCodeBlocks(root: HTMLElement): void {
  root.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement?.classList.contains("code-block")) return;
    // Mermaid blocks become diagrams, not code the reader wants on a clipboard.
    if (pre.querySelector("code.language-mermaid")) return;
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy";
    btn.title = "Copy code";
    btn.setAttribute("aria-label", "Copy code");
    btn.innerHTML = COPY_SVG;
    wrap.appendChild(btn);
  });
}

// Delegated so it survives the preview being re-rendered on every keystroke.
export function wireCodeCopy(root: HTMLElement): void {
  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button.code-copy");
    if (!btn) return;
    const source = btn.parentElement?.querySelector("code") ?? btn.parentElement?.querySelector("pre");
    void flash(btn, source?.textContent ?? "", source);
  });
}
