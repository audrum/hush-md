import { initTheme } from "./theme.ts";
import { renderCreate } from "./create.ts";
import { renderView } from "./view.ts";
import { renderAbout } from "./about.ts";

initTheme();

const root = document.getElementById("app")!;
const m = location.pathname.match(/^\/d\/([A-Za-z0-9_-]{22})$/);
if (m) {
  renderView(root, m[1]);
} else if (location.pathname === "/about") {
  renderAbout(root);
} else {
  renderCreate(root);
}
