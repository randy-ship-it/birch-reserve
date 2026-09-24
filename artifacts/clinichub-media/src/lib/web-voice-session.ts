/**
 * Web voice session reporter (pure: no React, no DOM globals at import, no alias
 * imports, so node tests can load it).
 *
 * The in-browser live voice client ("AI call now", the chat Call chip,
 * /sales/voice-demo) reports each session to POST /api/voice/web-session-ended
 * when it ends, including unexpected closes: on pagehide / tab hidden it flushes
 * with navigator.sendBeacon (fallback fetch keepalive). The server is idempotent
 * on sessionId, so an explicit end plus a pagehide flush merge into one record.
 * Contact fields are only ever sent to our own API; nothing is echoed back.
 */

export const WEB_VOICE_SESSION_API = "/api/voice/web-session-ended";
/** Beacons and keepalive fetches are capped around 64kb; stay under it. */
export const MAX_WEB_VOICE_PAYLOAD_BYTES = 60_000;
const MAX_TURNS = 300;
const MAX_TURN_CHARS = 2000;

export type WebVoiceTurn = { role: "user" | "assistant"; content: string; at?: string };
export type WebVoiceFields = Partial<Record<"name" | "company" | "role" | "phone" | "email" | "need" | "size" | "timing", string>>;
export type WebVoiceSurface = "ai_call_now" | "call_chip" | "voice_demo" | (string & {});

export type WebVoiceSessionState = {
  sessionId: string;
  chatSessionId?: string;
  surface: WebVoiceSurface;
  pagePath?: string;
  startedAt: string;
  turns: WebVoiceTurn[];
  fields: WebVoiceFields;
};

export type WebVoiceTransport = {
  beacon?: (url: string, body: string) => boolean;
  fetch?: (url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive: boolean }) => Promise<unknown>;
};

export function newWebVoiceSessionId(rand: () => string = () => Math.random().toString(36).slice(2)): string {
  return `wv_${Date.now().toString(36)}_${rand().replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "x"}`;
}

function byteLength(s: string): number {
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : s.length * 3;
}

/** Server-shaped payload; drops the oldest turns until it fits a beacon. */
export function buildWebVoicePayload(state: WebVoiceSessionState, endReason: string, now: Date = new Date()): string {
  const fields: WebVoiceFields = {};
  for (const [k, v] of Object.entries(state.fields)) {
    if (typeof v === "string" && v.trim()) fields[k as keyof WebVoiceFields] = v.trim().slice(0, 300);
  }
  let turns = state.turns
    .filter((t) => (t.role === "user" || t.role === "assistant") && t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.trim().slice(0, MAX_TURN_CHARS), ...(t.at ? { at: t.at.slice(0, 40) } : {}) }))
    .slice(-MAX_TURNS);
  const build = () =>
    JSON.stringify({
      sessionId: state.sessionId,
      ...(state.chatSessionId ? { chatSessionId: state.chatSessionId } : {}),
      surface: state.surface.slice(0, 40),
      ...(state.pagePath ? { pagePath: state.pagePath.slice(0, 300) } : {}),
      startedAt: state.startedAt,
      endedAt: now.toISOString(),
      endReason: endReason.slice(0, 80),
      transcript: turns,
      fields,
    });
  let body = build();
  while (byteLength(body) > MAX_WEB_VOICE_PAYLOAD_BYTES && turns.length > 0) {
    turns = turns.slice(Math.max(1, Math.ceil(turns.length / 10)));
    body = build();
  }
  return body;
}

export class WebVoiceSessionReporter {
  private state: WebVoiceSessionState | null = null;
  private lastSent = "";
  private readonly transport: WebVoiceTransport;

  constructor(transport?: WebVoiceTransport) {
    this.transport = transport ?? defaultTransport();
  }

  get active(): boolean {
    return this.state !== null;
  }

  start(opts: { surface: WebVoiceSurface; chatSessionId?: string; pagePath?: string; sessionId?: string; now?: Date }): string {
    this.state = {
      sessionId: opts.sessionId ?? newWebVoiceSessionId(),
      surface: opts.surface,
      startedAt: (opts.now ?? new Date()).toISOString(),
      turns: [],
      fields: {},
      ...(opts.chatSessionId ? { chatSessionId: opts.chatSessionId } : {}),
      ...(opts.pagePath ? { pagePath: opts.pagePath } : {}),
    };
    this.lastSent = "";
    return this.state.sessionId;
  }

  addTurn(role: WebVoiceTurn["role"], content: string, at?: string): void {
    if (!this.state || !content.trim()) return;
    this.state.turns.push({ role, content, ...(at ? { at } : {}) });
    if (this.state.turns.length > MAX_TURNS * 2) this.state.turns = this.state.turns.slice(-MAX_TURNS);
  }

  /** Replace the whole transcript (clients that keep their own cumulative list). */
  setTurns(turns: WebVoiceTurn[]): void {
    if (this.state) this.state.turns = [...turns];
  }

  setFields(fields: WebVoiceFields): void {
    if (this.state) this.state.fields = { ...this.state.fields, ...fields };
  }

  /** Unexpected close (pagehide / hidden): send what we have, keep the session open. */
  flush(reason = "pagehide", now?: Date): boolean {
    return this.send(reason, now, true);
  }

  /** Normal end: send and close the session. */
  end(reason = "ended", now?: Date): boolean {
    const sent = this.send(reason, now, false);
    this.state = null;
    this.lastSent = "";
    return sent;
  }

  private send(reason: string, now: Date | undefined, preferBeacon: boolean): boolean {
    if (!this.state) return false;
    const body = buildWebVoicePayload(this.state, reason, now);
    // Skip exact repeats (same transcript + fields); endedAt/reason alone is not news.
    const fingerprint = JSON.stringify([this.state.turns.length, this.state.turns.at(-1)?.content ?? "", this.state.fields]);
    if (fingerprint === this.lastSent) return false;
    this.lastSent = fingerprint;
    if (preferBeacon && this.transport.beacon?.(WEB_VOICE_SESSION_API, body)) return true;
    if (this.transport.fetch) {
      void this.transport
        .fetch(WEB_VOICE_SESSION_API, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true })
        .catch(() => undefined);
      return true;
    }
    return Boolean(this.transport.beacon?.(WEB_VOICE_SESSION_API, body));
  }
}

function defaultTransport(): WebVoiceTransport {
  const g = globalThis as unknown as {
    navigator?: { sendBeacon?: (url: string, data: Blob) => boolean };
    fetch?: WebVoiceTransport["fetch"];
    Blob?: typeof Blob;
  };
  return {
    beacon: (url, body) => {
      try {
        if (!g.navigator?.sendBeacon || !g.Blob) return false;
        return g.navigator.sendBeacon(url, new g.Blob([body], { type: "application/json" }));
      } catch {
        return false;
      }
    },
    ...(g.fetch ? { fetch: (url, init) => g.fetch!(url, init) } : {}),
  };
}
