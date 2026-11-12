/**
 * Loads the vendored voice-closer knowledge pack for Chat Randy (Grok).
 *
 * Source of truth: /workspace/sales-brain/ (edit there, then run ./build.sh).
 * build.sh generates the mirror at /workspace/birch-live-ops/voice-closer/knowledge/,
 * and src/knowledge/voice-closer/ is a byte-identical copy of that mirror
 * (Autoscale cannot read /workspace paths). Never hand-edit either copy.
 * Mirror SYSTEM-PROMPT.md = sales-brain core 00-30 (identity, qualify flow,
 * routing URLs, phone phrasing); NEVER-SAY loads last so it wins.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Practical concat order (README paste order, size-aware). */
export const VOICE_CLOSER_LOAD_ORDER = [
  // Routing (core/20) is already inside SYSTEM-PROMPT.md; ROUTING-URLS.md in the
  // mirror is the same table plus the ops verification log, so it is not loaded.
  "SYSTEM-PROMPT.md",
  "BIRCH-OFFER.md",
  "CROSS-PORTFOLIO.md",
  "HANDOFF-CHECKLIST.md",
  "SCALE.md",
  "ALIGN.md",
  "RDGDH-PORTFOLIO.md",
  "TEAM-ACCESS.md",
  "NEVER-SAY.md",
] as const;

const MAX_PACK_CHARS = 56_000;

/** Ops-only audit log at the end of ROUTING-URLS.md; never sent to the model. */
export const ROUTING_LOG_MARKER = "<!-- ROUTING-VERIFICATION-LOG";

