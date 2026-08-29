import { defineConfig } from "vite";

export default defineConfig({
  server: { proxy: { "/api": "http://localhost:8080" } },
  build: {
    // Fonts must stay separate files. Vite inlines assets under 4 KB as data:
    // URIs, and the smallest KaTeX face slipped under that line — which the
    // strict CSP then blocked, since font-src falls back to default-src 'self'.
    // Keeping the policy tight is worth more than saving one request.
    assetsInlineLimit: (filePath: string) => (/\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined),
  },
});
