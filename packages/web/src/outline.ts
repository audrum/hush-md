// The document outline: a third pane listing the headings of the rendered
// document. It reads the preview DOM rather than re-parsing the markdown,
// because that DOM has already been through DOMPurify and is the only
// authority on what is actually on screen. Heading ids are assigned during
// decoration, on the safe side of the sanitizer — the same rule that governs
// the code-copy buttons, callouts and secret chips.

const HEADINGS = "h1,h2,h3,h4";
const OPEN_KEY = "hush-outline";
const SCROLL_MARGIN = 12;

export interface OutlineEntry {
  id: string;
  level: number;
  text: string;
}

const OUTLINE_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="6.5" x2="20" y2="6.5"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="17.5" x2="16" y2="17.5"/></g></svg>`;

// Ids are generated, never derived from heading text: sequential ids are
// unique by construction, so two headings with the same title cannot collide.
export function decorateHeadings(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(HEADINGS).forEach((h, i) => {
    if (!h.id) h.id = `hush-h-${i}`;
  });
}

export function readOutline(root: HTMLElement): OutlineEntry[] {
  return [...root.querySelectorAll<HTMLElement>(HEADINGS)].map((h) => ({
    id: h.id,
    level: Number(h.tagName[1]),
    text: h.textContent?.trim() ?? "",
  }));
}

export function renderOutline(panel: HTMLElement, entries: OutlineEntry[], onPick: (id: string) => void): void {
  panel.replaceChildren();
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "outline-empty";
    empty.textContent = "No headings yet. Start a line with # and it appears here.";
    panel.appendChild(empty);
    return;
  }
  const nav = document.createElement("nav");
  nav.className = "outline-list";
  nav.setAttribute("aria-label", "Document outline");
  for (const entry of entries) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `outline-item outline-l${entry.level}`;
    item.dataset.target = entry.id;
    // Heading text arrives as text, so markup inside a heading cannot execute.
    item.textContent = entry.text;
    item.addEventListener("click", () => onPick(entry.id));
    nav.appendChild(item);
  }
  panel.appendChild(nav);
}

export function outlineToggleHTML(): string {
  return `<button id="outline-toggle" class="icon-btn" type="button" aria-pressed="false"
    title="Show the document outline" aria-label="Show the document outline">${OUTLINE_SVG}</button>`;
}

export function storedOutlineOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function storeOutlineOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // Private mode: the panel still opens for this page view.
  }
}

// Scrolls the preview pane itself rather than calling scrollIntoView, which
// would also scroll the page and can drag the toolbar off screen.
function scrollToHeading(preview: HTMLElement, id: string): void {
  const target = preview.querySelector<HTMLElement>(`[id="${id}"]`);
  if (!target) return;
  preview.scrollTop += target.getBoundingClientRect().top - preview.getBoundingClientRect().top - SCROLL_MARGIN;
}

// The outline is orthogonal to the Write/Split/Preview modes: it is useful in
// all three, and it is the one pane a read-only reader still benefits from.
export function wireOutline(
  root: ParentNode,
  panel: HTMLElement,
  preview: HTMLElement,
  doc: HTMLElement,
): { refresh: () => void } {
  const btn = root.querySelector<HTMLButtonElement>("#outline-toggle");
  const refresh = () => {
    if (panel.hidden) return; // nothing to rebuild while it is closed
    renderOutline(panel, readOutline(doc), (id) => scrollToHeading(preview, id));
  };

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    btn?.setAttribute("aria-pressed", String(open));
    btn?.classList.toggle("active", open);
    const label = open ? "Hide the document outline" : "Show the document outline";
    btn?.setAttribute("aria-label", label);
    if (btn) btn.title = label;
    refresh();
  };

  setOpen(storedOutlineOpen());
  btn?.addEventListener("click", () => {
    // `hidden` is boolean | "until-found" in the DOM types, so narrow it.
    const open = Boolean(panel.hidden);
    storeOutlineOpen(open);
    setOpen(open);
  });
  return { refresh };
}