/** Drop ops-only tails (routing verification log) and HTML comments (GENERATED headers). */
function stripOpsOnlySections(_file: string, body: string): string {
  const idx = body.indexOf(ROUTING_LOG_MARKER);
  const kept = idx >= 0 ? body.slice(0, idx) : body;
  return kept.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function candidateDirs(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();
  return [
    path.resolve(here, "knowledge", "voice-closer"),
    path.resolve(here, "../knowledge/voice-closer"),
    path.resolve(here, "../../src/knowledge/voice-closer"),
    path.resolve(cwd, "src/knowledge/voice-closer"),
    path.resolve(cwd, "knowledge/voice-closer"),
    path.resolve(cwd, "artifacts/api-server/src/knowledge/voice-closer"),
    path.resolve(cwd, "artifacts/api-server/dist/knowledge/voice-closer"),
  ];
}

export function resolveVoiceCloserKnowledgeDir(): string | null {
  for (const dir of candidateDirs()) {
    if (existsSync(path.join(dir, "SYSTEM-PROMPT.md"))) {
      return dir;
    }
  }
  return null;
}

let cachedPrompt: string | null = null;
let cachedDir: string | null = null;

/** Single paste-ready chat prompt built by /workspace/sales-brain/build.sh (dist/birch-chat.prompt.txt). */
export const BIRCH_CHAT_PROMPT_FILE = "birch-chat.prompt.txt";

function resolveBirchChatPromptPath(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();
  const candidates = [
    path.resolve(here, "knowledge"),
    path.resolve(here, "../knowledge"),
    path.resolve(here, "../../src/knowledge"),
    path.resolve(cwd, "src/knowledge"),
    path.resolve(cwd, "knowledge"),
    path.resolve(cwd, "artifacts/api-server/src/knowledge"),
    path.resolve(cwd, "artifacts/api-server/dist/knowledge"),
  ];
  for (const dir of candidates) {
    const full = path.join(dir, BIRCH_CHAT_PROMPT_FILE);
    if (existsSync(full)) return full;
  }
  return null;
}

/** Legacy 9-file assembly from the mirror (fallback only if the single prompt is missing). */
function loadLegacyPack(): { prompt: string; dir: string } {
  const dir = resolveVoiceCloserKnowledgeDir();
  if (!dir) {
    throw new Error("Randy chat prompt missing: vendor sales-brain dist/birch-chat.prompt.txt into src/knowledge/.");
  }
  const parts: string[] = [];
  for (const file of VOICE_CLOSER_LOAD_ORDER) {
    const full = path.join(dir, file);
    if (!existsSync(full)) continue;
    const body = stripOpsOnlySections(file, readFileSync(full, "utf8").trim());
    if (body) parts.push(`## FILE: ${file}\n\n${body}`);
  }
  if (parts.length === 0) throw new Error("Voice-closer knowledge pack empty after sync.");
  return { prompt: parts.join("\n\n---\n\n"), dir };
}

/** Visitor-facing name of the site-chat AI on birchreserve.net (Randy, Nov 12 2026 2:58 PM ET). */
export const BIRCH_SQUIRREL_NAME = "Birch Q&A Squirrel";

const SQUIRREL_WHO = `Who you are to visitors: the ${BIRCH_SQUIRREL_NAME}, the friendly site-chat guide on birchreserve.net (same squirrel character as the Friday pipeline pages). Never call yourself Randy, "Randy from Birch Reserve", Randy's assistant, or Randy Gilling, and never describe yourself or the process with internal team labels or jargon. The chat opener already says hi as the ${BIRCH_SQUIRREL_NAME}, so do NOT open replies with an intro unless they ask who you are; jump straight into the answer with energy. If asked "who are you?", answer as the squirrel (for example: "I'm the ${BIRCH_SQUIRREL_NAME}. I help brands get early slots on the Reserve List inside recovery hubs. What are you working on?"). Never say you are Emma or Grok. If asked directly whether you are an AI, be honest: you're an AI guide for Birch Reserve, and offer a live callback from Randy's team. Never claim to be human. Calls are different: the Call button and "Get a call from Randy's AI" reach Randy's voice line, and callbacks come from Randy's team; say that plainly when you hand off.`;

/**
 * The vendored sales-brain prompt is shared with the phone line, where the
 * agent IS Randy. The site chat is the squirrel, so rewrite the identity lines
 * at load time (the vendored file stays byte-identical to sales-brain).
 */
export function applyBirchSquirrelPersona(prompt: string): string {
  let out = prompt
    .replace("SURFACE: birchreserve.net site chat. You are Randy from Birch Reserve.", `SURFACE: birchreserve.net site chat. You are the ${BIRCH_SQUIRREL_NAME} on Birch Reserve.`)
    .replace(
      /You are Randy \(introduce yourself as "Randy from" the surface brand, never by full name\), speaking by phone, browser voice, or site chat for/,
      `In this site chat you are the ${BIRCH_SQUIRREL_NAME} (introduce yourself only as "the ${BIRCH_SQUIRREL_NAME}"), the site-chat guide for`,
    )
    .replace(/^Who you are to visitors:.*$/m, SQUIRREL_WHO)
    .replace("(then honest: an AI version of Randy from the brand; offer live team callback)", `(then honest: an AI guide, the ${BIRCH_SQUIRREL_NAME}; offer a live callback from Randy's team)`)
    .replace('First line shape: "Hey, Randy from Birch Reserve. Thanks for calling. What brand are you with?"', 'First line shape (phone line only, not this chat): "Hey, thanks for calling Birch Reserve. What brand are you with?"');
  // Safety net for any identity phrasing the sales-brain adds later.
  out = out.replace(/\b(?:I'm|I am) Randy from Birch Reserve\b/g, `I'm the ${BIRCH_SQUIRREL_NAME}`).replace(/\bYou are Randy from Birch Reserve\b/g, `You are the ${BIRCH_SQUIRREL_NAME}`);
  return `${out}

---
## SITE-CHAT PERSONA LOCK (api-server, overrides anything above)
- You are the ${BIRCH_SQUIRREL_NAME}. Never introduce yourself as Randy or "Randy from Birch Reserve".
- Human handoffs stay accurate: calls reach Randy's AI voice line and callbacks come from Randy's team.
`;
}

export function loadVoiceCloserSystemPrompt(force = false): string {
  if (!force && cachedPrompt) return cachedPrompt;

  let prompt: string;
  const single = resolveBirchChatPromptPath();
  if (single) {
    prompt = stripOpsOnlySections(BIRCH_CHAT_PROMPT_FILE, readFileSync(single, "utf8").trim());
    cachedDir = path.dirname(single);
  } else {
    const legacy = loadLegacyPack();
    prompt = legacy.prompt;
    cachedDir = legacy.dir;
  }
  prompt = applyBirchSquirrelPersona(prompt);
  if (prompt.length > MAX_PACK_CHARS) {
    prompt = `${prompt.slice(0, MAX_PACK_CHARS)}\n\n[TRUNCATED for model context]`;
  }

  // Runtime locks echoed so a stale snapshot cannot silently hero $899 / live checkout.
  prompt += `

---
## RUNTIME HARD LOCKS (api-server)
- Public SKUs only: hold-190 ($190 USD), reserve-490 ($490 USD). Canadian buyers pay in CAD ($270 CAD look, $690 CAD seat); the checkout page shows the buyer's currency and has a USD/CAD toggle. Never hero $899 / reserve-899.
- Checkout is OFF: do not invent pay links or claim live checkout.
- Routing: only URLs in the routing table above; one per reply.
- You handle buyers yourself: close early slots on the Reserve List (https://birchreserve.net/inventory) and the $490 category prepay, never hold or lock a category; for partnerships or bigger deals take intake in chat and say the team will call back. Offer the AI call or a callback. Never promote the calendar; https://cal.com/randy-gilling/30min only if the visitor insists on a set time.
- In-widget voice is not live yet; reply in text.
`;

  cachedPrompt = prompt;
  return prompt;
}

export function getVoiceCloserKnowledgeMeta(): {
  dir: string | null;
  files: string[];
} {
  const dir = cachedDir ?? resolveVoiceCloserKnowledgeDir();
  return {
    dir,
    files: resolveBirchChatPromptPath() ? [BIRCH_CHAT_PROMPT_FILE] : [...VOICE_CLOSER_LOAD_ORDER],
  };
}
