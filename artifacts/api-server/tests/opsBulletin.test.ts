/**
 * Public RDGD rolling bulletin. No auth. Not on the sitemap or IndexNow list.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import app from "../src/app";
import { INDEXNOW_URL_LIST } from "../src/lib/indexNow";
import { readRdgdBulletinHtml, RDGD_BULLETIN_PATH } from "../src/routes/opsBulletin";

let origin = "";
let closeApp: (() => Promise<void>) | undefined;

before(async () => {
  const live = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    live.once("listening", () => resolveReady());
    live.once("error", rejectReady);
  });
  const address = live.address();
  if (!address || typeof address === "string") throw new Error("App server did not bind.");
  origin = `http://127.0.0.1:${address.port}`;
  closeApp = () => new Promise<void>((resolveClose, rejectClose) => live.close((error) => (error ? rejectClose(error) : resolveClose())));
});

after(async () => {
  await closeApp?.();
});

test("GET /ops/rdgd-bulletin is public HTML and Autoscale claims the path", async () => {
  const html = readRdgdBulletinHtml();
  assert.match(html, /<title>RDGD Rolling Strategic Bulletin<\/title>/);
  assert.match(html, /name="robots" content="noindex"/);
  assert.doesNotMatch(html, /id="root"/);

  const artifact = await readFile(resolve(process.cwd(), ".replit-artifact/artifact.toml"), "utf8");
  assert.match(artifact, /"\/ops\/rdgd-bulletin"/);

  const appSource = await readFile(resolve(process.cwd(), "src/app.ts"), "utf8");
  const mountAt = appSource.indexOf("app.use(opsBulletinRouter)");
  const clerkAt = appSource.indexOf("clerkMiddleware(");
  assert.ok(mountAt > 0);
  assert.ok(clerkAt > mountAt);

  const editorial = await readFile(resolve(process.cwd(), "src/routes/editorial.ts"), "utf8");
  assert.doesNotMatch(editorial, /rdgd-bulletin/);
  assert.equal(INDEXNOW_URL_LIST.some((url) => url.includes("rdgd-bulletin")), false);

  const res = await fetch(`${origin}${RDGD_BULLETIN_PATH}`);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(res.headers.get("cache-control") ?? "", /public/);
  assert.match(res.headers.get("cache-control") ?? "", /max-age=60/);
  assert.equal(body, html);
  assert.doesNotMatch(body, /id="root"/);
});
