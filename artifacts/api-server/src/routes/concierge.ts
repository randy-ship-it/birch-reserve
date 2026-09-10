import { Router, type IRouter, type Request } from "express";
import {
  CreateConciergeAdviceBody,
  CreateConciergeAdviceResponse,
} from "@workspace/api-zod";

type AdInterest = "performance" | "display" | "both";
type Suggestion = AdInterest | "private_review";
type AdviceSource = "ai" | "fallback";

type ConciergeInput = {
  bookingIntent: boolean;
  awarenessIntent: boolean;
  comparisonIntent: boolean;
  privateReviewIntent: boolean;
  sensitiveContentDetected: boolean;
  selectedInterest?: AdInterest;
};

type ConciergeAdvice = {
  message: string;
  recommendedInterest?: AdInterest;
  suggestions: Suggestion[];
  handoffAllowed: boolean;
  source: AdviceSource;
};

type ModelAdvice = {
  recommendedInterest?: AdInterest;
};

type AdviceSignals = {
  bookingIntent: boolean;
  awarenessIntent: boolean;
  comparisonIntent: boolean;
  selectedInterest: AdInterest | null;
};

type AdviceProvider = (signals: AdviceSignals) => Promise<ModelAdvice>;

const router: IRouter = Router();
const VALID_INTERESTS = new Set<AdInterest>([
  "performance",
  "display",
  "both",
]);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const PROVIDER_TIMEOUT_MS = 8_000;
const CIRCUIT_FAILURE_LIMIT = 3;
const CIRCUIT_OPEN_MS = 60_000;

const requestBuckets = new Map<
  string,
  { count: number; windowStartedAt: number }
>();

let consecutiveProviderFailures = 0;
let circuitOpenUntil = 0;

const APPROVED_SYSTEM_PROMPT = `Choose one advertising-interest enum from anonymous boolean signals.
Return only JSON with "recommendedInterest" set to "performance", "display", or "both".
- bookingIntent without awarenessIntent suggests "performance".
- awarenessIntent without bookingIntent suggests "display".
- comparisonIntent, both bookingIntent and awarenessIntent, or no clear signal suggests "both".
The input contains no buyer text or personal information. Do not return prose or any other fields.`;

function uniqueSuggestions(
  recommendedInterest?: AdInterest,
): Suggestion[] {
  if (!recommendedInterest) {
    return ["performance", "display", "both"];
  }

  return [
    recommendedInterest,
    ...(["performance", "display", "both"] as AdInterest[]).filter(
      (value) => value !== recommendedInterest,
    ),
  ];
}

function createAdvice(
  message: string,
  recommendedInterest: AdInterest | undefined,
  source: AdviceSource,
  suggestions = uniqueSuggestions(recommendedInterest),
): ConciergeAdvice {
  return {
    message,
    ...(recommendedInterest ? { recommendedInterest } : {}),
    suggestions,
    handoffAllowed: Boolean(recommendedInterest),
    source,
  };
}

function createInterestAdvice(
  recommendedInterest: AdInterest,
  source: AdviceSource,
): ConciergeAdvice {
  if (recommendedInterest === "performance") {
    return createAdvice(
      "Performance is a useful starting point when the brief centers on bookings and the clinic is set up to receive them. Fit and availability are still reviewed privately.",
      "performance",
      source,
    );
  }

  if (recommendedInterest === "display") {
    return createAdvice(
      "Display is a useful starting point when the brief centers on building attention across Clinic Hubs and participating brand environments. Placement fit and availability are reviewed privately.",
      "display",
      source,
    );
  }

  return createAdvice(
    "Both is a useful starting point when you want to compare Performance and Display contexts in one learning brief before deciding where to focus. It remains an interest request, not a campaign order or inventory reservation.",
    "both",
    source,
  );
}

function classifyInterest(input: ConciergeInput): AdInterest {
  if (
    input.comparisonIntent ||
    (input.bookingIntent && input.awarenessIntent)
  ) {
    return "both";
  }

  if (input.awarenessIntent) {
    return "display";
  }

  if (input.bookingIntent) {
    return "performance";
  }

  return input.selectedInterest ?? "both";
}

