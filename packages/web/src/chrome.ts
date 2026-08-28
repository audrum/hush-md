import { currentTheme, toggleTheme } from "./theme.ts";

export const LOGO_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path d="M7 9.5 L13.5 16 L7 22.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.5" cy="21.9" r="1.95" fill="currentColor"/><circle cx="23.5" cy="21.9" r="1.95" fill="currentColor" opacity="0.45"/><circle cx="28.2" cy="21.9" r="1.95" fill="var(--accent)"/></svg>`;

const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="7" y2="7"/><line x1="17" y1="17" x2="18.7" y2="18.7"/><line x1="5.3" y1="18.7" x2="7" y2="17"/><line x1="17" y1="7" x2="18.7" y2="5.3"/></g></svg>`;

const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A6.8 6.8 0 0 0 20 14.5 Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

export function toolbarHTML(actions = ""): string {
  return `<header class="toolbar">
    <a class="brand" href="/" aria-label="hush.md — new document">
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
