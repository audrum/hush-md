import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

// {{secret:<22-char id>:<43-char b64url key>}} — inserted by the editor,
// rendered as a click-gated reveal chip. Never auto-fetched: fetching burns it.
export const SECRET_PLACEHOLDER_RE = /\{\{secret:([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{43})\}\}/;

function secretPlugin(md: InstanceType<typeof MarkdownIt>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.inline.ruler.before("escape", "hush_secret", (state: any, silent: boolean): boolean => {
    if (state.src.charCodeAt(state.pos) !== 0x7b /* { */) return false;
    const m = SECRET_PLACEHOLDER_RE.exec(state.src.slice(state.pos));
    if (!m || m.index !== 0) return false;
    if (!silent) {
      const token = state.push("hush_secret", "", 0);
      token.meta = { id: m[1], key: m[2] };
    }
    state.pos += m[0].length;
    return true;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.renderer.rules.hush_secret = (tokens: any[], i: number) => {
    const { id, key } = tokens[i].meta as { id: string; key: string };
    // id/key are regex-validated to b64url charsets — attribute-safe by construction.
    return `<button type="button" class="secret-chip" data-sid="${id}" data-skey="${key}">Reveal once</button>`;
  };
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
md.use(secretPlugin);

export function renderMarkdown(src: string): string {
  return DOMPurify.sanitize(md.render(src));
}
