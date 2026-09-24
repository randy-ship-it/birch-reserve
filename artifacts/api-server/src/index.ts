import { seedPublicInsights } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { startSplashReservationCleanup } from "./lib/splashReservationLifecycle";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void seedPublicInsights()
    .then((result) => {
      logger.info(result, "Public insights seed finished");
    })
    .catch((error) => {
      logger.error({ err: error }, "Public insights seed failed");
    });
  startSplashReservationCleanup((error) => {
    logger.error({ err: error }, "Splash reservation cleanup failed");
  });
});
