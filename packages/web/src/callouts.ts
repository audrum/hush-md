// Obsidian-style callouts: a blockquote whose first line is [!type] Title.
// Done as a DOM pass after sanitization — markdown-it has already produced a
// plain blockquote, and all this does is relabel it. No new markup path.

// All thirteen of Obsidian's callout types, each with its own icon. Obsidian
// deliberately reuses colour across families (info and todo are both blue,
// failure/danger/bug all red), so the icon is what carries the distinction —
// which means every type needs its own, or they collapse into each other.
const ICONS: Record<string, string> = {
  note: `<path d="M4.6 15.4v-2.1L14 3.9a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1l-9.4 9.4H4.6z"/><path d="m12.7 5.2 2.5 2.5"/>`,
  abstract: `<path d="M7.6 4.6H6.2a1.5 1.5 0 0 0-1.5 1.5v9.1a1.5 1.5 0 0 0 1.5 1.5h7.6a1.5 1.5 0 0 0 1.5-1.5V6.1a1.5 1.5 0 0 0-1.5-1.5h-1.4"/><rect x="7.6" y="3.1" width="4.8" height="3" rx="1"/><path d="M7.8 10h4.4M7.8 12.8h2.8"/>`,
  info: `<circle cx="10" cy="10" r="7"/><path d="M10 9.3v4.3M10 6.5v.4"/>`,
  todo: `<circle cx="10" cy="10" r="7"/><path d="m6.8 10.1 2.2 2.2 4.2-4.4"/>`,
  tip: `<path d="M10 3.2c2.6 2.4 4.6 4.4 4.6 7.3a4.6 4.6 0 1 1-9.2 0c0-1.4.5-2.6 1.5-3.7.3 1 .9 1.6 1.7 1.9-.2-2 .3-3.8 1.4-5.5Z"/>`,
  success: `<path d="m4.8 10.6 3.6 3.6L15.4 6"/>`,
  question: `<circle cx="10" cy="10" r="7"/><path d="M8.2 8a1.9 1.9 0 1 1 2.4 2.2c-.5.2-.6.6-.6 1.1"/><path d="M10 13.6v.3"/>`,
  warning: `<path d="M10 3.5 17.5 16.5H2.5Z"/><path d="M10 8.5v3.5M10 14.2v.3"/>`,
  failure: `<circle cx="10" cy="10" r="7"/><path d="m7.7 7.7 4.6 4.6M12.3 7.7l-4.6 4.6"/>`,
  danger: `<path d="M11.2 2.9 5.4 11.3h4L8.8 17.1l5.8-8.4h-4z"/>`,
  bug: `<path d="M7 8.6a3 3 0 0 1 6 0v2.9a3 3 0 0 1-6 0z"/><path d="M7.1 7.2 5.9 6M12.9 7.2 14.1 6M7 10.1H4.5M13 10.1h2.5M7.2 12.9l-1.3 1.3M12.8 12.9l1.3 1.3"/>`,
  example: `<path d="M8.2 6h7.3M8.2 10h7.3M8.2 14h7.3"/><path d="M4.8 6h.02M4.8 10h.02M4.8 14h.02"/>`,
  quote: `<path d="M8 6.5C6 7.4 5 9 5 11.2c0 1.6 1 2.8 2.4 2.8 1.2 0 2.1-.9 2.1-2.1 0-1.2-.8-2-1.9-2-.2 0-.4 0-.5.1.2-1 .9-1.9 1.9-2.5Z"/><path d="M15 6.5c-2 .9-3 2.5-3 4.7 0 1.6 1 2.8 2.4 2.8 1.2 0 2.1-.9 2.1-2.1 0-1.2-.8-2-1.9-2-.2 0-.4 0-.5.1.2-1 .9-1.9 1.9-2.5Z"/>`,
};

// Obsidian's documented aliases. Each folds onto the type it is an alias
// *of* — not onto a nearby type, which is what previously made bug, failure
// and danger indistinguishable.
const ALIASES: Record<string, string> = {
  summary: "abstract", tldr: "abstract",
  hint: "tip", important: "tip",
  check: "success", done: "success",
  help: "question", faq: "question",
  caution: "warning", attention: "warning",
  fail: "failure", missing: "failure",
  error: "danger",
  cite: "quote",
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
