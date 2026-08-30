// Split-pane behaviour: a draggable divider, proportional scroll sync between
// the two panes, and the arithmetic that keeps the preview from jumping when
// it re-renders. The maths lives in pure functions so it can be tested without
// a layout engine — jsdom reports every height as zero.

export const MIN_RATIO = 0.15;
export const MAX_RATIO = 0.85;
const DEFAULT_RATIO = 0.5;
const RATIO_KEY = "hush-split";
const KEY_STEP = 0.02;

export interface Scrollable {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

// Neither pane may be dragged away to nothing: a sliver of editor is useless,
// and a sliver of preview is worse, because that is where the reader looks.
export function clampRatio(r: number): number {
  if (Number.isNaN(r)) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

export function ratioFromPointer(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return DEFAULT_RATIO;
  return clampRatio((clientX - rect.left) / rect.width);
}

// Proportional sync: the fraction of its own travel that one pane has covered
// becomes the fraction the other covers. Deliberately not line-anchored, so a
// tall diagram or display formula can drift from its short source. The ends
// are exact, which is what makes "scrolled to the bottom" agree in both panes.
export function syncTarget(source: Scrollable, target: Scrollable): number {
  const sourceTravel = source.scrollHeight - source.clientHeight;
  const targetTravel = target.scrollHeight - target.clientHeight;
  if (sourceTravel <= 0 || targetTravel <= 0) return 0;
  return (source.scrollTop / sourceTravel) * targetTravel;
}

// The preview re-renders on every keystroke, and its asynchronous decorations
// (Mermaid, KaTeX) arrive after the browser has already laid out a document
// that is briefly much shorter. That momentarily clamps scrollTop, and the
// reader is left somewhere they never scrolled to. Restore only when the
// position really was clamped and the reader has not moved since — otherwise
// we would be yanking a deliberate scroll back.
export function shouldRestore(wanted: number, settled: number, now: number): boolean {
  return settled !== wanted && now === settled;
}

export function storedRatio(): number {
  try {
    const v = localStorage.getItem(RATIO_KEY);
    return v === null ? DEFAULT_RATIO : clampRatio(Number(v));
  } catch {
    return DEFAULT_RATIO;
  }
}

function storeRatio(r: number): void {
  try {
    localStorage.setItem(RATIO_KEY, String(r));
  } catch {
    // Private mode: the split still resizes for this page view.
  }
}

export function applyRatio(split: HTMLElement, r: number): void {
  const ratio = clampRatio(r);
  split.style.setProperty("--split", `${(ratio * 100).toFixed(2)}%`);
  const handle = split.querySelector<HTMLElement>(".split-resizer");
  handle?.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
}

// The divider moves through the editor/preview region only. Measuring the whole
// split would offset every drag by the width of the outline, a pane the divider
// does not move.
function dragRegion(split: HTMLElement): { left: number; width: number } {
  return (split.querySelector<HTMLElement>(".split-panes") ?? split).getBoundingClientRect();
}

export function resizerHTML(): string {
  return `<div class="split-resizer" role="separator" aria-orientation="vertical"
    aria-label="Resize the editor and preview panes" aria-valuemin="${Math.round(MIN_RATIO * 100)}"
    aria-valuemax="${Math.round(MAX_RATIO * 100)}" aria-valuenow="50" tabindex="0"></div>`;
}

export function wireResizer(split: HTMLElement): void {
  const handle = split.querySelector<HTMLElement>(".split-resizer");
  if (!handle) return;
  applyRatio(split, storedRatio());

  const set = (r: number, persist: boolean) => {
    applyRatio(split, r);
    if (persist) storeRatio(clampRatio(r));
  };

  handle.addEventListener("pointerdown", (e) => {
    // preventDefault stops the drag selecting text under the cursor, but it also
    // suppresses the focus a click would otherwise give, which would leave the
    // keyboard handlers below unreachable for anyone who clicked the handle.
    e.preventDefault();
    handle.focus();
    handle.setPointerCapture(e.pointerId);
    split.classList.add("resizing");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    set(ratioFromPointer(e.clientX, dragRegion(split)), false);
  });
  const end = (e: PointerEvent) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    handle.releasePointerCapture(e.pointerId);
    split.classList.remove("resizing");
    set(ratioFromPointer(e.clientX, dragRegion(split)), true);
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);

  // A separator that only responds to a drag is unreachable from the keyboard.
  handle.addEventListener("keydown", (e) => {
    const current = clampRatio(parseFloat(handle.getAttribute("aria-valuenow") ?? "50") / 100);
    if (e.key === "ArrowLeft") set(current - KEY_STEP, true);
    else if (e.key === "ArrowRight") set(current + KEY_STEP, true);
    else if (e.key === "Home" || e.key === "Enter") set(DEFAULT_RATIO, true);
    else return;
    e.preventDefault();
  });
  handle.addEventListener("dblclick", () => set(DEFAULT_RATIO, true));
}

// How long after the last scroll event a gesture is considered finished. Long
// enough to span Safari's momentum scrolling, which keeps firing events well
// after the fingers leave the trackpad; short enough that deliberately grabbing
// the other pane feels immediate.
const SETTLE_MS = 150;

// One pane owns a gesture until scrolling actually stops.
//
// The obvious guard — set a flag, clear it next animation frame — is wrong, and
// this is the bug it caused. Nothing guarantees the induced scroll event arrives
// within one frame; Safari dispatches on its own cadence and adds momentum, so
// the flag was routinely clear again by the time the other pane reported in.
// The other pane then drove back. Because the two panes have different travel,
// mapping A onto B and B back onto A does not land where A started, and the
// rounding error accumulates in one direction: the document creeps upward on
// its own, and a scrollbar drag is fought every frame by the write coming back.
export function createSyncGate(settleMs: number = SETTLE_MS) {
  let owner: unknown = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    claim(source: unknown): boolean {
      // A refused claim must not refresh the timer, or the pane being driven
      // would keep renewing a turn that is not its own.
      if (owner !== null && owner !== source) return false;
      owner = source;
      clearTimeout(timer);
      timer = setTimeout(() => {
        owner = null;
      }, settleMs);
      return true;
    },
  };
}

// Sub-pixel corrections are not worth writing: they move nothing a reader can
// see, and they are exactly the residue that accumulates into creep.
export function worthWriting(current: number, next: number): boolean {
  return Math.abs(current - next) >= 1;
}

// Scroll sync runs only in split mode: in Write or Preview there is one pane on
// screen, and syncing a hidden pane just fights the reader when they switch back.
export function wireScrollSync(split: HTMLElement, editor: HTMLElement, preview: HTMLElement): void {
  const gate = createSyncGate();
  const link = (from: HTMLElement, to: HTMLElement) => () => {
    const mode = split.dataset.mode;
    if (mode && mode !== "split") return;
    if (!gate.claim(from)) return;
    const next = syncTarget(from, to);
    if (!worthWriting(to.scrollTop, next)) return;
    to.scrollTop = next;
  };
  editor.addEventListener("scroll", link(editor, preview), { passive: true });
  preview.addEventListener("scroll", link(preview, editor), { passive: true });
}
