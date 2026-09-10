import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../src/app";
import {
  createFallbackAdvice,
  generateConciergeAdvice,
} from "../src/routes/concierge";

let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

before(async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  baseUrl = `http://127.0.0.1:${address.port}/api`;
  closeServer = () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
});

after(async () => {
  await closeServer?.();
});

type AdviceSignals = {
  bookingIntent: boolean;
  awarenessIntent: boolean;
  comparisonIntent: boolean;
  privateReviewIntent: boolean;
  sensitiveContentDetected: boolean;
  selectedInterest?: "performance" | "display" | "both";
};

const neutralSignals: AdviceSignals = {
  bookingIntent: false,
  awarenessIntent: false,
  comparisonIntent: false,
  privateReviewIntent: false,
  sensitiveContentDetected: false,
};

async function requestAdvice(signals: AdviceSignals) {
  const response = await fetch(`${baseUrl}/launch/concierge/advice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(signals),
  });

  assert.equal(response.status, 200);
  return (await response.json()) as {
    message: string;
    recommendedInterest?: string;
    suggestions: string[];
    handoffAllowed: boolean;
    source: string;
  };
}

test("static concierge classifies all three advertising paths", async () => {
  const performance = await requestAdvice({
    ...neutralSignals,
    bookingIntent: true,
  });
  assert.equal(performance.recommendedInterest, "performance");
  assert.equal(performance.handoffAllowed, true);
  assert.equal(performance.source, "fallback");

  const display = await requestAdvice({
    ...neutralSignals,
    awarenessIntent: true,
  });
  assert.equal(display.recommendedInterest, "display");
  assert.equal(display.handoffAllowed, true);

  const both = await requestAdvice({
    ...neutralSignals,
    comparisonIntent: true,
  });
  assert.equal(both.recommendedInterest, "both");
  assert.equal(both.handoffAllowed, true);
});

test("withheld sensitive content returns static privacy guidance", async () => {
  const advice = await requestAdvice({
    ...neutralSignals,
    sensitiveContentDetected: true,
  });

  assert.equal(advice.recommendedInterest, undefined);
  assert.equal(advice.handoffAllowed, false);
  assert.match(advice.message, /keep contact.*health/i);
});

test("sensitive-content signals are blocked before provider use", async () => {
  const originalDisabled = process.env["CONCIERGE_AI_DISABLED"];
  delete process.env["CONCIERGE_AI_DISABLED"];
  let providerCalled = false;

  try {
    const advice = await generateConciergeAdvice(
      {
        ...neutralSignals,
        sensitiveContentDetected: true,
      },
      async () => {
        providerCalled = true;
        return { recommendedInterest: "display" };
      },
    );

    assert.equal(providerCalled, false);
    assert.equal(advice.source, "fallback");
    assert.equal(advice.recommendedInterest, undefined);
  } finally {
    process.env["CONCIERGE_AI_DISABLED"] = originalDisabled ?? "true";
  }
});

test("commercial questions are routed to private review without claims", async () => {
  const advice = await requestAdvice({
    ...neutralSignals,
    privateReviewIntent: true,
    selectedInterest: "display",
  });

  assert.equal(advice.recommendedInterest, "display");
  assert.deepEqual(advice.suggestions, ["display", "private_review"]);
  assert.match(advice.message, /reviewed privately/i);
  assert.doesNotMatch(advice.message, /\d+%|guaranteed inventory/i);
});

test("raw question text and malformed or unknown inputs are rejected", async () => {
  for (const payload of [
    {},
    { ...neutralSignals, message: "This raw text must not be accepted." },
    { ...neutralSignals, bookingIntent: "yes" },
    { ...neutralSignals, selectedInterest: "search" },
    { ...neutralSignals, adminSecret: "not-accepted" },
  ]) {
    const response = await fetch(`${baseUrl}/launch/concierge/advice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400);
  }
});

test("cross-origin browser requests are rejected", async () => {
  const response = await fetch(`${baseUrl}/launch/concierge/advice`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://untrusted.example",
    },
    body: JSON.stringify(neutralSignals),
  });

  assert.equal(response.status, 403);
});

test("invalid model recommendations are discarded in favor of approved fallback", async () => {
  const originalDisabled = process.env["CONCIERGE_AI_DISABLED"];
  delete process.env["CONCIERGE_AI_DISABLED"];

  try {
    const advice = await generateConciergeAdvice(
      { ...neutralSignals, bookingIntent: true },
      async () =>
        ({
          recommendedInterest: "guaranteed_inventory",
        }) as never,
    );

    assert.equal(advice.source, "fallback");
    assert.equal(advice.recommendedInterest, "performance");
  } finally {
    process.env["CONCIERGE_AI_DISABLED"] = originalDisabled ?? "true";
  }
});

test("safe model output is allowlisted into the public response", async () => {
  const originalDisabled = process.env["CONCIERGE_AI_DISABLED"];
  delete process.env["CONCIERGE_AI_DISABLED"];

  try {
    const advice = await generateConciergeAdvice(
      { ...neutralSignals, comparisonIntent: true },
      async () => ({ recommendedInterest: "both" }),
    );

    assert.equal(advice.source, "ai");
    assert.equal(advice.recommendedInterest, "both");
    assert.equal(advice.handoffAllowed, true);
    assert.match(advice.message, /interest request/i);
  } finally {
    process.env["CONCIERGE_AI_DISABLED"] = originalDisabled ?? "true";
  }
});

test("fallback helper never creates checkout or activation behavior", () => {
  const advice = createFallbackAdvice({
    ...neutralSignals,
    awarenessIntent: true,
  });
  const serialized = JSON.stringify(advice);

  assert.doesNotMatch(serialized, /checkout|activationUrl|paymentUrl/i);
  assert.equal(advice.recommendedInterest, "display");
});