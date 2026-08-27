import { api } from "./api.ts";
import { mountEditor } from "./editor.ts";
import { renderMarkdown } from "./render.ts";
import { openDoc, sealSnapshot } from "./crypto-flows.ts";
import { parseFragment, DecryptError } from "@hush/envelope";

function notice(root: HTMLElement, title: string, body: string): void {
  root.innerHTML = `<div class="notice"><h2>${title}</h2><p>${body}</p></div>`;
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
    return notice(root, "Invalid link", "This link is missing its key. Ask the sender to re-copy it — the part after # matters.");
  }
  const doc = await api.fetchDoc(id, editToken);
  if (!doc) return notice(root, "Gone", "This document expired, hit its view limit, or never existed.");
  let opened;
  try {
    opened = await openDoc(doc, location.hash, "");
  } catch (e) {
    if (e instanceof DecryptError) return notice(root, "Can't decrypt", "Wrong link or wrong password.");
    throw e;
  }
  const canEdit = opened.editToken !== undefined;

  root.innerHTML = `
    <div class="toolbar">
      <strong>hush.md</strong>
      <span class="spacer"></span>
      ${canEdit ? '<button id="save">Save</button>' : ""}
      <button id="dl">Download .md</button>
    </div>
    <div class="split">
      ${canEdit ? '<div class="pane-editor" id="ed"></div>' : ""}
      <div class="pane-preview" id="pv"></div>
    </div>`;
  const pv = root.querySelector<HTMLElement>("#pv")!;
  pv.innerHTML = renderMarkdown(opened.text);
  let getText = () => opened.text;
  if (canEdit) {
    const editor = mountEditor(root.querySelector<HTMLElement>("#ed")!, {
      initial: opened.text,
      onChange: (t) => { pv.innerHTML = renderMarkdown(t); },
    });
    getText = editor.getText;
    root.querySelector<HTMLButtonElement>("#save")!.addEventListener("click", async () => {
      await api.putSnapshot(id, await sealSnapshot(getText(), opened.contentKey), opened.editToken!);
    });
  }
  root.querySelector<HTMLButtonElement>("#dl")!.addEventListener("click", () => download("hush.md", getText()));
}
