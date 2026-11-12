import { readFileSync } from "node:fs";
import express from "express";
import { createPreviewApp } from "./app";
const dist = process.env.SPA_DIST ?? "/workspace/br-cad/artifacts/clinichub-media/dist/public";
const outer = express();
outer.use(express.static(dist, { index: false }));
outer.use(createPreviewApp(readFileSync(`${dist}/index.html`, "utf8")));
const port = Number(process.env.PORT ?? 5199);
outer.listen(port, () => console.log(`preview on http://127.0.0.1:${port}`));
