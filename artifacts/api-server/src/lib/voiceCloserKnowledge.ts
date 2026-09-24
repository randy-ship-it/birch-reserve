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

export function loadVoiceCloserSystemPrompt(force = false): string {
  if (!force && cachedPrompt) return cachedPrompt;

  const dir = resolveVoiceCloserKnowledgeDir();
  if (!dir) {
    throw new Error(
      "Voice-closer knowledge snapshot missing. Re-sync from birch-live-ops SoT into src/knowledge/voice-closer/.",
    );
  }

  const parts: string[] = [];
  for (const file of VOICE_CLOSER_LOAD_ORDER) {
    const full = path.join(dir, file);
    if (!existsSync(full)) continue;
    const body = stripOpsOnlySections(file, readFileSync(full, "utf8").trim());
    if (!body) continue;
    parts.push(`## FILE: ${file}\n\n${body}`);
  }

  if (parts.length === 0) {
    throw new Error("Voice-closer knowledge pack empty after sync.");
  }

  let prompt = parts.join("\n\n---\n\n");
  if (prompt.length > MAX_PACK_CHARS) {
    prompt = `${prompt.slice(0, MAX_PACK_CHARS)}\n\n[TRUNCATED for model context — prefer SoT files on disk]`;
  }

  // Runtime locks echoed so a stale snapshot cannot silently hero $899 / live checkout.
  prompt += `

---
## RUNTIME HARD LOCKS (api-server)
- Public SKUs only: hold-190 ($190), reserve-490 ($490). Never hero $899 / reserve-899.
- Checkout is OFF until Gordon — do not invent pay links or claim live checkout.
- Routing: only URLs in the ROUTING-URLS.md table above; one per reply.
- Next step after qualifying is an AI call first (tel or callback in chat). Cal https://cal.com/randy-gilling/30min only after qualifying questions AND the call/callback step.
- Tel: +1 (504) 504-6526 / tel:+15045046526.
- In-widget voice is not live yet ("Voice coming soon"); reply in text and never claim live in-widget voice.
`;

  cachedPrompt = prompt;
  cachedDir = dir;
  return prompt;
}

export function getVoiceCloserKnowledgeMeta(): {
  dir: string | null;
  files: string[];
} {
  const dir = cachedDir ?? resolveVoiceCloserKnowledgeDir();
  return {
    dir,
    files: [...VOICE_CLOSER_LOAD_ORDER],
  };
}
