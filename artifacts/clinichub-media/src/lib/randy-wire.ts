/**
 * Chat Randy wire helpers (pure, no DOM / alias imports so node tests can load them).
 *
 * Quiet retry (fix for the 2026-09-24 5:43pm iPhone "connection dropped" card):
 * iOS Safari reuses a pooled HTTP/2 or HTTP/3 connection that can die while the
 * tab is in the background (e.g. during the phone call from the Call button, or an
 * LTE handoff). The next POST on that dead socket rejects immediately with
 * TypeError "Load failed", and iOS never auto-retries a POST. So one transient
 * failure is retried once, silently, on a fresh connection before the widget
 * shows the error card.
 */

export type WireMessage = { role: "user" | "assistant"; content: string };

export type WireFailureKind = "timeout" | "network" | "rate_limited" | "rejected" | "unavailable";

export type WireAttempt<T> = { ok: true; value: T } | { ok: "stub" } | { ok: false; kind: WireFailureKind; status?: number };

/** Short backoff before the single quiet retry. */
export const QUIET_RETRY_BACKOFF_MS = 700;
/**
 * Only retry when the first try failed fast. A slow failure (server gave Grok its
 * full 22s, or the client hit its own 25s timeout) is not retried: the visitor has
 * already waited, so the card with Retry / Call is the kinder answer.
 */
export const QUIET_RETRY_MAX_FIRST_MS = 12_000;

/** Transient = worth one quiet retry. 4xx (bad request / rate limit) and timeouts are not. */
export function isTransientFailure(f: { kind: WireFailureKind; status?: number }): boolean {
  if (f.kind === "network") return true;
  if (f.kind === "unavailable") return true; // 5xx from our API or the proxy, or an empty reply
  if (f.kind === "rejected") return f.status === 408 || f.status === 425;
  return false;
}

export async function withQuietRetry<T>(
  attempt: () => Promise<WireAttempt<T>>,
  opts: {
    backoffMs?: number;
    maxFirstMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    onRetry?: (kind: WireFailureKind) => void;
  } = {},
): Promise<WireAttempt<T>> {
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = now();
  const first = await attempt();
  if (first.ok !== false) return first;
  if (!isTransientFailure(first)) return first;
  if (now() - started > (opts.maxFirstMs ?? QUIET_RETRY_MAX_FIRST_MS)) return first;
  opts.onRetry?.(first.kind);
  await sleep(opts.backoffMs ?? QUIET_RETRY_BACKOFF_MS);
  return attempt();
}

/** Server JSON limit is 256kb; stay well under it (and keep mobile uploads small). */
export const MAX_WIRE_CHARS = 60_000;

/**
 * Drop the oldest turns until the thread fits the wire budget. Always keeps the
 * latest turn. The server stores the full thread in its transcript already
 * (mergeMessages keeps earlier turns when the client trims the head).
 */
export function fitWireBudget<M extends WireMessage>(messages: M[], maxChars = MAX_WIRE_CHARS): M[] {
  let total = messages.reduce((n, m) => n + m.content.length + 32, 0);
  let start = 0;
  while (total > maxChars && start < messages.length - 1) {
    total -= messages[start]!.content.length + 32;
    start += 1;
  }
  return start ? messages.slice(start) : messages;
}
