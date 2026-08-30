import { currentTheme, toggleTheme } from "./theme.ts";
import { api } from "./api.ts";
import { makeShortLink } from "./crypto-flows.ts";
import { THEME_EVENT } from "./preview.ts";

export const LOGO_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path d="M7 9.5 L13.5 16 L7 22.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.5" cy="21.9" r="1.95" fill="currentColor"/><circle cx="23.5" cy="21.9" r="1.95" fill="currentColor" opacity="0.45"/><circle cx="28.2" cy="21.9" r="1.95" fill="var(--accent)"/></svg>`;

const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="7" y2="7"/><line x1="17" y1="17" x2="18.7" y2="18.7"/><line x1="5.3" y1="18.7" x2="7" y2="17"/><line x1="17" y1="7" x2="18.7" y2="5.3"/></g></svg>`;

const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A6.8 6.8 0 0 0 20 14.5 Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

export function toolbarHTML(actions = ""): string {
  return `<header class="toolbar">
    <a class="brand" href="/" aria-label="hush.md, new document">
      <span class="brand-glyph">${LOGO_SVG}</span>
      <span class="brand-name">hush<span class="brand-ext"><span class="brand-dot">.</span>md</span></span>
    </a>
    <nav class="toolbar-nav"><a href="/about">about</a></nav>
    <span class="spacer"></span>
    ${actions}
    <button id="theme-toggle" class="icon-btn" type="button" aria-label="Switch to dark theme"></button>
  </header>`;
}

export function wireThemeToggle(root: ParentNode): void {
  const btn = root.querySelector<HTMLButtonElement>("#theme-toggle");
  if (!btn) return;
  const paint = () => {
    const dark = currentTheme() === "dark";
    btn.innerHTML = dark ? SUN_SVG : MOON_SVG;
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  paint();
  btn.addEventListener("click", () => {
    toggleTheme();
    paint();
    // Renderers that bake the theme into their output (Mermaid) redraw on this.
    document.dispatchEvent(new CustomEvent(THEME_EVENT));
  });
}

export function modeToggleHTML(active: "edit" | "split" | "preview" = "split"): string {
  const btn = (mode: string, label: string) =>
    `<button type="button" data-mode="${mode}"${mode === active ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"'}>${label}</button>`;
  return `<div class="mode-toggle" role="group" aria-label="Editor layout">
    ${btn("edit", "Write")}${btn("split", "Split")}${btn("preview", "Preview")}
  </div>`;
}

export function wireModeToggle(root: ParentNode, split: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>(".mode-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      root.querySelectorAll<HTMLButtonElement>(".mode-toggle button").forEach((x) => {
        x.classList.remove("active");
        x.setAttribute("aria-pressed", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      split.dataset.mode = b.dataset.mode;
    });
  });
}

export interface ShareModalOpts {
  editUrl?: string;
  viewUrl: string;
  meta?: string;
  expiresAt?: number;
  docId?: string;
  primaryLabel?: string;
  onClose?: () => void;
}

