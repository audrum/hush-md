import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export function renderMarkdown(src: string): string {
  return DOMPurify.sanitize(md.render(src));
}
