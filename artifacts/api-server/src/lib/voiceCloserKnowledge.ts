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
  if (prompt.length > MAX_PACK_CHARS) {
    prompt = `${prompt.slice(0, MAX_PACK_CHARS)}\n\n[TRUNCATED for model context]`;
  }

  // Runtime locks echoed so a stale snapshot cannot silently hero $899 / live checkout.
  prompt += `

---
## RUNTIME HARD LOCKS (api-server)
- Public SKUs only: hold-190 ($190), reserve-490 ($490). Never hero $899 / reserve-899.
- Checkout is OFF: do not invent pay links or claim live checkout.
- Routing: only URLs in the routing table above; one per reply.
- After qualifying, the next step is the AI call or a callback in chat. Cal https://cal.com/randy-gilling/30min only after qualifying AND the call/callback step.
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
