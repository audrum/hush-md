// Tables get a scroll wrapper so the table itself can stay a real table.
//
// The alternative — `display: block; overflow-x: auto` straight on the table —
// makes its columns size to their content, so one table came out narrower than
// the next and each sat left inside a wider block. Moving the overflow onto a
// wrapper lets every table share one width and its columns share that width
// between them, while a genuinely oversized table still scrolls in its own box.
//
// Built as DOM nodes after sanitising, like the code-block wrappers, so no
// markup crosses the markdown pipeline.

export function decorateTables(root: HTMLElement): void {
  root.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("table-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });
}
