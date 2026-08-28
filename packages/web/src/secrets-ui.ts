import { api } from "./api.ts";
import { sealSecretContent, openSecretContent, secretPlaceholder } from "./crypto-flows.ts";
import type { Editor } from "./editor.ts";

// Reveal is deliberately two-step: fetching a secret burns it for everyone,
// so the first click only arms the chip.
export function wireSecretReveal(previewEl: HTMLElement): void {
  previewEl.addEventListener("click", async (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>("button.secret-chip");
    if (!chip) return;
    if (chip.dataset.busy) return;
    if (!chip.dataset.armed) {
      chip.dataset.armed = "1";
      chip.classList.add("armed");
      chip.textContent = "Click again to reveal — burns for everyone";
      return;
    }
    chip.dataset.busy = "1";
    chip.textContent = "Revealing…";
    try {
      const result = await api.fetchSecret(chip.dataset.sid!);
      if (result.state === "live") {
        const text = await openSecretContent(result.blob, chip.dataset.skey!);
        const code = document.createElement("code");
        code.className = "secret-revealed";
        code.textContent = text;
        chip.replaceWith(code);
      } else if (result.state === "burned") {
        const span = document.createElement("span");
        span.className = "secret-burned";
        span.textContent = `Secret already revealed ${new Date(result.burnedAt).toLocaleString()}`;
        chip.replaceWith(span);
      } else {
        const span = document.createElement("span");
        span.className = "secret-burned";
        span.textContent = "Secret expired";
        chip.replaceWith(span);
      }
    } catch {
      delete chip.dataset.busy;
      delete chip.dataset.armed;
      chip.classList.remove("armed");
      chip.textContent = "Couldn't reach the server — try again";
    }
  });
}

// Inline panel under the toolbar: type the secret, it's encrypted with its own
// fresh key, uploaded as ciphertext, and a placeholder lands at the cursor.
export function wireSecretInsert(
  btn: HTMLButtonElement,
  root: HTMLElement,
  editor: Editor,
  ctx: () => { docId?: string; editToken?: string },
): void {
  btn.addEventListener("click", () => {
    if (root.querySelector("#secret-panel")) return;
    const panel = document.createElement("div");
    panel.id = "secret-panel";
    panel.className = "secret-panel";
    panel.innerHTML = `
      <input type="text" id="secret-value" placeholder="The secret — revealed exactly once, then gone" autocomplete="off" spellcheck="false" />
      <button type="button" class="btn btn-accent" id="secret-add">Encrypt &amp; insert</button>
      <button type="button" class="btn" id="secret-cancel">Cancel</button>
      <span class="inline-error" id="secret-err"></span>`;
    root.querySelector(".toolbar")!.insertAdjacentElement("afterend", panel);
    const input = panel.querySelector<HTMLInputElement>("#secret-value")!;
    input.focus();
    panel.querySelector("#secret-cancel")!.addEventListener("click", () => panel.remove());
    const addBtn = panel.querySelector<HTMLButtonElement>("#secret-add")!;
    addBtn.addEventListener("click", async () => {
      const value = input.value;
      if (!value) return input.focus();
      addBtn.disabled = true;
      addBtn.textContent = "Encrypting…";
      try {
        const { blob, keyB64 } = await sealSecretContent(value);
        const id = await api.createSecret(blob, ctx());
        editor.insertText(secretPlaceholder(id, keyB64));
        panel.remove();
      } catch {
        addBtn.disabled = false;
        addBtn.textContent = "Encrypt & insert";
        panel.querySelector("#secret-err")!.textContent = "Couldn't upload the secret — try again.";
      }
    });
  });
}
