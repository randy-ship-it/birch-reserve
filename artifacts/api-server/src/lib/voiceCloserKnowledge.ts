/**
 * Loads the vendored voice-closer knowledge pack for Chat Randy (Grok).
 * SoT remains /workspace/birch-live-ops/voice-closer/knowledge/ — this is a snapshot.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Practical concat order (README paste order, size-aware). */
export const VOICE_CLOSER_LOAD_ORDER = [
  "SYSTEM-PROMPT.md",
  "NEVER-SAY.md",
  "BIRCH-OFFER.md",
  "CROSS-PORTFOLIO.md",
  "HANDOFF-CHECKLIST.md",
  "SCALE.md",
  "ALIGN.md",
  "RDGDH-PORTFOLIO.md",
  "TEAM-ACCESS.md",
] as const;

const MAX_PACK_CHARS = 48_000;

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
    const body = readFileSync(full, "utf8").trim();
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
- Cal https://cal.com/randy-gilling/30min only after qualify (2–3 discovery / clear fit).
- Tel: +1 (504) 504-6526 / tel:+15045046526.
- Mode hear: reply in text; realtime Eve/Grok voice is pending — do not claim live in-widget voice.
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
