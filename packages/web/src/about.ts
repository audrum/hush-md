import { toolbarHTML, wireThemeToggle, LOGO_SVG } from "./chrome.ts";

export function renderAbout(root: HTMLElement): void {
  root.innerHTML = `
    ${toolbarHTML()}
    <div class="about"><div class="about-inner">
      <section class="hero">
        <div class="glyph">${LOGO_SVG}</div>
        <h1>Share markdown that keeps quiet.</h1>
        <p class="lede">Write a document, get a link, and let it disappear on schedule. Everything is encrypted in your browser before it leaves — this server stores bytes it cannot read.</p>
        <a class="btn btn-accent" href="/">Start writing</a>
      </section>

      <section class="features">
        <div class="feature"><h3>Encrypted end-to-end</h3><p>The key lives in the link itself — the part after <code>#</code> never reaches the server. Without your link, the document is noise.</p></div>
        <div class="feature"><h3>Expiring links</h3><p>Pick 1 hour to 30 days. When time runs out, the document is deleted — not archived, not soft-deleted. Gone.</p></div>
        <div class="feature"><h3>Two kinds of links</h3><p>The edit link gives full access; the view link is read-only. Send the one that matches the trust.</p></div>
        <div class="feature"><h3>Real markdown</h3><p>Live split-pane preview with tables, task lists, code blocks — and a clean <code>.md</code> download whenever you want the file back.</p></div>
        <div class="feature"><h3>Burn-once secrets</h3><p>Drop a <code>+ Secret</code> into a document — an API key, a password — and it can be revealed exactly once. Everyone after sees only when it was taken.</p></div>
        <div class="feature"><h3>Passwords &amp; view limits</h3><p>Add a password the link alone can't defeat, or let a document self-destruct after 1, 3, 10, or 25 views.</p></div>
        <div class="feature"><h3>No accounts</h3><p>Nothing to sign up for, nothing to track you with. A document and its link are the entire relationship.</p></div>
        <div class="feature"><h3>Honest by design</h3><p>Open format, one job, no lock-in. If this service vanished tomorrow, your downloaded markdown still works everywhere.</p></div>
      </section>

      <section class="how">
        <h2>How it works</h2>
        <ol>
          <li><div><b>Write</b><span>Your markdown lives in the editor, in your browser. Nothing is sent while you type.</span></div></li>
          <li><div><b>Share</b><span>Hitting Share encrypts the document locally (AES-256), uploads only the ciphertext, and builds a link whose <code>#fragment</code> holds the key. Browsers never send fragments to servers — so the server can store the document but never read it.</span></div></li>
          <li><div><b>Hush</b><span>The link works until it expires. After that the ciphertext is deleted and the link points at nothing.</span></div></li>
        </ol>
      </section>

      <section class="roadmap">
        <h2>Coming quietly</h2>
        <p>Live collaboration and a CLI for sharing from the terminal. Same rule as everything above: if a feature would require this server to read your words, it doesn't ship.</p>
      </section>

      <footer class="about-footer">hush.md — no accounts, no tracking, nothing readable on the server.</footer>
    </div></div>`;
  wireThemeToggle(root);
}
