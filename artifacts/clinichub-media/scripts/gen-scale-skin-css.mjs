/**
 * Scale skin colour guard. Reads a built index-*.css, finds every Tailwind arbitrary-hex utility (text-[#0b1f3a],
 * bg-[#C8F55A], via-[#...]/70, hover:..., focus:...) and emits a copy scoped to html[data-skin="scale"] with the hex
 * swapped for the matching colour on the live scalehealth.ca palette. Output goes between the markers at the end of
 * src/index.css. birchreserve.net never has data-skin, so it is untouched. Usage:
 *   pnpm build && node scripts/gen-scale-skin-css.mjs dist/public/assets/index-*.css
 * Palette source: rendered colours + :root tokens of https://www.scalehealth.ca (home-assets/assets/index-*.css).
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// postcss is vite's own dependency (not a direct one): resolve it from vite's location.
const postcss = require(require.resolve("postcss", { paths: [require.resolve("vite")] }));

const INK = "#0d1426", MUTED = "#607085", GREEN = "#1d875c", PAGE = "#f9fafb", LINE = "#e0e5eb", SOFT = "#eceff3",
  DARKGREEN = "#0b1d16", DARK = "#0b0f1d", MINT = "#bfe8d4", MINT50 = "#e7f7ef", EMERALD = "#34d399", GREY = "#c9cfd8",
  AMBERTXT = "#b45309", AMBERBG = "#fff9e8", AMBERLINE = "#e3b84f", RED = "#ef4444", REDTXT = "#b91c1c";
const MAP = {
  // dark navy / ink
  "0b1f3a": INK, "0a1d56": INK, "071a39": INK, "0b151c": INK, "101c25": INK, "14232d": INK, "1c0909": INK, "13305a": DARK,
  // dark greens
  "0e3b2a": DARKGREEN, "0b1a13": INK, "07130d": DARKGREEN, "24332b": INK,
  // mid greens
  "0b6b43": GREEN, "2f6b00": GREEN, "1f8a4c": GREEN, "3b9b00": GREEN, "176f4b": GREEN, "9d4edd": GREEN,
  // light greens / lime
  "bff3d6": MINT, "8fd6a5": MINT, "a8e8b9": MINT, "ecfccb": MINT50, "fef9c3": MINT50, "c8f55a": EMERALD, "bef264": EMERALD,
  // greys
  "5e6b64": MUTED, "788791": MUTED, "70818b": MUTED, "82929c": MUTED, "9cabb4": GREY, "aab7bf": GREY, "c1cbd1": GREY,
  "ccc": GREY, "bfd2f0": GREY, "9bbbea": GREY,
  // cream / borders
  "faf8f3": PAGE, "f7f5f0": PAGE, "f4f0e8": PAGE, "edf1ee": PAGE, "faf6ff": PAGE, "d3d9d6": LINE, "ece8df": SOFT, "e6e2d8": LINE,
  // amber
  "8a5a00": AMBERTXT, "fff4db": AMBERBG, "f1d58f": AMBERLINE,
  // red
  "b42318": REDTXT, "e87979": RED, "ff8f8f": RED,
};
const file = process.argv[2];
const root = postcss.parse(fs.readFileSync(file, "utf8"));
const hexRe = /\\#([0-9a-fA-F]{3,8})/g;
const out = [];
const seen = new Set();
root.walkRules((r) => {
  if (r.selector.startsWith("html[data-skin")) return;
  const hexes = [...r.selector.matchAll(hexRe)].map((m) => m[1].toLowerCase());
  if (!hexes.length || !hexes.some((h) => MAP[h])) return;
  const clone = r.clone();
  clone.selectors = r.selectors.map((s) => `html[data-skin="scale"] ${s}`);
  clone.walkDecls((d) => {
    d.value = d.value.replace(/#([0-9a-fA-F]{3,8})\b/g, (all, h) => MAP[h.toLowerCase()] ?? all);
  });
  // rebuild at-rule ancestors (skip @layer: the block is deliberately unlayered)
  let node = clone;
  for (let p = r.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule" && p.name !== "layer") {
      const w = postcss.atRule({ name: p.name, params: p.params });
      w.append(node); node = w;
    }
  }
  const text = node.toString();
  if (!seen.has(text)) { seen.add(text); out.push(text); }
});
const missing = new Set();
root.walkRules((r) => { if (r.selector.startsWith("html[data-skin")) return; for (const m of r.selector.matchAll(hexRe)) if (!MAP[m[1].toLowerCase()] && m[1].toLowerCase() !== "fff" && m[1].toLowerCase() !== "1d875c") missing.add(m[1]); });
if (missing.size) console.error("UNMAPPED hex classes:", [...missing].join(","));
const BEGIN = "/* BEGIN scale-skin-generated (scripts/gen-scale-skin-css.mjs) */", END = "/* END scale-skin-generated */";
const idx = "src/index.css";
let css = fs.readFileSync(idx, "utf8");
const a = css.indexOf(BEGIN), b = css.indexOf(END);
if (a >= 0) css = css.slice(0, a).trimEnd() + "\n" + (b >= 0 ? css.slice(b + END.length) : "");
css = css.trimEnd() + `\n\n${BEGIN}\n${out.join("\n")}\n${END}\n`;
fs.writeFileSync(idx, css);
console.log("rules emitted:", out.length);
