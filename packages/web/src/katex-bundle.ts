// KaTeX's stylesheet, isolated in its own lazily-imported chunk. It pulls the
// woff2 faces as same-origin assets, so the strict CSP needs no exception.
// The library itself is imported separately (and by module specifier) so that
// Mermaid, which also depends on KaTeX, shares one copy instead of two.
import "katex/dist/katex.min.css";
