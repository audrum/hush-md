import { mkdirSync } from "node:fs";
import { buildApp, startSweep } from "./app.ts";
import { openDb } from "./db.ts";

const dataDir = process.env.DATA_DIR ?? "./data";
mkdirSync(dataDir, { recursive: true });
const db = openDb(`${dataDir}/hush.db`);
const app = buildApp(db, process.env.STATIC_DIR, { logger: true });
startSweep(db);

// Fly stops this machine routinely (scale-to-zero) — drain instead of dropping requests.
let shuttingDown = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ sig }, "shutting down");
    app
      .close()
      .then(() => db.close())
      .finally(() => process.exit(0));
  });
}

const port = Number(process.env.PORT ?? 8080);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err, "failed to bind");
  process.exit(1);
});
