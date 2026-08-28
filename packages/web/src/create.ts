import { api } from "./api.ts";
import { mountEditor } from "./editor.ts";
import { renderMarkdown } from "./render.ts";
import { sealDoc } from "./crypto-flows.ts";
import { toolbarHTML, wireThemeToggle, modeToggleHTML, wireModeToggle, wireCopyButtons, downloadMarkdown, LOGO_SVG } from "./chrome.ts";

const STARTER = `# Untitled

Write markdown here — **bold**, *italic*, \`code\`, tables, all rendered live on the right.

> Share when you're ready. The link is the key: it decrypts the document, and this server never sees what you wrote.
`;

const EXPIRY_LABELS: Record<string, string> = {
  "3600": "in 1 hour",
  "86400": "in 1 day",
  "604800": "in 7 days",
  "2592000": "in 30 days",
};

const DOC_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export function renderCreate(root: HTMLElement): void {
  root.innerHTML = `
    ${toolbarHTML(`
      ${modeToggleHTML()}
      <label class="field">Expires <select id="expiry">
        <option value="3600">1 hour</option>
        <option value="86400">1 day</option>
        <option value="604800" selected>7 days</option>
        <option value="2592000">30 days</option>
      </select></label>
      <button id="dl" class="btn">Download</button>
      <button id="share" class="btn btn-accent">Share</button>
    `)}
    <div class="split" id="split">
      <div class="pane-editor" id="ed"></div>
      <div class="pane-preview"><div class="doc" id="pv"></div></div>
    </div>`;
  wireThemeToggle(root);
  wireModeToggle(root, root.querySelector<HTMLElement>("#split")!);

  const pv = root.querySelector<HTMLElement>("#pv")!;
  pv.innerHTML = renderMarkdown(STARTER);
  const editor = mountEditor(root.querySelector<HTMLElement>("#ed")!, {
    initial: STARTER,
    onChange: (t) => {
      pv.innerHTML = renderMarkdown(t);
    },
  });

  root.querySelector<HTMLButtonElement>("#dl")!.addEventListener("click", () => downloadMarkdown("hush.md", editor.getText()));

  const shareBtn = root.querySelector<HTMLButtonElement>("#share")!;
  shareBtn.addEventListener("click", async () => {
    if (shareBtn.disabled) return;
    shareBtn.disabled = true;
    shareBtn.textContent = "Sharing…";
    try {
      const expiry = root.querySelector<HTMLSelectElement>("#expiry")!.value;
      const { payload, fragment, viewFragment } = await sealDoc(editor.getText(), "");
      const id = await api.createDoc({ ...payload, expiresIn: Number(expiry) });
      if (!DOC_ID_RE.test(id)) throw new Error("unexpected document id from server");
      const base = `${location.origin}/d/${id}`;
      editor.destroy();
      root.innerHTML = `
        ${toolbarHTML()}
        <div class="center-wrap">
          <div class="share-card">
            <div class="glyph">${LOGO_SVG}</div>
            <h2>Your link is ready</h2>
            <p class="meta">This document expires ${EXPIRY_LABELS[expiry] ?? "on schedule"}.</p>
            <div class="link-row">
              <span class="link-label">Edit link</span><span class="link-hint warn">full access — keep it private</span>
              <div class="link-input"><input readonly value="${base}#${fragment}"><button class="btn" data-copy>Copy</button></div>
            </div>
            <div class="link-row">
              <span class="link-label">View link</span><span class="link-hint">read-only — safe to send</span>
              <div class="link-input"><input readonly value="${base}#${viewFragment}"><button class="btn" data-copy>Copy</button></div>
            </div>
            <div class="share-actions">
              <a class="btn btn-accent" href="${base}#${fragment}">Open document</a>
              <a class="btn" href="/">Write another</a>
            </div>
          </div>
        </div>`;
      wireThemeToggle(root);
      wireCopyButtons(root);
    } catch {
      shareBtn.disabled = false;
      shareBtn.textContent = "Share";
      let err = root.querySelector<HTMLElement>("#share-error");
      if (!err) {
        err = document.createElement("p");
        err.id = "share-error";
        err.className = "inline-error";
        root.querySelector(".toolbar")!.insertAdjacentElement("afterend", err);
      }
      err.textContent = "Sharing didn't go through — check your connection and try again. Your text is untouched.";
    }
  });
}
