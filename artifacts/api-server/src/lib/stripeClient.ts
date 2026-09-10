import Stripe from "stripe";
import { ReplitConnectors } from "@replit/connectors-sdk";

type ProxyOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export class StripeProxyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
  }
}

async function stripeProxy<T>(path: string, options?: ProxyOptions): Promise<T> {
  const response = await new ReplitConnectors().proxy("stripe", path, options);
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new StripeProxyError(
      payload.error?.message ?? `Stripe request failed (${response.status}).`,
      response.status,
      payload,
    );
  }
  return payload;
}

export function retrieveStripePrice(priceId: string): Promise<Stripe.Price> {
  return stripeProxy<Stripe.Price>(`/v1/prices/${encodeURIComponent(priceId)}`);
}

export function retrieveStripeCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  return stripeCheckoutSessionRetriever(sessionId);
}

let stripeCheckoutSessionRetriever = (
  sessionId: string,
): Promise<Stripe.Checkout.Session> =>
  stripeProxy<Stripe.Checkout.Session>(
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );

export function expireStripeCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  return stripeCheckoutSessionExpirer(sessionId);
}

let stripeCheckoutSessionExpirer = (
  sessionId: string,
): Promise<Stripe.Checkout.Session> =>
  stripeProxy<Stripe.Checkout.Session>(
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
    { method: "POST" },
  );

export function createStripeCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
  idempotencyKey: string,
): Promise<Stripe.Checkout.Session> {
  return stripeCheckoutSessionCreator(params, idempotencyKey);
}

export type StripeTokenPaymentIntentParams = {
  amount: number;
  currency: string;
  token: string;
  metadata: Record<string, string>;
};

export type StripeDelegatedPaymentTokenKind =
  | "card_token"
  | "shared_payment_granted_token";

export function getStripeDelegatedPaymentTokenKind(
  token: string,
): StripeDelegatedPaymentTokenKind | null {
  if (/^tok_[A-Za-z0-9_]{8,200}$/.test(token)) return "card_token";
  if (/^spt_[A-Za-z0-9_]{3,200}$/.test(token)) {
    return "shared_payment_granted_token";
  }
  return null;
}

export function buildStripeTokenPaymentIntentBody(
  params: StripeTokenPaymentIntentParams,
): URLSearchParams {
  const tokenKind = getStripeDelegatedPaymentTokenKind(params.token);
  if (!tokenKind) {
    throw new Error("Unsupported delegated Stripe payment token.");
  }
  const body = new URLSearchParams();
  body.set("amount", String(params.amount));
  body.set("currency", params.currency);
  if (tokenKind === "shared_payment_granted_token") {
    body.set(
      "payment_method_data[shared_payment_granted_token]",
      params.token,
    );
  } else {
    body.set("payment_method_types[]", "card");
    body.set("payment_method_data[type]", "card");
    body.set("payment_method_data[card][token]", params.token);
  }
  body.set("confirm", "true");
  Object.entries(params.metadata ?? {}).forEach(([key, value]) => {
    if (value != null) body.set(`metadata[${key}]`, String(value));
  });
  return body;
}

export function isDefinitelyUncreatedStripePaymentIntentError(
  error: unknown,
): boolean {
  return (
    error instanceof StripeProxyError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 409 &&
    error.status !== 429
  );
}

export function createAndConfirmStripePaymentIntent(
  params: StripeTokenPaymentIntentParams,
  idempotencyKey: string,
): Promise<Stripe.PaymentIntent> {
  return stripePaymentIntentCreator(params, idempotencyKey);
}

export function retrieveStripePaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> {
  return stripePaymentIntentRetriever(paymentIntentId);
}

export function cancelStripePaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> {
  return stripePaymentIntentCanceler(paymentIntentId);
}

let stripePaymentIntentRetriever = (
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> => {
  return stripeProxy<Stripe.PaymentIntent>(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
  );
};

let stripePaymentIntentCanceler = (
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> => {
  return stripeProxy<Stripe.PaymentIntent>(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
    { method: "POST" },
  );
};

let stripePaymentIntentCreator = (
  params: StripeTokenPaymentIntentParams,
  idempotencyKey: string,
): Promise<Stripe.PaymentIntent> => {
  const body = buildStripeTokenPaymentIntentBody(params);
  return stripeProxy<Stripe.PaymentIntent>("/v1/payment_intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: body.toString(),
    })
    .catch((error: unknown) => {
      if (error instanceof StripeProxyError) {
        const stripeError = (error.payload as {
          error?: { payment_intent?: unknown };
        }).error;
        if (
          stripeError?.payment_intent &&
          typeof stripeError.payment_intent === "object"
        ) {
          return stripeError.payment_intent as Stripe.PaymentIntent;
        }
      }
      throw error;
    });
};

let stripeCheckoutSessionCreator = (
  params: Stripe.Checkout.SessionCreateParams,
  idempotencyKey: string,
): Promise<Stripe.Checkout.Session> => {
  const body = new URLSearchParams();
  body.set("mode", params.mode ?? "payment");
  if (params.client_reference_id) {
    body.set("client_reference_id", params.client_reference_id);
  }
  if (params.customer_email) body.set("customer_email", params.customer_email);
  params.line_items?.forEach((item, index) => {
    if (typeof item.price === "string") {
      body.set(`line_items[${index}][price]`, item.price);
    } else if (item.price_data) {
      body.set(
        `line_items[${index}][price_data][currency]`,
        item.price_data.currency,
      );
      body.set(
        `line_items[${index}][price_data][unit_amount]`,
        String(item.price_data.unit_amount),
      );
      if (item.price_data.product_data?.name) {
        body.set(
          `line_items[${index}][price_data][product_data][name]`,
          item.price_data.product_data.name,
        );
      }
    }
    body.set(`line_items[${index}][quantity]`, String(item.quantity ?? 1));
  });
  Object.entries(params.metadata ?? {}).forEach(([key, value]) => {
    if (value != null) body.set(`metadata[${key}]`, String(value));
  });
  Object.entries(params.payment_intent_data?.metadata ?? {}).forEach(
    ([key, value]) => {
      if (value != null) {
        body.set(`payment_intent_data[metadata][${key}]`, String(value));
      }
    },
  );
  if (params.success_url) body.set("success_url", params.success_url);
  if (params.cancel_url) body.set("cancel_url", params.cancel_url);
  body.set(
    "allow_promotion_codes",
    params.allow_promotion_codes === true ? "true" : "false",
  );

  return stripeProxy<Stripe.Checkout.Session>("/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: body.toString(),
  });
};

