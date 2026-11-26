#!/usr/bin/env node
/**
 * Rapid pulse check -> Google Sheet sync helper ("Rapid pulse check – agency intake").
 * The repo has no Google credentials, so rows are appended through the Scale Google Drive connector
 * (sheets_append_rows). Run on a schedule:
 *
 *   node scripts/pulse-check-sync.mjs fetch > rows.json     # unsynced rows, ready for sheets_append_rows
 *   ... append rows.json "values" to spreadsheet SHEET_ID, tab "Submissions" (parseInput false) ...
 *   node scripts/pulse-check-sync.mjs ack rows.json          # mark exactly those rows synced
 *
 * Env: PULSE_CHECK_EXPORT_KEY (or PULSE_CHECK_KEY_FILE pointing at a file holding it), optional PULSE_CHECK_BASE
 * (default https://www.scalehealth.ca/intake/_m; birchreserve.net works too). The key is never printed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SHEET_ID = "1cokUWzLYAmZW8UBm7eOFRixwFOLeqS9eOKYXnA0qM70";
const TAB = "Submissions";
const base = (process.env.PULSE_CHECK_BASE || "https://www.scalehealth.ca/intake/_m").replace(/\/+$/, "");
const key = (process.env.PULSE_CHECK_EXPORT_KEY || (process.env.PULSE_CHECK_KEY_FILE ? readFileSync(process.env.PULSE_CHECK_KEY_FILE, "utf8") : "")).trim();
if (!key) { console.error("Set PULSE_CHECK_EXPORT_KEY or PULSE_CHECK_KEY_FILE."); process.exit(2); }
const headers = { "x-pulse-export-key": key, "content-type": "application/json" };

const [cmd, file] = process.argv.slice(2);
if (cmd === "fetch") {
  const r = await fetch(`${base}/v1/pulse-check/export?limit=100`, { headers });
  if (!r.ok) { console.error(`export failed: HTTP ${r.status}`); process.exit(1); }
  const j = await r.json();
  const out = { spreadsheetId: SHEET_ID, sheet: TAB, count: j.count, refs: j.rows.map((x) => x.ref), values: j.rows.map((x) => x.sheetRow) };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
} else if (cmd === "ack" && file) {
  const { refs } = JSON.parse(readFileSync(file, "utf8"));
  const r = await fetch(`${base}/v1/pulse-check/export/ack`, { method: "POST", headers, body: JSON.stringify({ refs }) });
  if (!r.ok) { console.error(`ack failed: HTTP ${r.status}`); process.exit(1); }
  console.log(JSON.stringify(await r.json()));
} else {
  console.error("usage: pulse-check-sync.mjs fetch | ack <rows.json>");
  process.exit(2);
}
