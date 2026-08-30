import { api, type FetchedDoc } from "./api.ts";
import { mountEditor } from "./editor.ts";
import { renderPreview, wireThemedPreview } from "./preview.ts";
import { copyIconHTML, wireCopyText, wireCodeCopy } from "./copy.ts";
import { openDoc, sealSnapshot } from "./crypto-flows.ts";
import { parseFragment, buildFragment, DecryptError } from "@hush/envelope";
import { toolbarHTML, wireThemeToggle, modeToggleHTML, wireModeToggle, downloadMenuHTML, wireDownloadMenu, showShareModal, LOGO_SVG } from "./chrome.ts";
import { wireSecretReveal, wireSecretInsert } from "./secrets-ui.ts";
import { resizerHTML, wireResizer, wireScrollSync } from "./split.ts";
import { outlineToggleHTML, wireOutline } from "./outline.ts";

function notice(root: HTMLElement, title: string, body: string): void {
  root.innerHTML = `${toolbarHTML()}<div class="notice"><div class="glyph">${LOGO_SVG}</div><h2></h2><p></p><a class="btn btn-accent" href="/">Write something new</a></div>`;
  root.querySelector(".notice h2")!.textContent = title;
  root.querySelector(".notice p")!.textContent = body;
  wireThemeToggle(root);
}

// Shown when the empty-password attempt fails: either the doc is password-
// protected or the link is wrong — the server can't tell us which, by design.
function passwordGate(root: HTMLElement, onSubmit: (pw: string) => Promise<boolean>): void {
  root.innerHTML = `${toolbarHTML()}
    <div class="notice"><div class="glyph">${LOGO_SVG}</div>
      <h2>Locked</h2>
      <p>This document needs a password, or the link is incomplete. The part after # matters.</p>
      <form id="unlock-form" class="unlock">
        <input type="password" id="unlock-pw" placeholder="Password" autocomplete="current-password" />
        <button type="submit" class="btn btn-accent">Unlock</button>
      </form>
      <p class="inline-error" id="unlock-err"></p>
    </div>`;
  wireThemeToggle(root);
  const form = root.querySelector<HTMLFormElement>("#unlock-form")!;
  const input = root.querySelector<HTMLInputElement>("#unlock-pw")!;
  input.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector<HTMLButtonElement>("button")!;
    btn.disabled = true;
    btn.textContent = "Unlocking…";
    const ok = await onSubmit(input.value);
    if (!ok) {
      btn.disabled = false;
      btn.textContent = "Unlock";
      root.querySelector("#unlock-err")!.textContent = "That didn't unlock it. Wrong password, or the link is damaged.";
      input.select();
    }
  });
}

export async function renderView(root: HTMLElement, id: string, knownPassword = ""): Promise<void> {
  let editToken: string | undefined;
  try {
    editToken = parseFragment(location.hash).editToken;
  } catch {
    return notice(root, "Invalid link", "This link is missing its key. The part after # matters. Ask the sender to copy the full link again.");
  }
  const doc = await api.fetchDoc(id, editToken);
  if (!doc) return notice(root, "Gone", "This document expired, reached its view limit, or never existed. Nothing is stored once a document is gone.");

  const tryOpen = async (password: string) => {
    try {
      return await openDoc(doc, location.hash, password);
    } catch (e) {
      if (e instanceof DecryptError) return null;
      throw e;
    }
  };

  let opened = await tryOpen(knownPassword);
  if (!opened) {
    // Wrong key or password-protected — offer the password path without refetching
    // (the view was already counted; retries are purely local decryption).
    return passwordGate(root, async (pw) => {
      const result = await tryOpen(pw);
      if (!result) return false;
      renderOpened(root, id, doc, result);
      return true;
    });
  }
  renderOpened(root, id, doc, opened);
}

function renderOpened(
  root: HTMLElement,
  id: string,
  doc: FetchedDoc,
  opened: { text: string; contentKey: Uint8Array; editToken?: string },
): void {
  const canEdit = opened.editToken !== undefined;

  root.innerHTML = `
    ${toolbarHTML(`
      ${outlineToggleHTML()}
      ${canEdit ? modeToggleHTML() : ""}
      ${canEdit ? '<button id="add-secret" class="btn" title="Insert a secret that can be revealed exactly once">+ Secret</button>' : ""}
      ${canEdit ? '<button id="save" class="btn btn-accent">Save</button>' : ""}
      <button id="links" class="btn" title="Show the sharing links for this document">Share</button>
      ${copyIconHTML("copy-md", "Copy markdown")}
      ${downloadMenuHTML()}
    `)}
    <div class="split" id="split"${canEdit ? "" : ' data-mode="preview"'}>
      <div class="pane-outline" id="ol" hidden></div>
      <div class="split-panes">
        ${canEdit ? `<div class="pane-editor" id="ed"></div>${resizerHTML()}` : ""}
        <div class="pane-preview"><div class="doc" id="pv"></div></div>
      </div>
    </div>`;
  wireThemeToggle(root);

  const pv = root.querySelector<HTMLElement>("#pv")!;
  void renderPreview(pv, opened.text);
  wireThemedPreview(pv);
  wireSecretReveal(pv);
  wireCodeCopy(pv);
  const split = root.querySelector<HTMLElement>("#split")!;
  const previewPane = root.querySelector<HTMLElement>(".pane-preview")!;
  // A read-only reader has no editor pane, but the outline is still theirs.
  let refreshOutline = () => {};
  let getText = () => opened.text;
  if (canEdit) {
    wireModeToggle(root, split);
    const editor = mountEditor(root.querySelector<HTMLElement>("#ed")!, {
      initial: opened.text,
      onChange: (t) => {
        void renderPreview(pv, t).then(() => refreshOutline());
      },
    });
    wireResizer(split);
    wireScrollSync(split, editor.scrollDOM, previewPane);
    getText = editor.getText;
    wireSecretInsert(root.querySelector<HTMLButtonElement>("#add-secret")!, root, editor, () => ({
      docId: id,
      editToken: opened.editToken,
    }));
    const saveBtn = root.querySelector<HTMLButtonElement>("#save")!;
    let revertTimer: ReturnType<typeof setTimeout> | undefined;
    saveBtn.addEventListener("click", async () => {
      if (saveBtn.disabled) return;
      clearTimeout(revertTimer);
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      try {
        await api.putSnapshot(id, await sealSnapshot(getText(), opened.contentKey), opened.editToken!);
        saveBtn.textContent = "Saved";
        revertTimer = setTimeout(() => {
          saveBtn.textContent = "Save";
        }, 2000);
      } catch {
        saveBtn.textContent = "Save failed. Your text is still here, try again";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
  refreshOutline = wireOutline(root, root.querySelector<HTMLElement>("#ol")!, previewPane, pv).refresh;

  // getText follows the editor when there is one, so the copy is always current.
  wireCopyText(root.querySelector<HTMLButtonElement>("#copy-md")!, () => getText());
  wireDownloadMenu(root, () => getText());

  // Reconstruct sharing links from the fragment. An edit link carries both
  // capabilities; a view link can only ever reproduce itself.
  root.querySelector<HTMLButtonElement>("#links")!.addEventListener("click", () => {
    const { linkKey } = parseFragment(location.hash);
    const base = `${location.origin}/d/${id}`;
    showShareModal({
      ...(canEdit ? { editUrl: `${base}#${buildFragment(linkKey, opened.editToken)}` } : {}),
      viewUrl: `${base}#${buildFragment(linkKey)}`,
      expiresAt: doc.expiresAt,
      docId: id,
    });
  });
}
