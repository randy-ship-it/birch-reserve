#!/usr/bin/env node
/**
 * Live onboarding eval. Runs every question against the live chat on BOTH domains and checks each answer
 * (accuracy, correct link, rule compliance). Saves transcripts as JSON + Markdown.
 *
 *   node tests/chat-eval/run-live.mjs [--out DIR] [--only birch|scale] [--ids a,b] [--runs 1]
 *
 * Birch:  POST https://birchreserve.net/api/launch/randy-chat          (Origin birchreserve.net)
 * Scale:  POST https://www.scalehealth.ca/intake/_m/api/launch/randy-chat  (Origin www.scalehealth.ca, skin "scale"),
 *         the exact path the Scale mirror widget uses.
 * No sessionId is sent, so no transcript email is created for the team.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { QUESTIONS, checkAnswer } from "./questions.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = arg("out", `/workspace/onboard-eval/run-${Date.now()}`);
const only = arg("only", "");
const ids = arg("ids", "") ? arg("ids", "").split(",") : null;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SITES = {
  birch: { url: "https://birchreserve.net/api/launch/randy-chat", origin: "https://birchreserve.net", body: {} },
  scale: { url: "https://www.scalehealth.ca/intake/_m/api/launch/randy-chat", origin: "https://www.scalehealth.ca", body: { skin: "scale" } },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(site, q) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(site.url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: site.origin, "user-agent": UA },
      body: JSON.stringify({ messages: [{ role: "user", content: q }], mode: "chat", pagePath: "/intake", ...site.body }),
    });
    if (r.status === 429) { await sleep(20000 * (attempt + 1)); continue; }
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.text) return { status: r.status, text: j.text, source: j.source };
    await sleep(3000);
  }
  return { status: 0, text: "", source: "none" };
}

mkdirSync(out, { recursive: true });
const results = [];
for (const brand of Object.keys(SITES)) {
  if (only && only !== brand) continue;
  for (const item of QUESTIONS) {
    if (ids && !ids.includes(item.id)) continue;
    const a = await ask(SITES[brand], item.q);
    const fails = a.source === "grok" ? checkAnswer(item, a.text, brand) : [`source:${a.source}`, ...checkAnswer(item, a.text, brand)];
    results.push({ brand, id: item.id, question: item.q, answer: a.text, source: a.source, pass: fails.length === 0, fails });
    console.log(`${fails.length ? "FAIL" : "PASS"} ${brand} ${item.id}${fails.length ? "  " + fails.join(" ; ") : ""}`);
    await sleep(1800);
  }
}
const summary = {};
for (const b of Object.keys(SITES)) {
  const rs = results.filter((r) => r.brand === b);
  if (rs.length) summary[b] = { pass: rs.filter((r) => r.pass).length, total: rs.length };
}
writeFileSync(`${out}/transcripts.json`, JSON.stringify({ ranAt: new Date().toISOString(), summary, results }, null, 2));
writeFileSync(`${out}/transcripts.md`, `# Onboarding chat eval\n\n${JSON.stringify(summary)}\n\n` + results.map((r) => `## [${r.pass ? "PASS" : "FAIL"}] ${r.brand} · ${r.id}\n\n**Visitor:** ${r.question}\n\n**Chat (${r.source}):**\n\n${r.answer}\n\n${r.fails.length ? `**Fails:** ${r.fails.join("; ")}\n\n` : ""}`).join("\n"));
console.log(JSON.stringify(summary), out);
process.exit(Object.values(summary).every((s) => s.pass === s.total) ? 0 : 1);
