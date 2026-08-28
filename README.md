<p align="center">
  <img src="packages/web/public/favicon.svg" width="72" alt="hush.md logo — a markdown blockquote chevron followed by a fading ellipsis" />
</p>

<h1 align="center">hush.md</h1>

<p align="center"><b>Share markdown that keeps quiet.</b><br>
End-to-end encrypted markdown sharing with expiring links. No accounts, no tracking, nothing readable on the server.<br>
<a href="https://hush.md">hush.md</a></p>

---

Write a markdown document in a split-pane editor, hit **Share**, and get two links — an edit link and a read-only view link. The document is encrypted in your browser before anything leaves it, and it deletes itself on the schedule you pick.

## Features

- **End-to-end encrypted** — AES-256-GCM in the browser via WebCrypto. The key travels in the URL fragment (`#k=…`), which browsers never send to servers.
- **Expiring links** — 1 hour to 30 days. Expiry means *deleted from disk*, enforced on read, at boot, and by a background sweep.
- **Edit links vs view links** — the edit capability is a separate token, enforced server-side, not a hidden button.
- **Live split-pane editor** — CodeMirror 6 + GFM preview (tables, task lists, code), light/dark themes, editor/split/preview layouts.
- **`.md` download** — from the editor *before* sharing too, so "keep it entirely local" is a first-class path.
- **No accounts** — a document and its link are the entire relationship.

## Security model

The server is a **blind relay and blob store**. What it stores per document:

| Stored | Meaning |
|---|---|
| ciphertext snapshot | your document, AES-256-GCM encrypted client-side |
| wrapped content key | the doc key, itself encrypted with a key derived (PBKDF2-SHA-256, 600k iterations) from the link key |
| KDF salt | public |
| SHA-256 of the edit token | lets the server *verify* editors without being able to *become* one |
| creation/expiry timestamps, view counters | scheduling metadata |

The link key and content key exist only in URL fragments and browser memory. The server cannot read a document, and a database leak yields ciphertext plus hashes.

**What the server does see** (honesty section): request IPs and timing, document sizes, and view counts. Request logs redact document IDs.

**The standard web-E2E caveat applies**: the encryption is only as trustworthy as the JavaScript this server delivers. If your threat model includes the operator, [self-host it](#self-hosting) — the code you're reading is the code that ships.

Hardening in place: strict CSP, HSTS, per-IP rate limits, storage budget guard, timing-safe token comparison, DOMPurify over markdown-it (`html: false`) as the XSS boundary.

## How it works

1. **Write** — the document lives in your browser. Nothing is sent while you type.
2. **Share** — the client generates a random content key + link key + edit token, encrypts the document, wraps the content key, and uploads only ciphertext. The link it hands you carries the keys in the fragment.
3. **Open** — a recipient's browser fetches the ciphertext, derives the wrapping key from the fragment, unwraps, decrypts, renders. Wrong link ⇒ decryption fails; there is no password-reset because there is nothing to reset.
4. **Hush** — at expiry the ciphertext is deleted. Links to deleted documents are indistinguishable from links that never existed.

## Self-hosting

Everything runs from one small container: Node + Fastify + SQLite, with the built client served statically.

```sh
docker build -t hush-md .
docker run -p 8080:8080 -v hush_data:/data hush-md
```

Environment: `PORT` (default 8080), `DATA_DIR` (default `/data`), `STATIC_DIR` (set in the image). A `fly.toml` is included — the public instance runs on a single 256 MB scale-to-zero Fly.io machine.

## Development

npm workspaces monorepo:

```
packages/envelope   shared crypto (browser + Node, WebCrypto only)
packages/server     Fastify blind blob store + SQLite
packages/web        Vite + CodeMirror client
```

```sh
npm install
npm test              # vitest, all packages
npm run dev:server    # API on :8080
npm run dev:web       # Vite dev server, proxies /api
```

The crypto envelope is implemented exactly once and imported by every consumer — a deliberate rule to avoid E2E implementations drifting apart.

## Roadmap

Password-protected links, view-count limits (server support already exists), burn-once secrets inside documents, live collaboration (encrypted CRDT relay), and a CLI. Standing rule: if a feature would require the server to read your words, it doesn't ship.

## License

[MIT](LICENSE)
