import { renderCreate } from "./create.ts";
import { renderView } from "./view.ts";

const root = document.getElementById("app")!;
const m = location.pathname.match(/^\/d\/([A-Za-z0-9_-]{22})$/);
if (m) {
  renderView(root, m[1]);
} else {
  renderCreate(root);
}
