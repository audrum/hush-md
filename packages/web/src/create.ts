import { api } from "./api.ts";
import { mountEditor } from "./editor.ts";
import { renderMarkdown } from "./render.ts";
import { sealDoc } from "./crypto-flows.ts";

const STARTER = "# Untitled\n\nWrite markdown on the left, see it on the right.\n";

export function renderCreate(root: HTMLElement): void {
  root.innerHTML = `
    <div class="toolbar">
      <strong>hush.md</strong>
      <span class="spacer"></span>
      <label>Expires <select id="expiry">
        <option value="3600">1 hour</option>
        <option value="86400">1 day</option>
        <option value="604800" selected>7 days</option>
        <option value="2592000">30 days</option>
      </select></label>
      <button id="share">Share</button>
    </div>
    <div class="split">
      <div class="pane-editor" id="ed"></div>
      <div class="pane-preview" id="pv"></div>
    </div>`;
  const pv = root.querySelector<HTMLElement>("#pv")!;
  pv.innerHTML = renderMarkdown(STARTER);
  const editor = mountEditor(root.querySelector<HTMLElement>("#ed")!, {
    initial: STARTER,
    onChange: (t) => { pv.innerHTML = renderMarkdown(t); },
  });

  const shareBtn = root.querySelector<HTMLButtonElement>("#share")!;
  shareBtn.addEventListener("click", async () => {
    try {
      const expiresIn = Number(root.querySelector<HTMLSelectElement>("#expiry")!.value);
      const { payload, fragment, viewFragment } = await sealDoc(editor.getText(), "");
      const id = await api.createDoc({ ...payload, expiresIn });
      const base = `${location.origin}/d/${id}`;
      root.innerHTML = `
        <div class="notice">
          <h2>Shared</h2>
          <p>Edit link (keep private):</p>
          <input class="linkbox" readonly value="${base}#${fragment}" />
          <p>View-only link:</p>
          <input class="linkbox" readonly value="${base}#${viewFragment}" />
          <p><a href="${base}#${fragment}">Open it</a></p>
        </div>`;
    } catch {
      let err = root.querySelector<HTMLElement>("#share-error");
      if (!err) {
        err = document.createElement("p");
        err.id = "share-error";
        root.querySelector(".toolbar")!.insertAdjacentElement("afterend", err);
      }
      err.textContent = "Share failed — try again";
    }
  });
}
