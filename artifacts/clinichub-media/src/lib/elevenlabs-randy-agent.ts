/**
 * Hear Randy — ElevenLabs Conversational AI agent (sales-brain birch phone SoT).
 * ONE brain: widget talks only to this agent_id. Do not pass override-prompt /
 * override-first-message / override-voice-id from the embed.
 */
export const ELEVENLABS_RANDY_AGENT_ID = "agent_4401m3b29dawf1rsffvy4c6a7gv7" as const;

/** Absolute avatar for the ConvAI widget chrome. */
export const ELEVENLABS_RANDY_AVATAR_URL =
  "https://birchreserve.net/avatars/randy-head.png" as const;

/** Same avatar, served from the page's own host on the Scale mirror (stays on scalehealth.ca). */
export function randyAvatarUrl(): string {
  const m = typeof window !== "undefined" ? (window as { __BR_MIRROR?: { skin?: string } }).__BR_MIRROR : undefined;
  return m?.skin === "scale" ? `${window.location.origin}/intake/_m/avatars/randy-head.png` : ELEVENLABS_RANDY_AVATAR_URL;
}

/** Optional Vite override; defaults to the production Hear Randy agent. */
export function resolveElevenLabsRandyAgentId(): string {
  const fromEnv = String(import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "").trim();
  return fromEnv || ELEVENLABS_RANDY_AGENT_ID;
}
