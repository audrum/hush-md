import { api } from "./api.ts";
import { mountEditor } from "./editor.ts";
import { renderMarkdown } from "./render.ts";
import { openDoc, sealSnapshot } from "./crypto-flows.ts";
import { parseFragment, DecryptError } from "@hush/envelope";
import { toolbarHTML, wireThemeToggle, modeToggleHTML, wireModeToggle, LOGO_SVG } from "./chrome.ts";

function notice(root: HTMLElement, title: string, body: string): void {
  root.innerHTML = `${toolbarHTML()}<div class="notice"><div class="glyph">${LOGO_SVG}</div><h2></h2><p></p><a class="btn btn-accent" href="/">Write something new</a></div>`;
  root.querySelector(".notice h2")!.textContent = title;
  root.querySelector(".notice p")!.textContent = body;
  wireThemeToggle(root);
}

function download(name: string, text: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function renderView(root: HTMLElement, id: string): Promise<void> {
  let editToken: string | undefined;
  try {
    editToken = parseFragment(location.hash).editToken;
  } catch {
    return notice(root, "Invalid link", "This link is missing its key — the part after # matters. Ask the sender to copy the full link again.");
  }
  const doc = await api.fetchDoc(id, editToken);
  if (!doc) return notice(root, "Gone", "This document expired, reached its view limit, or never existed. Nothing is stored once a document is gone.");
  let opened;
  try {
    opened = await openDoc(doc, location.hash, "");
  } catch (e) {
    if (e instanceof DecryptError) return notice(root, "Can't decrypt", "The key in this link doesn't match the document. Ask the sender to copy the full link again.");
    throw e;
  }
  const canEdit = opened.editToken !== undefined;

  root.innerHTML = `
    ${toolbarHTML(`
      ${canEdit ? modeToggleHTML() : ""}
      ${canEdit ? '<button id="save" class="btn btn-accent">Save</button>' : ""}
      <button id="dl" class="btn">Download</button>
    `)}
    <div class="split" id="split"${canEdit ? "" : ' data-mode="preview"'}>
      ${canEdit ? '<div class="pane-editor" id="ed"></div>' : ""}
      <div class="pane-preview"><div class="doc" id="pv"></div></div>
    </div>`;
  wireThemeToggle(root);

  const pv = root.querySelector<HTMLElement>("#pv")!;
  pv.innerHTML = renderMarkdown(opened.text);
  let getText = () => opened.text;
  if (canEdit) {
    wireModeToggle(root, root.querySelector<HTMLElement>("#split")!);
    const editor = mountEditor(root.querySelector<HTMLElement>("#ed")!, {
      initial: opened.text,
      onChange: (t) => {
        pv.innerHTML = renderMarkdown(t);
      },
    });
    getText = editor.getText;
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
        saveBtn.textContent = "Save failed — your text is still here, try again";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }
  root.querySelector<HTMLButtonElement>("#dl")!.addEventListener("click", () => download("hush.md", getText()));
}
