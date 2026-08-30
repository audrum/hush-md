import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Theme values are CSS variables, so the editor follows light/dark automatically.
const hushChrome = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    height: "100%",
    fontSize: "0.95rem",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    fontFamily: "var(--font-mono)",
    padding: "1.4rem 0 4rem",
    maxWidth: "46rem",
    margin: "0 auto",
    lineHeight: "1.6",
  },
  ".cm-line": { padding: "0 1.2rem" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--accent-soft)",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
});

const hushHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "700" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--accent)" },
  { tag: tags.url, color: "var(--accent)" },
  { tag: tags.monospace, color: "var(--accent)" },
  { tag: tags.quote, color: "var(--ink-soft)", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "var(--ink-faint)" },
  { tag: tags.meta, color: "var(--ink-faint)" },
]);

export function mountEditor(
  host: HTMLElement,
  opts: { initial: string; readOnly?: boolean; onChange?: (text: string) => void },
) {
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: opts.initial,
      extensions: [
        hushChrome,
        syntaxHighlighting(hushHighlight),
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorState.readOnly.of(opts.readOnly ?? false),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange?.(u.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    // CodeMirror scrolls inside its own element, not the pane we mounted into,
    // so anything syncing scroll has to hook this rather than the host.
    scrollDOM: view.scrollDOM,
    getText: () => view.state.doc.toString(),
    insertText: (text: string) => {
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + text.length },
      });
      view.focus();
    },
    destroy: () => view.destroy(),
  };
}

export type Editor = ReturnType<typeof mountEditor>;
