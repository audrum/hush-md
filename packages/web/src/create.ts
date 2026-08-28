import { api } from "./api.ts";
import { mountEditor } from "./editor.ts";
import { renderMarkdown, SECRET_PLACEHOLDER_RE } from "./render.ts";
import { sealDoc } from "./crypto-flows.ts";
import { toolbarHTML, wireThemeToggle, modeToggleHTML, wireModeToggle, downloadMarkdown, showShareModal } from "./chrome.ts";
import { wireSecretReveal, wireSecretInsert } from "./secrets-ui.ts";
import { renderView } from "./view.ts";

const STARTER = `# Untitled

Write markdown here — **bold**, *italic*, \`code\`, tables, all rendered live on the right.

> Share when you're ready. The link is the key: it decrypts the document, and this server never sees what you wrote.
`;

const EXPIRES_MIN = 60, EXPIRES_MAX = 7776000; // mirror the server's clamp: 1 minute to 90 days

function expiryLabel(seconds: number): string {
  const units: [number, string][] = [[86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const n = Math.round(seconds / size);
      return `in ${n} ${name}${n === 1 ? "" : "s"}`;
    }
  }
  return "in 1 minute";
}

const DOC_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export function renderCreate(root: HTMLElement): void {
  root.innerHTML = `
    ${toolbarHTML(`
      ${modeToggleHTML()}
      <button id="add-secret" class="btn" title="Insert a secret that can be revealed exactly once">+ Secret</button>
      <label class="field">Expires <select id="expiry">
        <option value="3600">1 hour</option>
        <option value="86400">1 day</option>
        <option value="604800" selected>7 days</option>
        <option value="2592000">30 days</option>
        <option value="custom">Custom…</option>
      </select></label>
      <span class="field custom-field" id="expiry-custom" hidden>
        <input type="number" id="expiry-n" min="1" step="1" value="12" aria-label="Custom expiry amount" />
        <select id="expiry-unit" aria-label="Custom expiry unit">
          <option value="60">minutes</option>
          <option value="3600" selected>hours</option>
          <option value="86400">days</option>
        </select>
      </span>
      <label class="field">Views <select id="views">
        <option value="" selected>unlimited</option>
        <option value="1">1</option>
        <option value="3">3</option>
        <option value="10">10</option>
        <option value="25">25</option>
        <option value="custom">Custom…</option>
      </select></label>
      <input type="number" id="views-n" class="custom-field" min="1" step="1" value="50" hidden aria-label="Custom view limit" />
      <input type="password" id="pw" class="pw-field" placeholder="Password (optional)" autocomplete="new-password" />
      <button id="dl" class="btn">Download</button>
      <button id="share" class="btn btn-accent">Share</button>
    `)}
    <div class="split" id="split">
      <div class="pane-editor" id="ed"></div>
      <div class="pane-preview"><div class="doc" id="pv"></div></div>
    </div>`;
  wireThemeToggle(root);
  wireModeToggle(root, root.querySelector<HTMLElement>("#split")!);

  const expirySel = root.querySelector<HTMLSelectElement>("#expiry")!;
  const viewsSel = root.querySelector<HTMLSelectElement>("#views")!;
  expirySel.addEventListener("change", () => {
    root.querySelector<HTMLElement>("#expiry-custom")!.hidden = expirySel.value !== "custom";
  });
  viewsSel.addEventListener("change", () => {
    root.querySelector<HTMLInputElement>("#views-n")!.hidden = viewsSel.value !== "custom";
  });

  const pv = root.querySelector<HTMLElement>("#pv")!;
  pv.innerHTML = renderMarkdown(STARTER);
  const editor = mountEditor(root.querySelector<HTMLElement>("#ed")!, {
    initial: STARTER,
    onChange: (t) => {
      pv.innerHTML = renderMarkdown(t);
    },
  });
  wireSecretReveal(pv);
  wireSecretInsert(root.querySelector<HTMLButtonElement>("#add-secret")!, root, editor, () => ({}));

  root.querySelector<HTMLButtonElement>("#dl")!.addEventListener("click", () => downloadMarkdown("hush.md", editor.getText()));

  const shareBtn = root.querySelector<HTMLButtonElement>("#share")!;
  shareBtn.addEventListener("click", async () => {
    if (shareBtn.disabled) return;
    shareBtn.disabled = true;
    shareBtn.textContent = "Sharing…";
    const fail = (msg: string) => {
      shareBtn.disabled = false;
      shareBtn.textContent = "Share";
      let err = root.querySelector<HTMLElement>("#share-error");
      if (!err) {
        err = document.createElement("p");
        err.id = "share-error";
        err.className = "inline-error";
        root.querySelector(".toolbar")!.insertAdjacentElement("afterend", err);
      }
      err.textContent = msg;
    };
    // Resolve expiry (preset or custom), clamped to the server's real range.
    let expiresIn: number;
    if (expirySel.value === "custom") {
      const n = Number(root.querySelector<HTMLInputElement>("#expiry-n")!.value);
      const unit = Number(root.querySelector<HTMLSelectElement>("#expiry-unit")!.value);
      if (!Number.isInteger(n) || n <= 0) return fail("Custom expiry needs a whole number greater than zero.");
      expiresIn = n * unit;
      if (expiresIn < EXPIRES_MIN || expiresIn > EXPIRES_MAX) return fail("Expiry must be between 1 minute and 90 days.");
    } else {
      expiresIn = Number(expirySel.value);
    }
    // Resolve view limit (unlimited, preset, or custom).
    let maxViews: number | undefined;
    if (viewsSel.value === "custom") {
      const n = Number(root.querySelector<HTMLInputElement>("#views-n")!.value);
      if (!Number.isInteger(n) || n <= 0) return fail("Custom view limit needs a whole number greater than zero.");
      maxViews = n;
    } else if (viewsSel.value) {
      maxViews = Number(viewsSel.value);
    }
    try {
      const password = root.querySelector<HTMLInputElement>("#pw")!.value;
      const text = editor.getText();
      const secretIds = [...text.matchAll(new RegExp(SECRET_PLACEHOLDER_RE.source, "g"))].map((m) => m[1]);
      const { payload, fragment, viewFragment } = await sealDoc(text, password);
      const id = await api.createDoc({
        ...payload,
        expiresIn,
        ...(maxViews !== undefined ? { maxViews } : {}),
        ...(secretIds.length > 0 ? { secretIds } : {}),
      });
      if (!DOC_ID_RE.test(id)) throw new Error("unexpected document id from server");
      const base = `${location.origin}/d/${id}`;
      const notes = [
        `Expires ${expiryLabel(expiresIn)}.`,
        maxViews !== undefined ? `Self-destructs after ${maxViews} view${maxViews === 1 ? "" : "s"}.` : "",
        password ? "Password required to open. Share it through a different channel than the link." : "",
        secretIds.length > 0 ? `Contains ${secretIds.length} burn-once secret${secretIds.length === 1 ? "" : "s"}.` : "",
      ].filter(Boolean).join(" ");
      shareBtn.textContent = "Shared";
      // The document stays on screen behind the modal; closing it adopts the
      // shared document in place — the URL becomes the edit link and Save works.
      showShareModal({
        editUrl: `${base}#${fragment}`,
        viewUrl: `${base}#${viewFragment}`,
        meta: notes,
        primaryLabel: "Done, keep editing",
        onClose: () => {
          editor.destroy();
          history.replaceState(null, "", `/d/${id}#${fragment}`);
          renderView(root, id, password);
        },
      });
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
      err.textContent = "Sharing didn't go through. Check your connection and try again. Your text is untouched.";
    }
  });
}