export function setStripeCheckoutFunctionsForTests(overrides?: {
  create?: typeof stripeCheckoutSessionCreator;
  expire?: typeof stripeCheckoutSessionExpirer;
  retrieve?: typeof stripeCheckoutSessionRetriever;
}): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Stripe checkout overrides are test-only.");
  }
  stripeCheckoutSessionCreator =
    overrides?.create ??
    ((params, idempotencyKey) => {
      const body = new URLSearchParams();
      body.set("mode", params.mode ?? "payment");
      if (params.client_reference_id) {
        body.set("client_reference_id", params.client_reference_id);
      }
      if (params.customer_email) body.set("customer_email", params.customer_email);
      params.line_items?.forEach((item, index) => {
        if (typeof item.price === "string") {
          body.set(`line_items[${index}][price]`, item.price);
        } else if (item.price_data) {
          body.set(`line_items[${index}][price_data][currency]`, item.price_data.currency);
          body.set(
            `line_items[${index}][price_data][unit_amount]`,
            String(item.price_data.unit_amount),
          );
          if (item.price_data.product_data?.name) {
            body.set(
              `line_items[${index}][price_data][product_data][name]`,
              item.price_data.product_data.name,
            );
          }
        }
        body.set(`line_items[${index}][quantity]`, String(item.quantity ?? 1));
      });
      Object.entries(params.metadata ?? {}).forEach(([key, value]) => {
        if (value != null) body.set(`metadata[${key}]`, String(value));
      });
      Object.entries(params.payment_intent_data?.metadata ?? {}).forEach(
        ([key, value]) => {
          if (value != null) {
            body.set(`payment_intent_data[metadata][${key}]`, String(value));
          }
        },
      );
      if (params.success_url) body.set("success_url", params.success_url);
      if (params.cancel_url) body.set("cancel_url", params.cancel_url);
      body.set(
        "allow_promotion_codes",
        params.allow_promotion_codes === true ? "true" : "false",
      );
      return stripeProxy<Stripe.Checkout.Session>("/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotencyKey,
        },
        body: body.toString(),
      });
    });
  stripeCheckoutSessionExpirer =
    overrides?.expire ??
    ((sessionId) =>
      stripeProxy<Stripe.Checkout.Session>(
        `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
        { method: "POST" },
      ));
  stripeCheckoutSessionRetriever =
    overrides?.retrieve ??
    ((sessionId) =>
      stripeProxy<Stripe.Checkout.Session>(
        `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      ));
}

export function setStripePaymentIntentFunctionForTests(
  create?: typeof stripePaymentIntentCreator,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Stripe payment intent overrides are test-only.");
  }
  stripePaymentIntentCreator =
    create ??
    ((params, idempotencyKey) => {
      const body = buildStripeTokenPaymentIntentBody(params);
      return stripeProxy<Stripe.PaymentIntent>("/v1/payment_intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotencyKey,
        },
        body: body.toString(),
      });
    });
}

export function setStripePaymentIntentRetrieverForTests(
  retrieve?: (paymentIntentId: string) => Promise<Stripe.PaymentIntent>,
): void {
  stripePaymentIntentRetriever =
    retrieve ??
    ((paymentIntentId) =>
      stripeProxy<Stripe.PaymentIntent>(
        `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
      ));
}

export function setStripePaymentIntentCancelerForTests(
  cancel?: (paymentIntentId: string) => Promise<Stripe.PaymentIntent>,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Stripe payment intent overrides are test-only.");
  }
  stripePaymentIntentCanceler =
    cancel ??
    ((paymentIntentId) =>
      stripeProxy<Stripe.PaymentIntent>(
        `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
        { method: "POST" },
      ));
}

/**
 * Stripe credentials are supplied by the Replit Stripe connection at runtime.
 * Never move this lookup to the browser or cache a client across requests.
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not connected.");
  }

  return new Stripe(secretKey);
}