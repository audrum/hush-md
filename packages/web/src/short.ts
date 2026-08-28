import { api } from "./api.ts";
import { shortLookupId, resolveShortLink } from "./crypto-flows.ts";
import { toolbarHTML, wireThemeToggle, LOGO_SVG } from "./chrome.ts";

function notice(root: HTMLElement, title: string, body: string): void {
  root.innerHTML = `${toolbarHTML()}<div class="notice"><div class="glyph">${LOGO_SVG}</div><h2></h2><p></p><a class="btn btn-accent" href="/">Write something new</a></div>`;
  root.querySelector(".notice h2")!.textContent = title;
  root.querySelector(".notice p")!.textContent = body;
  wireThemeToggle(root);
}

export async function renderShort(root: HTMLElement): Promise<void> {
  notice(root, "Opening…", "Resolving your short link.");
  const token = location.hash.replace(/^#/, "");
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) {
    return notice(root, "Invalid link", "This short link is missing its code. The part after # matters.");
  }
  try {
    const blob = await api.fetchShortBlob(await shortLookupId(token));
    if (!blob) return notice(root, "Gone", "This short link expired with its document, or never existed.");
    const fullUrl = await resolveShortLink(token, blob);
    if (!fullUrl.startsWith(`${location.origin}/d/`)) {
      return notice(root, "Invalid link", "This short link resolved to something unexpected and was not followed.");
    }
    location.replace(fullUrl);
  } catch {
    return notice(root, "Can't open this link", "The short link couldn't be resolved. Check your connection and try again.");
  }
}
