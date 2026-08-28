import { mkdirSync } from "node:fs";
import { buildApp, startSweep } from "./app.ts";
import { openDb } from "./db.ts";

const dataDir = process.env.DATA_DIR ?? "./data";
mkdirSync(dataDir, { recursive: true });
const db = openDb(`${dataDir}/hush.db`);
const app = buildApp(db, process.env.STATIC_DIR);
startSweep(db);

const port = Number(process.env.PORT ?? 8080);
app.listen({ port, host: "0.0.0.0" }).then(() => console.log(`hush server on :${port}`));