function remainingLabel(msLeft: number): string {
  if (msLeft <= 0) return "expired";
  const s = Math.floor(msLeft / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function showShareModal(opts: ShareModalOpts): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="share-card" role="dialog" aria-modal="true" aria-label="Sharing links">
      <div class="glyph">${LOGO_SVG}</div>
      <h2>${opts.editUrl ? "Your links" : "Your link"}</h2>
      <p class="meta" id="modal-meta"></p>
      ${opts.editUrl ? `
      <div class="link-row">
        <span class="link-label">Edit link</span><span class="link-hint warn">full access, keep it private</span>
        <div class="link-input"><input readonly>${opts.docId ? '<button class="btn" data-shorten>Shorten</button>' : ""}<button class="btn" data-qr title="Show a QR code for this link">QR</button><button class="btn" data-copy>Copy</button></div>
        <div class="qr-panel" hidden></div>
      </div>` : ""}
      <div class="link-row">
        <span class="link-label">View link</span><span class="link-hint">read-only, safe to send</span>
        <div class="link-input"><input readonly>${opts.docId ? '<button class="btn" data-shorten>Shorten</button>' : ""}<button class="btn" data-qr title="Show a QR code for this link">QR</button><button class="btn" data-copy>Copy</button></div>
        <div class="qr-panel" hidden></div>
      </div>
      ${opts.expiresAt ? '<p class="countdown">Expires in <span id="modal-countdown"></span></p>' : ""}
      <div class="share-actions">
        <button class="btn btn-accent" id="modal-close">${opts.primaryLabel ?? "Done"}</button>
      </div>
    </div>`;
  // URLs and meta go in via value/textContent, never interpolated into markup.
  const inputs = overlay.querySelectorAll<HTMLInputElement>(".link-input input");
  if (opts.editUrl) {
    inputs[0].value = opts.editUrl;
    inputs[1].value = opts.viewUrl;
  } else {
    inputs[0].value = opts.viewUrl;
  }
  const meta = overlay.querySelector<HTMLElement>("#modal-meta")!;
  if (opts.meta) meta.textContent = opts.meta;
  else meta.remove();

  let ticker: ReturnType<typeof setInterval> | undefined;
  if (opts.expiresAt) {
    const cd = overlay.querySelector<HTMLElement>("#modal-countdown")!;
    cd.title = new Date(opts.expiresAt).toLocaleString();
    const tick = () => {
      cd.textContent = remainingLabel(opts.expiresAt! - Date.now());
    };
    tick();
    ticker = setInterval(tick, 1000);
  }

  const close = () => {
    clearInterval(ticker);
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#modal-close")!.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  wireCopyButtons(overlay);

  // QR is generated in the browser from whatever the field currently holds, so
  // shortening first gives a coarser, easier-to-scan code.
  overlay.querySelectorAll<HTMLButtonElement>("button[data-qr]").forEach((btn) => {
    const row = btn.closest<HTMLElement>(".link-row")!;
    const panel = row.querySelector<HTMLElement>(".qr-panel")!;
    const input = row.querySelector<HTMLInputElement>("input")!;
    btn.addEventListener("click", async () => {
      if (!panel.hidden) {
        panel.hidden = true;
        panel.replaceChildren();
        btn.classList.remove("active");
        return;
      }
      btn.disabled = true;
      try {
        const { makeQr } = await import("./qr.ts");
        const { svg, dense } = await makeQr(input.value);
        const holder = document.createElement("div");
        holder.className = "qr-image";
        holder.innerHTML = svg; // generated locally from authored markup
        panel.replaceChildren(holder);
        if (dense) {
          const hint = document.createElement("p");
          hint.className = "qr-hint";
          hint.textContent = "Long link, so the code is dense. Shorten it first for an easier scan.";
          panel.appendChild(hint);
        }
        panel.hidden = false;
        btn.classList.add("active");
      } catch {
        panel.replaceChildren();
        panel.hidden = true;
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Optional shortening: nothing is created server-side unless asked for.
  if (opts.docId) {
    overlay.querySelectorAll<HTMLButtonElement>("button[data-shorten]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const input = btn.parentElement!.querySelector<HTMLInputElement>("input")!;
        btn.disabled = true;
        btn.textContent = "Shortening…";
        try {
          const { token, id, blob } = await makeShortLink(input.value);
          await api.createShortLink(id, blob, opts.docId!);
          input.value = `${location.origin}/s#${token}`;
          btn.textContent = "Shortened";
          // Any QR already on screen encodes the old, longer link.
          const stale = btn.closest(".link-row")?.querySelector<HTMLElement>(".qr-panel");
          if (stale && !stale.hidden) {
            stale.hidden = true;
            stale.replaceChildren();
            btn.closest(".link-row")?.querySelector("button[data-qr]")?.classList.remove("active");
          }
        } catch {
          btn.disabled = false;
          btn.textContent = "Shorten"; // the full link stays in place and keeps working
        }
      });
    });
  }
}

// Download offers two shapes of the same document, so it is a menu rather than
// a second toolbar button: the .md source, or a self-contained web page.
export function downloadMenuHTML(): string {
  return `<span class="menu-wrap">
    <button id="dl" class="btn" type="button" aria-haspopup="menu" aria-expanded="false">Download</button>
    <span class="menu" id="dl-menu" role="menu" hidden>
      <button type="button" role="menuitem" data-fmt="md">Markdown source</button>
      <button type="button" role="menuitem" data-fmt="html">Web page, self contained</button>
    </span>
  </span>`;
}

export function wireDownloadMenu(root: ParentNode, getText: () => string): void {
  const btn = root.querySelector<HTMLButtonElement>("#dl")!;
  const menu = root.querySelector<HTMLElement>("#dl-menu")!;
  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    // `hidden` is boolean | "until-found" in the DOM types, so narrow it.
    setOpen(Boolean(menu.hidden));
  });
  document.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  menu.addEventListener("click", async (e) => {
    const item = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-fmt]");
    if (!item) return;
    setOpen(false);
    if (item.dataset.fmt === "md") return downloadMarkdown("hush.md", getText());
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparing…";
    try {
      const { downloadExport } = await import("./export-html.ts");
      await downloadExport(getText());
    } catch {
      btn.textContent = "Export failed";
      setTimeout(() => (btn.textContent = label), 2200);
      btn.disabled = false;
      return;
    }
    btn.disabled = false;
    btn.textContent = label;
  });
}

export function downloadMarkdown(name: string, text: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function wireCopyButtons(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>("button[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      const input = b.parentElement?.querySelector<HTMLInputElement>("input");
      const value = input?.value ?? b.dataset.copy ?? "";
      try {
        await navigator.clipboard.writeText(value);
        b.textContent = "Copied";
        b.classList.add("copied");
      } catch {
        input?.select();
        b.textContent = "Press ⌘C";
      }
      setTimeout(() => {
        b.textContent = "Copy";
        b.classList.remove("copied");
      }, 1600);
    });
  });
}
