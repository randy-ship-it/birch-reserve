import type { IncomingMessage, ServerResponse } from "node:http";
import { pool, seedPublicInsights } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { applyAdditiveColumns, SPLASH_HYGIENE_DDL } from "./lib/schemaEnsure";

/**
 * Vercel invokes this file as a Node function. It does not call src/index.ts,
 * so nothing listens on PORT and the splash-expiry interval stays on the
 * long-running process. Trust every proxy hop: Vercel appends more than one.
 */
app.set("trust proxy", true);

let booted = false;

function bootOnce(): void {
  if (booted) return;
  booted = true;
  void seedPublicInsights()
    .then((result) => {
      logger.info(result, "Public insights seed finished");
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Public insights seed failed");
    });
  void applyAdditiveColumns(pool, SPLASH_HYGIENE_DDL).catch((error: unknown) => {
    logger.error({ err: error }, "splash_ad_reservations.is_test ensure failed");
  });
}

export default function vercelHandler(req: IncomingMessage, res: ServerResponse): void {
  bootOnce();
  app(req, res);
}
