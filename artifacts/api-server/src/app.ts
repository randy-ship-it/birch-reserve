import express, { type Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import router from "./routes/index";
import { randyChatJsonParser } from "./routes/randyChat";
import publicBuyingRouter from "./routes/publicBuying";
import { logger } from "./lib/logger";
import { uiEventsJsonParser } from "./lib/uiEvents";
import { handleStripeWebhook } from "./routes/splashAdReservations";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// Replit terminates public traffic at one proxy hop. Trust only that immediate
// hop so req.ip uses the rightmost forwarded address and ignores caller-added
// entries farther to the left.
app.set("trust proxy", (_address: string, hop: number) => hop === 0);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Public machine-buying and human-buying surfaces never require Clerk.
// Parse only their JSON checkout body here so Stripe's later raw webhook
// middleware remains untouched.
app.use("/v1/ui-events", uiEventsJsonParser());
app.use("/v1/checkout", express.json({ limit: "32kb" }));
app.use("/v1/orders", express.json({ limit: "32kb" }));
app.use(
  "/ucp/v1",
  express.json({
    limit: "32kb",
    verify: (req, _res, body) => {
      (
        req as express.Request & {
          ucpRawBody?: Buffer;
        }
      ).ucpRawBody = Buffer.from(body);
    },
  }),
);
app.use(publicBuyingRouter);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Stripe signs the raw request body. This must be registered before JSON parsing.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing Stripe signature." });
      return;
    }

    try {
      await handleStripeWebhook(
        req.body as Buffer,
        Array.isArray(signature) ? signature[0] ?? "" : signature,
      );
      res.status(200).json({ received: true });
    } catch (error) {
      req.log.error({ err: error }, "Stripe webhook processing failed");
      res.status(400).json({ error: "Invalid Stripe webhook." });
    }
  },
);

// Chat Randy sends the whole thread; give it a bigger limit than the 32kb default
// (a long chat used to 413 into the widget's error card).
app.use("/api/launch/randy-chat", randyChatJsonParser());
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));

// ── Application routes ────────────────────────────────────────────────────────
// Machine-buying and human-buying surfaces intentionally live at the origin
// root and must remain ahead of any frontend fallback.
app.use(publicBuyingRouter);
app.use("/api", router);

export default app;
