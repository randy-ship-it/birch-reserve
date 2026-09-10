import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  db,
  splashAdReservationsTable,
  type SplashAdReservation,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

type SlackProxy = (
  path: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;

export type CreativeDeadlineWarningSender = (
  reservation: SplashAdReservation,
  deadline: Date,
) => Promise<void>;

const RESERVE_ALERT_SLACK_CHANNEL =
  process.env.SPLASH_RESERVE_SLACK_CHANNEL_ID?.trim() || "C0AUSTA1V9D";

function warningText(reservation: SplashAdReservation, deadline: Date): string {
  return [
    "Birch Reserve creative deadline approaching",
    `Reservation: ${reservation.id}`,
    `Brand: ${reservation.brandName ?? "Not provided"}`,
    `Work email: ${reservation.email}`,
    `Website: ${reservation.websiteUrl ?? "Not provided"}`,
    `Deadline: ${deadline.toISOString()}`,
    `Creative state: ${reservation.creativeStatus}`,
  ].join("\n");
}

function warningTimeoutMs(): number {
  const configured = Number(process.env.SPLASH_RESERVE_ALERT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 10_000)
    : 2_000;
}

export async function sendCreativeDeadlineSlackWarning(
  reservation: SplashAdReservation,
  deadline: Date,
  proxyOverride?: SlackProxy,
): Promise<void> {
  const proxy =
    proxyOverride ??
    ((path, options) => {
      const connectors = new ReplitConnectors();
      return connectors.proxy("slack", path, options);
    });
  const response = await proxy("/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: RESERVE_ALERT_SLACK_CHANNEL,
      client_msg_id: reservation.id,
      text: warningText(reservation, deadline),
    }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || body.ok !== true) {
    throw new Error(
      `Slack creative warning failed (${response.status}): ${body.error ?? "unknown_error"}`,
    );
  }
}

export async function deliverCreativeDeadlineWarning(
  reservation: SplashAdReservation,
  deadline: Date,
  options: {
    now: Date;
    send?: CreativeDeadlineWarningSender;
  },
): Promise<"sent" | "failed" | "skipped"> {
  const [claimed] = await db
    .update(splashAdReservationsTable)
    .set({
      creativeDeadlineWarningStatus: "sending",
      creativeDeadlineWarningAttemptedAt: options.now,
      creativeDeadlineWarningError: null,
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservation.id),
        eq(splashAdReservationsTable.status, "paid"),
        eq(splashAdReservationsTable.paymentStatus, "paid"),
        eq(splashAdReservationsTable.creativeStatus, "awaiting_upload"),
        inArray(splashAdReservationsTable.creativeDeadlineWarningStatus, [
          "pending",
          "failed",
        ]),
      ),
    )
    .returning();
  if (!claimed) return "skipped";

  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      (options.send ?? sendCreativeDeadlineSlackWarning)(claimed, deadline),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Slack creative warning delivery timed out")),
          warningTimeoutMs(),
        );
      }),
    ]);
    await db
      .update(splashAdReservationsTable)
      .set({
        creativeDeadlineWarningStatus: "sent",
        creativeDeadlineWarningError: null,
        creativeDeadlineWarningDeliveredAt: options.now,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, claimed.id),
          eq(
            splashAdReservationsTable.creativeDeadlineWarningStatus,
            "sending",
          ),
        ),
      );
    return "sent";
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    await db
      .update(splashAdReservationsTable)
      .set({
        creativeDeadlineWarningStatus: "failed",
        creativeDeadlineWarningError: message,
        creativeDeadlineWarningDeliveredAt: null,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, claimed.id),
          eq(
            splashAdReservationsTable.creativeDeadlineWarningStatus,
            "sending",
          ),
        ),
      );
    return "failed";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
