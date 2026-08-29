// Obsidian-style callouts: a blockquote whose first line is [!type] Title.
// Done as a DOM pass after sanitization — markdown-it has already produced a
// plain blockquote, and all this does is relabel it. No new markup path.

const ICONS: Record<string, string> = {
  note: `<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v9A1.5 1.5 0 0 1 14.5 16h-9A1.5 1.5 0 0 1 4 14.5Z"/><path d="M7 8h6M7 11h4"/>`,
  tip: `<path d="M10 3a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9Z"/><path d="M8.5 17h3"/>`,
  warning: `<path d="M10 3.5 17.5 16.5H2.5Z"/><path d="M10 8.5v3.5M10 14.2v.3"/>`,
  danger: `<circle cx="10" cy="10" r="7"/><path d="M10 6v4.5M10 13.2v.3"/>`,
  success: `<circle cx="10" cy="10" r="7"/><path d="m6.6 10.2 2.3 2.3 4.5-4.7"/>`,
  question: `<circle cx="10" cy="10" r="7"/><path d="M8.2 8a1.9 1.9 0 1 1 2.4 2.2c-.5.2-.6.6-.6 1.1"/><path d="M10 13.6v.3"/>`,
  quote: `<path d="M8 6.5C6 7.4 5 9 5 11.2c0 1.6 1 2.8 2.4 2.8 1.2 0 2.1-.9 2.1-2.1 0-1.2-.8-2-1.9-2-.2 0-.4 0-.5.1.2-1 .9-1.9 1.9-2.5Z"/><path d="M15 6.5c-2 .9-3 2.5-3 4.7 0 1.6 1 2.8 2.4 2.8 1.2 0 2.1-.9 2.1-2.1 0-1.2-.8-2-1.9-2-.2 0-.4 0-.5.1.2-1 .9-1.9 1.9-2.5Z"/>`,
};

// Obsidian's aliases, folded onto the kinds we actually style.
const ALIASES: Record<string, string> = {
  abstract: "note", summary: "note", info: "note", todo: "note",
  hint: "tip", important: "tip",
  caution: "warning", attention: "warning",
  error: "danger", bug: "danger", failure: "danger", missing: "danger",
  check: "success", done: "success",
  faq: "question", help: "question",
  cite: "quote", example: "note",
};

const MARKER = /^\[!([A-Za-z]+)\]([+-])?\s*(.*)$/;

function iconFor(kind: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  // Path data is an authored constant keyed by a validated kind.
  svg.innerHTML = ICONS[kind] ?? ICONS.note;
  return svg;
}

export function decorateCallouts(root: HTMLElement): void {
  root.querySelectorAll("blockquote").forEach((quote) => {
    if (quote.classList.contains("callout")) return;
    const first = quote.firstElementChild;
    if (!(first instanceof HTMLParagraphElement)) return;
    const lead = first.firstChild;
    if (!lead || lead.nodeType !== Node.TEXT_NODE) return;
    // The marker occupies the first line only; the body follows in the same
    // text node, separated by a newline (markdown-it runs with breaks: false).
    const text = lead.textContent ?? "";
    const nl = text.indexOf("\n");
    const m = MARKER.exec(nl === -1 ? text : text.slice(0, nl));
    if (!m) return;

    const raw = m[1].toLowerCase();
    const kind = ICONS[raw] ? raw : (ALIASES[raw] ?? "note");
    const title = m[3].trim() || raw.charAt(0).toUpperCase() + raw.slice(1);

    lead.textContent = nl === -1 ? "" : text.slice(nl + 1);
    if (first.firstChild?.nodeName === "BR") first.firstChild.remove();
    if (!first.textContent?.trim() && first.childElementCount === 0) first.remove();

    const header = document.createElement("div");
    header.className = "callout-title";
    header.appendChild(iconFor(kind));
    const label = document.createElement("span");
    label.textContent = title;
    header.appendChild(label);

    quote.classList.add("callout", `callout-${kind}`);
    quote.prepend(header);
  });
}
