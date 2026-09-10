import pino from "pino";
import { ReplitConnectors } from "@replit/connectors-sdk";

type ProxyForwardingAlertSender = (text: string) => Promise<void>;

const EXPECTED_FORWARDED_ENTRIES = 1;
const DEFAULT_ALERT_THRESHOLD = 3;
const DEFAULT_WINDOW_MS = 5 * 60_000;
const DEFAULT_COOLDOWN_MS = 15 * 60_000;
const RESERVE_ALERT_SLACK_CHANNEL =
  process.env.SPLASH_RESERVE_SLACK_CHANNEL_ID?.trim() || "C0AUSTA1V9D";

let forwardingMismatchTimestamps: number[] = [];
let lastForwardingAlertAt = Number.NEGATIVE_INFINITY;
let proxyForwardingAlertSender: ProxyForwardingAlertSender =
  process.env.NODE_ENV === "test"
    ? async () => undefined
    : sendProxyForwardingSlackAlert;

const usePrettyTransport = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers.x-forwarded-for",
    "req.headers['x-forwarded-for']",
    "res.headers['set-cookie']",
  ],
  ...(usePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function forwardedEntryCount(header: string | undefined): number {
  if (!header) return 0;
  return header.split(",").filter((entry) => entry.trim().length > 0).length;
}

async function sendProxyForwardingSlackAlert(text: string): Promise<void> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("slack", "/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: RESERVE_ALERT_SLACK_CHANNEL,
      text,
    }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || body.ok !== true) {
    throw new Error(
      `Slack proxy-forwarding alert failed (${response.status}): ${body.error ?? "unknown_error"}`,
    );
  }
}

export function recordUcpProxyForwardingShape(
  requestLogger: Pick<typeof logger, "warn" | "error">,
  forwardedFor: string | undefined,
  now = Date.now(),
): void {
  const observedEntries = forwardedEntryCount(forwardedFor);
  if (observedEntries === EXPECTED_FORWARDED_ENTRIES) return;

  const windowMs = positiveInteger(
    process.env.UCP_PROXY_MISMATCH_WINDOW_MS,
    DEFAULT_WINDOW_MS,
  );
  const threshold = positiveInteger(
    process.env.UCP_PROXY_MISMATCH_ALERT_THRESHOLD,
    DEFAULT_ALERT_THRESHOLD,
  );
  const cooldownMs = positiveInteger(
    process.env.UCP_PROXY_MISMATCH_ALERT_COOLDOWN_MS,
    DEFAULT_COOLDOWN_MS,
  );
  forwardingMismatchTimestamps = forwardingMismatchTimestamps.filter(
    (timestamp) => now - timestamp < windowMs,
  );
  forwardingMismatchTimestamps.push(now);

  const shape = observedEntries === 0 ? "missing" : "multiple";
  requestLogger.warn(
    {
      signal: "ucp_proxy_forwarding_shape_mismatch",
      forwardingShape: shape,
      observedForwardedEntries: observedEntries,
      expectedForwardedEntries: EXPECTED_FORWARDED_ENTRIES,
      mismatchCountInWindow: forwardingMismatchTimestamps.length,
    },
    "UCP proxy forwarding shape differs from the expected Replit topology",
  );

  if (
    forwardingMismatchTimestamps.length < threshold ||
    now - lastForwardingAlertAt < cooldownMs
  ) {
    return;
  }
  lastForwardingAlertAt = now;
  const text = [
    "Birch Reserve UCP proxy forwarding drift detected",
    `Expected forwarded entries: ${EXPECTED_FORWARDED_ENTRIES}`,
    `Repeated mismatches in window: ${forwardingMismatchTimestamps.length}`,
    `Latest observed shape: ${shape}`,
    `Latest observed entry count: ${observedEntries}`,
    "No buyer addresses were included.",
  ].join("\n");
  void proxyForwardingAlertSender(text).catch((error) => {
    requestLogger.error(
      {
        err: error,
        signal: "ucp_proxy_forwarding_alert_delivery_failed",
      },
      "Unable to alert operators about UCP proxy forwarding drift",
    );
  });
}

export function setUcpProxyForwardingAlertForTests(
  sender?: ProxyForwardingAlertSender,
): void {
  forwardingMismatchTimestamps = [];
  lastForwardingAlertAt = Number.NEGATIVE_INFINITY;
  proxyForwardingAlertSender =
    sender ??
    (process.env.NODE_ENV === "test"
      ? async () => undefined
      : sendProxyForwardingSlackAlert);
}
