import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";

export function mountEditor(
  host: HTMLElement,
  opts: { initial: string; readOnly?: boolean; onChange?: (text: string) => void },
) {
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: opts.initial,
      extensions: [
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
    getText: () => view.state.doc.toString(),
    destroy: () => view.destroy(),
  };
}
