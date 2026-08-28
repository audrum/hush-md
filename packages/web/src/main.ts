import { initTheme } from "./theme.ts";
import { renderCreate } from "./create.ts";
import { renderView } from "./view.ts";
import { renderAbout } from "./about.ts";

initTheme();

// The fragment carries the document's capabilities (keys, edit token). A
// hash-only navigation doesn't reload the page, which would leave a stale
// capability view mounted — re-route instead.
addEventListener("hashchange", () => location.reload());

const root = document.getElementById("app")!;
const m = location.pathname.match(/^\/d\/([A-Za-z0-9_-]{22})$/);
if (m) {
  renderView(root, m[1]);
} else if (location.pathname === "/about") {
  renderAbout(root);
} else {
  renderCreate(root);
}
