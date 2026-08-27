import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export function renderMarkdown(src: string): string {
  let rendered = md.render(src);

  // Wrap table content in <table> tag
  rendered = rendered.replace(/\n(?=<thead>)/g, "\n<table>\n");
  rendered = rendered.replace(/(<\/tbody>\n)/g, "$1</table>\n");

  // Wrap code blocks in <pre> tag
  rendered = rendered.replace(/(<code class="language-[^"]*">[^<]*<\/code>)/g, "<pre>$1</pre>");

  // Remove dangerous attributes
  const cleaned = rendered.replace(/\s*onerror\s*=\s*["']?[^"'\s>]*["']?/gi, "");

  return DOMPurify.sanitize(cleaned);
}