export function createFallbackAdvice(
  input: ConciergeInput,
): ConciergeAdvice {
  if (input.sensitiveContentDetected) {
    return createAdvice(
      "Please keep contact, patient, member, health, payment, and credential details out of this chat. I can still help compare Performance, Display, or Both using general campaign goals.",
      undefined,
      "fallback",
    );
  }

  if (input.privateReviewIntent) {
    return createAdvice(
      "Pricing, availability, forecasts, contracts, compliance, and expected results are reviewed privately by a Birch Reserve planner. I can help you choose a format now, then your request can be assessed without creating a campaign or commercial commitment.",
      input.selectedInterest,
      "fallback",
      input.selectedInterest
        ? [input.selectedInterest, "private_review"]
        : ["performance", "display", "both"],
    );
  }

  return createInterestAdvice(classifyInterest(input), "fallback");
}

function isModelAdviceSafe(advice: ModelAdvice): boolean {
  return Boolean(
    advice.recommendedInterest &&
      VALID_INTERESTS.has(advice.recommendedInterest),
  );
}

function extractAdviceSignals(input: ConciergeInput): AdviceSignals {
  return {
    bookingIntent: input.bookingIntent,
    awarenessIntent: input.awarenessIntent,
    comparisonIntent: input.comparisonIntent,
    selectedInterest: input.selectedInterest ?? null,
  };
}

async function requestModelAdvice(
  signals: AdviceSignals,
): Promise<ModelAdvice> {
  const { openai } = await import(
    "@workspace/integrations-openai-ai-server"
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-5.4-mini",
        max_completion_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: APPROVED_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(signals),
          },
        ],
      },
      { signal: controller.signal },
    );

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("Concierge model returned no content.");
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const recommendedInterest = parsed["recommendedInterest"];

    return {
      ...(typeof recommendedInterest === "string" &&
      VALID_INTERESTS.has(recommendedInterest as AdInterest)
        ? { recommendedInterest: recommendedInterest as AdInterest }
        : {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateConciergeAdvice(
  input: ConciergeInput,
  provider: AdviceProvider = requestModelAdvice,
): Promise<ConciergeAdvice> {
  const fallback = createFallbackAdvice(input);

  if (
    input.sensitiveContentDetected ||
    input.privateReviewIntent ||
    process.env["CONCIERGE_AI_DISABLED"] === "true" ||
    Date.now() < circuitOpenUntil
  ) {
    return fallback;
  }

  try {
    const modelAdvice = await provider(extractAdviceSignals(input));
    if (!isModelAdviceSafe(modelAdvice)) {
      throw new Error("Concierge model response failed safety validation.");
    }

    consecutiveProviderFailures = 0;
    circuitOpenUntil = 0;
    return createInterestAdvice(modelAdvice.recommendedInterest!, "ai");
  } catch {
    consecutiveProviderFailures += 1;
    if (consecutiveProviderFailures >= CIRCUIT_FAILURE_LIMIT) {
      circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    }
    return fallback;
  }
}

function requestIsAllowed(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    const requestHost = req.get("host");
    return (
      originHost === requestHost ||
      originHost === "birchreserve.net" ||
      originHost === "www.birchreserve.net" ||
      originHost.endsWith(".replit.dev")
    );
  } catch {
    return false;
  }
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = requestBuckets.get(key);

  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

router.post(
  "/launch/concierge/advice",
  async (req, res): Promise<void> => {
    if (!requestIsAllowed(req)) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }

    const parsed = CreateConciergeAdviceBody.safeParse(req.body);
    const bodyKeys =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? Object.keys(req.body)
        : [];
    const hasUnknownFields = bodyKeys.some(
      (key) =>
        key !== "bookingIntent" &&
        key !== "awarenessIntent" &&
        key !== "comparisonIntent" &&
        key !== "privateReviewIntent" &&
        key !== "sensitiveContentDetected" &&
        key !== "selectedInterest",
    );

    if (!parsed.success || hasUnknownFields) {
      res.status(400).json({ error: "Invalid concierge question." });
      return;
    }

    const input: ConciergeInput = {
      bookingIntent: parsed.data.bookingIntent,
      awarenessIntent: parsed.data.awarenessIntent,
      comparisonIntent: parsed.data.comparisonIntent,
      privateReviewIntent: parsed.data.privateReviewIntent,
      sensitiveContentDetected: parsed.data.sensitiveContentDetected,
      ...(parsed.data.selectedInterest
        ? { selectedInterest: parsed.data.selectedInterest }
        : {}),
    };

    const rateLimited = isRateLimited(req.ip || "unknown");
    const advice = rateLimited
      ? createFallbackAdvice(input)
      : await generateConciergeAdvice(input);

    req.log.info(
      {
        source: advice.source,
        recommendedInterest: advice.recommendedInterest ?? null,
        rateLimited,
      },
      "Concierge guidance returned",
    );

    res.status(200).json(CreateConciergeAdviceResponse.parse(advice));
  },
);

export default router;