// QR for a sharing link. Worth having only now that short links exist: a full
// hush link is ~160 characters, which forces a dense grid that phones struggle
// to read off a screen. The generator is loaded on demand.

// qrcode-generator is CommonJS with an export assignment, so `typeof import(...)`
// in a type position is the factory itself, while the dynamic import at runtime
// hands back a namespace with the factory on `default`. The annotation has to
// describe the namespace, or the two disagree.
type QrFactory = typeof import("qrcode-generator");
let qrModule: Promise<{ default: QrFactory }> | undefined;

export interface Qr {
  svg: string;
  dense: boolean;
}

// Builds the QR as a single SVG path — no canvas, no raster, scales cleanly
// and drops straight into a themed page.
export async function makeQr(text: string): Promise<Qr> {
  // Held in a local as well, so the type narrows past the ??= assignment.
  const loading = (qrModule ??= import("qrcode-generator"));
  const qrcode = (await loading).default;
  // Type number 0 = auto-fit; L correction is enough for a screen and keeps
  // the grid as coarse as possible.
  const qr = qrcode(0, "L");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const quiet = 4;
  const size = count + quiet * 2;
  let path = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for this link">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/></svg>`;
  // Measured: a short link lands at 29 modules (version 3), a full link at 41
  // (version 6). Version 5 upward is where phone cameras start needing a
  // steady hand against a screen, so that is where the hint appears.
  return { svg, dense: count > 33 };
}
