import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { Worker } from "node:worker_threads";
import { CancelBirchReserveUcpCheckoutResponse } from "@workspace/api-zod";
import {
  db,
  pool,
  splashAdReservationsTable,
  ucpAgentCheckoutIdempotencyTable,
  ucpAgentIdentityEnrollmentsTable,
  ucpAgentIdentityRotationsTable,
  ucpAgentRequestProofsTable,
  ucpProfileAdmissionBudgetsTable,
  ucpCheckoutIdempotencyAliasesTable,
} from "@workspace/db";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { and, eq, inArray, lt } from "drizzle-orm";
import app from "../src/app";
import {
  buildUcpBusinessProfile,
  buildUcpCheckoutView,
} from "../src/routes/publicBuying";
import {
  cleanupSplashReservations,
  markSplashReservationPaidFromSession,
} from "../src/lib/splashReservationLifecycle";
import { getPayableReserveOffer, getPublicReserveOfferBySku } from "../src/lib/reserveOffers";
import { setStripeCheckoutFunctionsForTests } from "../src/lib/stripeClient";
import {
  admitUcpProfileResolution,
  authenticateUcpAgentRequest,
  negotiateUcpAgent,
  setUcpNetworkFunctionsForTests,
  setUcpPreAuthLimitForTests,
  setUcpProfileResolverForTests,
  setUcpSharedAdmissionForTests,
} from "../src/lib/ucpNegotiation";
import {
  recordUcpProxyForwardingShape,
  setUcpProxyForwardingAlertForTests,
} from "../src/lib/logger";
import {
  UCP_CHECKOUT_SCHEMA_URL,
  UCP_CHECKOUT_SPEC_URL,
  UCP_OVERVIEW_SPEC_URL,
  UCP_SHOPPING_REST_SCHEMA_URL,
  UCP_VERSION,
} from "../src/lib/ucpProtocol";
import {
  claimUcpAgentRequestProof,
  cleanupExpiredUcpAgentRequestProofs,
  hasUcpAgentRequestProofBacklogWarning,
  measureUcpAgentRequestProofBacklog,
  UCP_PROOF_CLEANUP_BATCH_SIZE,
} from "../src/lib/ucpRequestProofs";
import {
  setReservationPipelineAppenderForTests,
  setReservationPipelineUpdaterForTests,
} from "../src/routes/splashAdReservations";

let origin = "";
let closeServer: (() => Promise<void>) | undefined;
const createdIds: string[] = [];
const agentProfileUrl = "https://agent.example/.well-known/ucp";
const otherAgentProfileUrl = "https://other-agent.example/.well-known/ucp";
const agentKeys = generateKeyPairSync("ed25519");
const otherAgentKeys = generateKeyPairSync("ed25519");
const successorAgentKeys = generateKeyPairSync("ed25519");
const secondSuccessorAgentKeys = generateKeyPairSync("ed25519");
const UCP_CONFORMANCE_VERSION = "2026-04-08";
const UCP_SCHEMA_ROOT = resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "ucp",
  UCP_CONFORMANCE_VERSION,
);

async function runUcpAdmissionWorker(input: {
  clientKey: string;
  worker: number;
  count: number;
}): Promise<boolean[]> {
  return new Promise((resolveWorker, rejectWorker) => {
    const worker = new Worker("/tmp/ucp-admission-worker.mjs", {
      workerData: input,
    });
    let result:
      | { admissions?: boolean[]; error?: string }
      | undefined;
    worker.once("message", (message) => {
      result = message as typeof result;
    });
    worker.once("error", rejectWorker);
    worker.once("exit", (code) => {
      if (code !== 0) {
        rejectWorker(new Error(`UCP admission worker exited with code ${code}.`));
        return;
      }
      if (result?.error) {
        rejectWorker(new Error(result.error));
        return;
      }
      if (!result?.admissions) {
        rejectWorker(new Error("UCP admission worker returned no result."));
        return;
      }
      resolveWorker(result.admissions);
    });
  });
}

type UcpConformanceFixture = {
  version: string;
  urls: Record<string, string>;
  negotiationErrors: Array<{
    name: string;
    header?: string;
    profileMode?:
      | "unsupported_version"
      | "missing_capability"
      | "wrong_schema";
    expectedStatus: number;
    expectedCode: string;
  }>;
  requiredHeaders: Array<{
    name: string;
    omit: string;
    expectedStatus: number;
    expectedCode: string;
  }>;
};

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

let ucpAjvPromise: Promise<Ajv2020> | undefined;

function getUcpAjv(): Promise<Ajv2020> {
  ucpAjvPromise ??= (async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schemaFiles = (await readdir(UCP_SCHEMA_ROOT, {
      recursive: true,
    })).filter((path) => path.endsWith(".json"));
    for (const schemaFile of schemaFiles) {
      ajv.addSchema(await readJson(resolve(UCP_SCHEMA_ROOT, schemaFile)));
    }
    return ajv;
  })();
  return ucpAjvPromise;
}

function assertConforms(
  validate: ValidateFunction,
  value: unknown,
  label: string,
): void {
  assert.equal(
    validate(value),
    true,
    `${label} failed pinned UCP conformance:\n${JSON.stringify(
      validate.errors,
      null,
      2,
    )}`,
  );
}

function fixtureUrl(path: string): string {
  return `https://ucp.dev/${UCP_CONFORMANCE_VERSION}/schemas/${path}`;
}

function assertOnlyPinnedDates(
  source: string,
  label: string,
  minimumOccurrences = 1,
): void {
  const dates = source.match(/20\d{2}-\d{2}-\d{2}/g) ?? [];
  assert.ok(
    dates.length >= minimumOccurrences,
    `${label} does not expose every expected UCP version pin.`,
  );
  assert.deepEqual(
    [...new Set(dates)],
    [UCP_CONFORMANCE_VERSION],
    `${label} contains a mixed or stale UCP version.`,
  );
}

function ucpProfile(
  publicKey: KeyObject = agentKeys.publicKey,
  input?: { keyId?: string; keySuccession?: unknown[] },
) {
  return {
    ucp: {
      version: UCP_VERSION,
      capabilities: {
        "dev.ucp.shopping.checkout": [
          {
            version: UCP_VERSION,
            spec: UCP_CHECKOUT_SPEC_URL,
            schema: UCP_CHECKOUT_SCHEMA_URL,
          },
        ],
      },
      authentication: {
        type: "ed25519" as const,
        key_id: input?.keyId ?? "checkout-agent-key",
        public_key_jwk: publicKey.export({ format: "jwk" }),
        ...(input?.keySuccession
          ? { key_succession: input.keySuccession }
          : {}),
      },
    },
  };
}

function signedUcpHeaders(input: {
  method: string;
  target: string;
  body?: string;
  idempotencyKey?: string;
  profileUrl?: string;
  privateKey?: KeyObject;
  keyId?: string;
  timestamp?: string;
  nonce?: string;
}) {
  const profileUrl = input.profileUrl ?? agentProfileUrl;
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = input.nonce ?? randomUUID();
  const canonical = [
    input.method.toUpperCase(),
    input.target,
    profileUrl,
    input.keyId ?? "checkout-agent-key",
    timestamp,
    nonce,
    input.idempotencyKey ?? "",
    createHash("sha256")
      .update(input.body ? Buffer.from(input.body) : Buffer.alloc(0))
      .digest("base64url"),
  ].join("\n");
  return {
    "request-id": randomUUID(),
    "ucp-agent": `profile="${profileUrl}"`,
    "ucp-agent-timestamp": timestamp,
    "ucp-agent-nonce": nonce,
    "ucp-agent-signature": sign(
      null,
      Buffer.from(canonical),
      input.privateKey ?? agentKeys.privateKey,
    ).toString("base64url"),
  };
}

function signedUcpRequest(input: {
  target: string;
  method?: string;
  body?: string;
  headers?: HeadersInit;
  profileUrl?: string;
  privateKey?: KeyObject;
  keyId?: string;
}): Promise<Response> {
  const method = input.method ?? "GET";
  const headers = new Headers(input.headers);
  const idempotencyKey = headers.get("idempotency-key") ?? undefined;
  for (const [name, value] of Object.entries(
    signedUcpHeaders({
      method,
      target: input.target,
      body: input.body,
      idempotencyKey,
      profileUrl: input.profileUrl,
      privateKey: input.privateKey,
      keyId: input.keyId,
    }),
  )) {
    headers.set(name, value);
  }
  return fetch(`${origin}${input.target}`, {
    method,
    headers,
    body: input.body,
  });
}

function keySuccession(input?: {
  profileUrl?: string;
  predecessorKeys?: typeof agentKeys;
  successorKeys?: typeof successorAgentKeys;
  predecessorKeyId?: string;
  successorKeyId?: string;
  notBefore?: string;
  expiresAt?: string;
  signingKey?: KeyObject;
}) {
  const predecessorKeys = input?.predecessorKeys ?? agentKeys;
  const successorKeys = input?.successorKeys ?? successorAgentKeys;
  const profileUrl = input?.profileUrl ?? agentProfileUrl;
  const predecessorKeyId = input?.predecessorKeyId ?? "checkout-agent-key";
  const successorKeyId = input?.successorKeyId ?? "checkout-agent-key-v2";
  const notBefore =
    input?.notBefore ?? new Date(Date.now() - 60_000).toISOString();
  const expiresAt =
    input?.expiresAt ?? new Date(Date.now() + 60 * 60_000).toISOString();
  const predecessorIdentityHash = agentIdentityHash(predecessorKeys.publicKey);
  const successorIdentityHash = agentIdentityHash(successorKeys.publicKey);
  const canonical = [
    "birch-reserve-ucp-key-succession-v1",
    profileUrl,
    predecessorKeyId,
    predecessorIdentityHash,
    successorKeyId,
    successorIdentityHash,
    notBefore,
    expiresAt,
  ].join("\n");
  return {
    predecessor_key_id: predecessorKeyId,
    predecessor_public_key_jwk: predecessorKeys.publicKey.export({
      format: "jwk",
    }),
    successor_key_id: successorKeyId,
    successor_public_key_jwk: successorKeys.publicKey.export({
      format: "jwk",
    }),
    not_before: notBefore,
    expires_at: expiresAt,
    signature: sign(
      null,
      Buffer.from(canonical),
      input?.signingKey ?? predecessorKeys.privateKey,
    ).toString("base64url"),
  };
}

function resolveTestUcpProfile(profileUrl: string) {
  return Promise.resolve(
    ucpProfile(
      profileUrl === otherAgentProfileUrl
        ? otherAgentKeys.publicKey
        : agentKeys.publicKey,
    ),
  );
}

function agentIdentityHash(publicKey: KeyObject = agentKeys.publicKey) {
  const jwk = publicKey.export({ format: "jwk" });
  return createHash("sha256")
    .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
    .digest("hex");
}

async function waitFor<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
): Promise<T> {
  const deadline = Date.now() + 2_000;
  let value = await read();
  while (!predicate(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    value = await read();
  }
  return value;
}

function continuityAuthorization(input: {
  checkoutId: string;
  previousProfileUrl: string;
  replacementProfileUrl: string;
  privateKey: KeyObject;
  authorizationId?: string;
}): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", typ: "ucp-identity-continuity+jwt" }),
  ).toString("base64url");
  const issuedAt = Math.floor(Date.now() / 1_000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: input.previousProfileUrl,
      sub: input.replacementProfileUrl,
      aud: `urn:birch-reserve:ucp-checkout:${input.checkoutId}`,
      iat: issuedAt,
      exp: issuedAt + 5 * 60,
      jti: input.authorizationId ?? randomUUID(),
    }),
  ).toString("base64url");
  const signature = sign(
    null,
    Buffer.from(`${header}.${payload}`),
    input.privateKey,
  ).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

before(async () => {
  process.env.STRIPE_CHECKOUT_DISABLED = "true";
  process.env.SPLASH_RESERVE_ALERTS_DISABLED = "true";
  process.env.SPLASH_PIPELINE_SYNC_DISABLED = "true";
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  origin = `http://127.0.0.1:${address.port}`;
  closeServer = () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});

after(async () => {
  for (const id of createdIds) {
    await db
      .delete(ucpCheckoutIdempotencyAliasesTable)
      .where(eq(ucpCheckoutIdempotencyAliasesTable.reservationId, id));
    await db
      .delete(ucpAgentIdentityRotationsTable)
      .where(eq(ucpAgentIdentityRotationsTable.reservationId, id));
    await db
      .delete(ucpAgentIdentityEnrollmentsTable)
      .where(eq(ucpAgentIdentityEnrollmentsTable.reservationId, id));
    await db.delete(splashAdReservationsTable).where(eq(splashAdReservationsTable.id, id));
  }
  await closeServer?.();
  await pool.end();
});

test("pinned UCP schemas, discovery URLs, OpenAPI, and generated clients move together", async () => {
  const fixture = (await readJson(
    resolve(process.cwd(), "tests", "fixtures", "ucp", "conformance.json"),
  )) as UcpConformanceFixture;
  const [
    officialUcpSchema,
    officialCheckoutSchema,
    openapi,
    orvalConfig,
    generatedClient,
    generatedZod,
  ] = await Promise.all([
    readJson(resolve(UCP_SCHEMA_ROOT, "ucp.json")),
    readJson(resolve(UCP_SCHEMA_ROOT, "shopping", "checkout.json")),
    readFile(resolve(process.cwd(), "../../lib/api-spec/openapi.yaml"), "utf8"),
    readFile(resolve(process.cwd(), "../../lib/api-spec/orval.config.ts"), "utf8"),
    readFile(
      resolve(
        process.cwd(),
        "../../lib/api-client-react/src/generated/api.schemas.ts",
      ),
      "utf8",
    ),
    readFile(
      resolve(process.cwd(), "../../lib/api-zod/src/generated/api.ts"),
      "utf8",
    ),
  ]);

  assert.equal(UCP_VERSION, UCP_CONFORMANCE_VERSION);
  assert.equal(fixture.version, UCP_CONFORMANCE_VERSION);
  assert.equal(fixture.urls.overviewSpec, UCP_OVERVIEW_SPEC_URL);
  assert.equal(fixture.urls.checkoutSpec, UCP_CHECKOUT_SPEC_URL);
  assert.equal(fixture.urls.shoppingRestSchema, UCP_SHOPPING_REST_SCHEMA_URL);
  assert.equal(fixture.urls.checkoutSchema, UCP_CHECKOUT_SCHEMA_URL);
  assert.equal(officialUcpSchema.$id, fixture.urls.ucpSchema);
  assert.equal(officialCheckoutSchema.$id, fixture.urls.checkoutSchema);
  assert.equal(officialCheckoutSchema.version, UCP_CONFORMANCE_VERSION);
  assertOnlyPinnedDates(openapi, "OpenAPI UCP models", 4);
  assertOnlyPinnedDates(orvalConfig, "Orval UCP codegen guard");
  assertOnlyPinnedDates(generatedClient, "generated TypeScript UCP models", 6);
  assertOnlyPinnedDates(generatedZod, "generated Zod UCP models", 3);

  const schemaFiles = (await readdir(UCP_SCHEMA_ROOT, {
    recursive: true,
  })).filter((path) => path.endsWith(".json"));
  for (const schemaFile of schemaFiles) {
    const schemaText = await readFile(
      resolve(UCP_SCHEMA_ROOT, schemaFile),
      "utf8",
    );
    const schema = JSON.parse(schemaText) as { $id?: string };
    assert.equal(
      schema.$id,
      fixtureUrl(schemaFile),
      `${schemaFile} is not from the pinned official schema namespace.`,
    );
    const referencedVersions = [
      ...schemaText.matchAll(/https:\/\/ucp\.dev\/(20\d{2}-\d{2}-\d{2})\//g),
    ].map((match) => match[1]);
    assert.deepEqual(
      [...new Set(referencedVersions)],
      [UCP_CONFORMANCE_VERSION],
      `${schemaFile} references a mixed or stale UCP schema release.`,
    );
  }
});

test("UCP negotiation and required-header fixtures return conforming errors", async () => {
  const fixture = (await readJson(
    resolve(process.cwd(), "tests", "fixtures", "ucp", "conformance.json"),
  )) as UcpConformanceFixture;
  const ajv = await getUcpAjv();
  const validateError = ajv.getSchema(
    fixtureUrl("shopping/types/error_response.json"),
  );
  assert.ok(validateError);

  for (const errorFixture of fixture.negotiationErrors) {
    if (errorFixture.profileMode) {
      const profile = ucpProfile() as any;
      if (errorFixture.profileMode === "unsupported_version") {
        profile.ucp.version = "2026-01-11";
      } else if (errorFixture.profileMode === "missing_capability") {
        profile.ucp.capabilities = {};
      } else {
        profile.ucp.capabilities["dev.ucp.shopping.checkout"][0].schema =
          fixtureUrl("shopping/other.json");
      }
      setUcpProfileResolverForTests(async () => profile);
    } else {
      setUcpProfileResolverForTests();
    }
    const result = await negotiateUcpAgent(errorFixture.header);
    assert.equal(result.ok, false, errorFixture.name);
    if (!result.ok) {
      assert.equal(result.status, errorFixture.expectedStatus, errorFixture.name);
      assert.equal(result.code, errorFixture.expectedCode, errorFixture.name);
    }
  }

  setUcpProfileResolverForTests(resolveTestUcpProfile);
  try {
    const body = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    });
    for (const headerFixture of fixture.requiredHeaders) {
      const idempotencyKey = randomUUID();
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        ...signedUcpHeaders({
          method: "POST",
          target: "/ucp/v1/checkout-sessions",
          body,
          idempotencyKey,
        }),
      };
      delete headers[headerFixture.omit];
      const response = await fetch(`${origin}/ucp/v1/checkout-sessions`, {
        method: "POST",
        headers,
        body,
      });
      assert.equal(
        response.status,
        headerFixture.expectedStatus,
        headerFixture.name,
      );
      const error = (await response.json()) as Record<string, unknown>;
      assert.equal(
        (error.messages as Array<Record<string, unknown>>)[0]?.code,
        headerFixture.expectedCode,
        headerFixture.name,
      );
      assertConforms(validateError, error, headerFixture.name);
    }
  } finally {
    setUcpProfileResolverForTests();
  }
});

test("business discovery and checkout builders conform to official pinned schemas", async () => {
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  try {
    const ajv = await getUcpAjv();
    const validateBusinessProfile = ajv.getSchema(
      `${fixtureUrl("ucp.json")}#/$defs/business_schema`,
    );
    const validateCheckout = ajv.getSchema(UCP_CHECKOUT_SCHEMA_URL);
    assert.ok(validateBusinessProfile);
    assert.ok(validateCheckout);

    const profile = buildUcpBusinessProfile("https://reserve.example.com");
    assertConforms(
      validateBusinessProfile,
      profile.ucp,
      "Birch Reserve business discovery",
    );

    const now = new Date("2026-09-09T12:00:00.000Z");
    const checkout = buildUcpCheckoutView({
      id: "00000000-0000-4000-8000-000000000035",
      source: "birch_reserve_v1_checkout",
      offerKey: "pilot-4900",
      amountCents: 490000,
      currency: "usd",
      paymentStatus: "checkout_created",
      status: "payment_pending",
      stripeCheckoutUrl: "https://checkout.stripe.test/ucp-handoff",
      inventoryHeldAt: now,
      createdAt: now,
    } as unknown as typeof splashAdReservationsTable.$inferSelect);
    assert.ok(checkout);
    assertConforms(validateCheckout, checkout, "hosted-handoff checkout response");
    assert.equal(checkout.status, "requires_escalation");
    assert.equal(checkout.messages?.[0]?.type, "error");
    assert.equal(checkout.messages?.[0]?.severity, "requires_buyer_input");
    assert.equal(typeof checkout.continue_url, "string");
  } finally {
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
  }
});

test("reserve-899 stays payable for existing Stripe sessions and is not a new public SKU", () => {
  assert.equal(getPublicReserveOfferBySku("reserve-899"), null);
  assert.equal(getPublicReserveOfferBySku("hold-190")?.amountCents, 19000);
  assert.equal(getPublicReserveOfferBySku("reserve-490")?.amountCents, 49000);
  assert.equal(getPayableReserveOffer("reserve-899", 89900, "usd")?.sku, "reserve-899");
  assert.equal(getPayableReserveOffer("reserve-899", 89900, "usd")?.published, false);
  assert.equal(getPayableReserveOffer("pilot-4900", 490000, "usd")?.published, false);
});

test("machine surfaces expose text, JSON, YAML, and fixed USD contracts", async () => {
  const llms = await fetch(`${origin}/llms.txt`);
  assert.match(llms.headers.get("content-type") ?? "", /^text\/plain/);
  const llmsText = await llms.text();
  assert.match(llmsText, /hold-190/);
  assert.match(llmsText, /reserve-490/);
  assert.match(llmsText, /\$190 USD/);
  assert.match(llmsText, /\$490 USD/);
  assert.doesNotMatch(llmsText, /899/);
  assert.doesNotMatch(llmsText, /Book a call/);
  assert.doesNotMatch(llmsText, /\$4,900/);
  assert.doesNotMatch(llmsText, /\$9,900/);
  assert.doesNotMatch(llmsText, /reserve-990/);

  const catalogResponse = await fetch(`${origin}/v1/catalog.json`);
  assert.match(catalogResponse.headers.get("content-type") ?? "", /^application\/json/);
  const catalog = (await catalogResponse.json()) as Record<string, unknown>;
  assert.deepEqual(
    (catalog.offers as Array<Record<string, unknown>>).map((offer) => [
      offer.offer_key,
      offer.sku,
      offer.amount_cents,
    ]),
    [
      ["hold-190", "hold-190", 19000],
      ["reserve-490", "reserve-490", 49000],
    ],
  );
  assert.equal(catalog.default_sku, "reserve-490");
  assert.equal(
    (catalog.legacy_offers as Array<Record<string, unknown>>)[0]?.sku,
    "reserve-899",
  );
  assert.equal(
    (catalog.legacy_offers as Array<Record<string, unknown>>)[0]?.published,
    false,
  );
  assert.equal(
    (catalog.legacy_offers as Array<Record<string, unknown>>)[0]?.amount_cents,
    89900,
  );
  assert.equal(catalog.currency, "USD");
  assert.deepEqual(catalog.formats, [
    "post_checkout",
    "recovery_plan",
    "scheduled_service",
    "member_hub",
    "motion_15s",
  ]);

  const quoteResponse = await fetch(
    `${origin}/v1/quote?sku=reserve-490&format=post_checkout&days=30`,
  );
  const quote = (await quoteResponse.json()) as Record<string, unknown>;
  assert.equal(quote.sku, "reserve-490");
  assert.equal(quote.offerKey, "reserve-490");
  assert.equal(quote.amountCents, 49000);
  assert.equal(quote.currency, "USD");
  assert.equal(quote.dueTodayUsd, 490);

  const openapi = await fetch(`${origin}/openapi.yaml`);
  assert.match(openapi.headers.get("content-type") ?? "", /yaml/);
  assert.match(await openapi.text(), /\/v1\/checkout:/);
});

test("UCP request proofs fail uniformly before checkout lookup or creation", async () => {
  setUcpProfileResolverForTests(resolveTestUcpProfile);
  const body = JSON.stringify({
    line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
  });
  const idempotencyKey = randomUUID();
  const expected = {
    ucp: { version: "2026-04-08", status: "error" },
    messages: [
      {
        type: "error",
        code: "not_found",
        content: "Checkout session not found.",
        severity: "unrecoverable",
      },
    ],
  };
  try {
    const spoofedCreate = await fetch(
      `${origin}/ucp/v1/checkout-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          ...signedUcpHeaders({
            method: "POST",
            target: "/ucp/v1/checkout-sessions",
            body,
            idempotencyKey,
            privateKey: otherAgentKeys.privateKey,
          }),
        },
        body,
      },
    );
    const missingRead = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${randomUUID()}`,
      {
        headers: {
          "ucp-agent": `profile="${agentProfileUrl}"`,
        },
      },
    );
    const staleCancelTarget = `/ucp/v1/checkout-sessions/${randomUUID()}/cancel`;
    const staleCancel = await fetch(`${origin}${staleCancelTarget}`, {
      method: "POST",
      headers: {
        ...signedUcpHeaders({
          method: "POST",
          target: staleCancelTarget,
          timestamp: String(Math.floor(Date.now() / 1000) - 301),
        }),
      },
    });
    for (const response of [spoofedCreate, missingRead, staleCancel]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), expected);
    }
  } finally {
    setUcpProfileResolverForTests();
  }
});

test("future-dated UCP proofs retain their nonce through the full validity window", () => {
  const now = Date.now();
  const timestamp = String(Math.floor((now + 299_000) / 1000));
  const nonce = randomUUID();
  const target = `/ucp/v1/checkout-sessions/${randomUUID()}`;
  const headers = signedUcpHeaders({
    method: "GET",
    target,
    timestamp,
    nonce,
  });
  const authentication = authenticateUcpAgentRequest({
    method: "GET",
    target,
    profileUrl: agentProfileUrl,
    keyId: "checkout-agent-key",
    publicKeyJwk: ucpProfile().ucp.authentication.public_key_jwk as never,
    timestampHeader: timestamp,
    signatureHeader: headers["ucp-agent-signature"],
    nonceHeader: nonce,
    idempotencyKey: undefined,
    body: undefined,
    now,
  });
  assert.equal(authentication.ok, true);
  if (!authentication.ok) return;
  assert.equal(
    authentication.validUntil.getTime(),
    Number(timestamp) * 1000 + 5 * 60_000,
  );
  assert.ok(authentication.validUntil.getTime() > now + 9 * 60_000);
});

test("UCP replay claims stay atomic while cleanup removes only a bounded batch", async () => {
  const identity = `load-test-${randomUUID()}`;
  const replayNonce = createHash("sha256").update(randomUUID()).digest("hex");
  const expiredAt = new Date(1);
  const validUntil = new Date(Date.now() + 10 * 60_000);
  const expiredRows = Array.from(
    { length: UCP_PROOF_CLEANUP_BATCH_SIZE + 25 },
    (_, index) => ({
      agentIdentityHash: identity,
      nonceHash: `expired-${index}-${randomUUID()}`,
      expiresAt: expiredAt,
    }),
  );
  await db.insert(ucpAgentRequestProofsTable).values(expiredRows);
  try {
    const [cleanupCount, ...claims] = await Promise.all([
      cleanupExpiredUcpAgentRequestProofs(),
      ...Array.from({ length: 40 }, () =>
        claimUcpAgentRequestProof({
          agentIdentityHash: identity,
          nonceHash: replayNonce,
          expiresAt: validUntil,
        }),
      ),
    ]);
    assert.equal(cleanupCount, UCP_PROOF_CLEANUP_BATCH_SIZE);
    assert.equal(claims.filter(Boolean).length, 1);

    const [liveReplayProof] = await db
      .select()
      .from(ucpAgentRequestProofsTable)
      .where(
        and(
          eq(ucpAgentRequestProofsTable.agentIdentityHash, identity),
          eq(ucpAgentRequestProofsTable.nonceHash, replayNonce),
        ),
      );
    assert.ok(liveReplayProof);

    const remainingExpired = await db
      .select()
      .from(ucpAgentRequestProofsTable)
      .where(
        and(
          eq(ucpAgentRequestProofsTable.agentIdentityHash, identity),
          lt(ucpAgentRequestProofsTable.expiresAt, new Date()),
        ),
      );
    assert.equal(remainingExpired.length, 25);
  } finally {
    await db
      .delete(ucpAgentRequestProofsTable)
      .where(eq(ucpAgentRequestProofsTable.agentIdentityHash, identity));
  }
});

test("UCP pre-auth admission limits unique profiles across isolated workers and refills quickly", async () => {
  setUcpPreAuthLimitForTests(true);
  const clientKey = `flood-client-${randomUUID()}`;
  const otherClientKey = `legitimate-client-${randomUUID()}`;
  try {
    const [workerOneAdmissions, workerTwoAdmissions] = await Promise.all([
      runUcpAdmissionWorker({ clientKey, worker: 1, count: 10 }),
      runUcpAdmissionWorker({ clientKey, worker: 2, count: 10 }),
    ]);
    assert.deepEqual(workerOneAdmissions, Array(10).fill(true));
    assert.deepEqual(workerTwoAdmissions, Array(10).fill(true));
    assert.equal(
      await admitUcpProfileResolution(
        'profile="https://overflow.example/.well-known/ucp"',
        clientKey,
        1_000,
      ),
      false,
    );
    assert.equal(
      await admitUcpProfileResolution(
        'profile="https://legitimate.example/.well-known/ucp"',
        otherClientKey,
        1_000,
      ),
      true,
    );
    await db
      .update(ucpProfileAdmissionBudgetsTable)
      .set({ updatedAt: new Date(Date.now() - 1_000) })
      .where(eq(ucpProfileAdmissionBudgetsTable.clientKey, clientKey));
    assert.equal(
      await admitUcpProfileResolution(
        'profile="https://recovered.example/.well-known/ucp"',
        clientKey,
        2_000,
      ),
      true,
    );
  } finally {
    await db
      .delete(ucpProfileAdmissionBudgetsTable)
      .where(
        inArray(ucpProfileAdmissionBudgetsTable.clientKey, [
          clientKey,
          otherClientKey,
        ]),
      );
    setUcpPreAuthLimitForTests();
  }
});

test("cached UCP profile retries bypass the shared pre-auth budget", async () => {
  const header = 'profile="https://cached-agent.example/.well-known/ucp"';
  let sharedAdmissions = 0;
  setUcpNetworkFunctionsForTests({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async () => ({
      status: 200,
      payload: {
        ucp: {
          ...ucpProfile().ucp,
          services: {},
          payment_handlers: {},
        },
      },
    }),
  });
  setUcpProfileResolverForTests();
  setUcpPreAuthLimitForTests(true);
  setUcpSharedAdmissionForTests(async () => {
    sharedAdmissions += 1;
    return true;
  });
  try {
    assert.equal((await negotiateUcpAgent(header)).ok, true);
    assert.equal(
      await admitUcpProfileResolution(header, "cached-profile-client"),
      true,
    );
    assert.equal(sharedAdmissions, 0);
    assert.equal(
      await admitUcpProfileResolution(
        'profile="https://uncached-agent.example/.well-known/ucp"',
        "cached-profile-client",
      ),
      true,
    );
    assert.equal(sharedAdmissions, 1);
  } finally {
    setUcpSharedAdmissionForTests();
    setUcpPreAuthLimitForTests();
    setUcpProfileResolverForTests();
    setUcpNetworkFunctionsForTests();
  }
});

test("negative and in-flight UCP profile retries bypass the shared pre-auth budget", async () => {
  const negativeHeader =
    'profile="https://negative-cached-agent.example/.well-known/ucp"';
  const pendingHeader =
    'profile="https://pending-agent.example/.well-known/ucp"';
  let releasePendingProfile: (() => void) | undefined;
  let sharedAdmissions = 0;
  setUcpNetworkFunctionsForTests({
    lookup: async (hostname) => {
      if (hostname === "negative-cached-agent.example") {
        throw new Error("NXDOMAIN");
      }
      return [{ address: "93.184.216.34", family: 4 }];
    },
    request: async () => {
      await new Promise<void>((resolve) => {
        releasePendingProfile = resolve;
      });
      return {
        status: 200,
        payload: {
          ucp: {
            ...ucpProfile().ucp,
            services: {},
            payment_handlers: {},
          },
        },
      };
    },
  });
  setUcpProfileResolverForTests();
  setUcpPreAuthLimitForTests(true);
  setUcpSharedAdmissionForTests(async () => {
    sharedAdmissions += 1;
    return true;
  });
  try {
    assert.equal((await negotiateUcpAgent(negativeHeader)).ok, false);
    assert.equal(
      await admitUcpProfileResolution(negativeHeader, "cache-client"),
      true,
    );
    const pendingNegotiation = negotiateUcpAgent(pendingHeader);
    while (!releasePendingProfile) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(
      await admitUcpProfileResolution(pendingHeader, "cache-client"),
      true,
    );
    assert.equal(sharedAdmissions, 0);
    releasePendingProfile();
    assert.equal((await pendingNegotiation).ok, true);
  } finally {
    releasePendingProfile?.();
    setUcpSharedAdmissionForTests();
    setUcpPreAuthLimitForTests();
    setUcpProfileResolverForTests();
    setUcpNetworkFunctionsForTests();
  }
});

test("UCP pre-auth admission falls back locally when the shared budget stalls", async () => {
  setUcpPreAuthLimitForTests(true);
  let sharedAttempts = 0;
  setUcpSharedAdmissionForTests(() => {
    sharedAttempts += 1;
    if (sharedAttempts === 1) {
      return new Promise<boolean>(() => undefined);
    }
    throw new Error("shared limiter unavailable");
  });
  try {
    for (let index = 0; index < 20; index += 1) {
      assert.equal(
        await admitUcpProfileResolution(
          `profile="https://fallback-${index}.example/.well-known/ucp"`,
          "fallback-client",
          1_000,
        ),
        true,
      );
    }
    assert.equal(
      await admitUcpProfileResolution(
        'profile="https://fallback-overflow.example/.well-known/ucp"',
        "fallback-client",
        1_000,
      ),
      false,
    );
  } finally {
    setUcpSharedAdmissionForTests();
    setUcpPreAuthLimitForTests();
  }
});

test("UCP routes reject a unique-profile flood before resolving every profile", async () => {
  let resolutions = 0;
  let sharedAdmissions = 0;
  setUcpProfileResolverForTests(async () => {
    resolutions += 1;
    return ucpProfile();
  });
  setUcpPreAuthLimitForTests(true);
  setUcpSharedAdmissionForTests(async () => {
    sharedAdmissions += 1;
    return sharedAdmissions <= 20;
  });
  try {
    for (let index = 0; index < 20; index += 1) {
      const target = `/ucp/v1/checkout-sessions/${randomUUID()}`;
      const profileUrl = `https://flood-${index}.example/.well-known/ucp`;
      const response = await fetch(`${origin}${target}`, {
        headers: {
          ...signedUcpHeaders({
            method: "GET",
            target,
            profileUrl,
          }),
        },
      });
      assert.equal(response.status, 404);
    }
    const limited = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${randomUUID()}`,
      {
        headers: {
          "ucp-agent":
            'profile="https://flood-overflow.example/.well-known/ucp"',
        },
      },
    );
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "1");
    assert.equal(
      ((await limited.json()) as Record<string, any>).messages[0].code,
      "rate_limited",
    );
    assert.equal(resolutions, 20);
  } finally {
    setUcpSharedAdmissionForTests();
    setUcpPreAuthLimitForTests();
    setUcpProfileResolverForTests();
  }
});

test("UCP admission trusts only Replit's proxy hop when choosing client buckets", async () => {
  const trustedProxyClientKeys = ["203.0.113.10", "203.0.113.11"];
  await db
    .delete(ucpProfileAdmissionBudgetsTable)
    .where(
      inArray(
        ucpProfileAdmissionBudgetsTable.clientKey,
        trustedProxyClientKeys,
      ),
    );
  let resolutions = 0;
  setUcpProfileResolverForTests(async () => {
    resolutions += 1;
    return ucpProfile();
  });
  setUcpPreAuthLimitForTests(true);
  try {
    const requestProfile = async (
      index: number,
      forwardedFor: string,
    ): Promise<Response> => {
      const target = `/ucp/v1/checkout-sessions/${randomUUID()}`;
      const profileUrl = `https://proxy-${index}.example/.well-known/ucp`;
      return fetch(`${origin}${target}`, {
        headers: {
          ...signedUcpHeaders({
            method: "GET",
            target,
            profileUrl,
          }),
          "x-forwarded-for": forwardedFor,
        },
      });
    };

    for (let index = 0; index < 20; index += 1) {
      const response = await requestProfile(
        index,
        `198.51.100.${index + 1}, 203.0.113.10`,
      );
      assert.equal(response.status, 404);
    }

    const forgedRotation = await requestProfile(
      20,
      "192.0.2.200, 203.0.113.10",
    );
    assert.equal(forgedRotation.status, 429);

    const distinctClient = await requestProfile(
      21,
      "192.0.2.200, 203.0.113.11",
    );
    assert.equal(distinctClient.status, 404);
    assert.equal(resolutions, 21);
  } finally {
    await db
      .delete(ucpProfileAdmissionBudgetsTable)
      .where(
        inArray(
          ucpProfileAdmissionBudgetsTable.clientKey,
          trustedProxyClientKeys,
        ),
      );
    setUcpPreAuthLimitForTests();
    setUcpProfileResolverForTests();
  }
});

test("UCP proof backlog measurement distinguishes live proofs from expired backlog", async () => {
  const identity = `backlog-test-${randomUUID()}`;
  const now = new Date();
  while ((await measureUcpAgentRequestProofBacklog(now)).expiredProofs > 0) {
    const deleted = await cleanupExpiredUcpAgentRequestProofs(now);
    assert.ok(deleted > 0);
  }
  await db.insert(ucpAgentRequestProofsTable).values([
    {
      agentIdentityHash: identity,
      nonceHash: `expired-${randomUUID()}`,
      expiresAt: new Date(now.getTime() - 1),
    },
    {
      agentIdentityHash: identity,
      nonceHash: `live-${randomUUID()}`,
      expiresAt: new Date(now.getTime() + 60_000),
    },
  ]);
  try {
    const before = await measureUcpAgentRequestProofBacklog(now);
    await cleanupExpiredUcpAgentRequestProofs(now);
    const after = await measureUcpAgentRequestProofBacklog(now);

    assert.equal(before.expiredProofs - after.expiredProofs, 1);
    assert.equal(before.liveProofs - after.liveProofs, 0);
  } finally {
    await db
      .delete(ucpAgentRequestProofsTable)
      .where(eq(ucpAgentRequestProofsTable.agentIdentityHash, identity));
  }
});

test("UCP proof backlog warning starts when one cleanup batch remains expired", () => {
  assert.equal(
    hasUcpAgentRequestProofBacklogWarning({
      liveProofs: 10_000,
      expiredProofs: UCP_PROOF_CLEANUP_BATCH_SIZE - 1,
    }),
    false,
  );
  assert.equal(
    hasUcpAgentRequestProofBacklogWarning({
      liveProofs: 0,
      expiredProofs: UCP_PROOF_CLEANUP_BATCH_SIZE,
    }),
    true,
  );
});

test("UCP proxy forwarding drift alerts only after repeated privacy-safe mismatches", async () => {
  const warnings: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  const alerts: string[] = [];
  const testLogger = {
    warn(fields: Record<string, unknown>) {
      warnings.push(fields);
    },
    error(fields: Record<string, unknown>) {
      errors.push(fields);
    },
  };
  setUcpProxyForwardingAlertForTests(async (text) => {
    alerts.push(text);
  });
  try {
    recordUcpProxyForwardingShape(testLogger as any, "203.0.113.10", 1_000);
    assert.equal(warnings.length, 0);
    assert.equal(alerts.length, 0);

    recordUcpProxyForwardingShape(
      testLogger as any,
      "198.51.100.1, 203.0.113.10",
      2_000,
    );
    recordUcpProxyForwardingShape(testLogger as any, undefined, 3_000);
    assert.equal(alerts.length, 0);
    recordUcpProxyForwardingShape(
      testLogger as any,
      "198.51.100.2, 203.0.113.10",
      4_000,
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(warnings.length, 3);
    assert.equal(alerts.length, 1);
    assert.equal(errors.length, 0);
    assert.equal(alerts[0]?.includes("198.51.100"), false);
    assert.equal(alerts[0]?.includes("203.0.113"), false);
    for (const warning of warnings) {
      assert.equal(JSON.stringify(warning).includes("198.51.100"), false);
      assert.equal(JSON.stringify(warning).includes("203.0.113"), false);
      assert.equal(warning.signal, "ucp_proxy_forwarding_shape_mismatch");
    }
  } finally {
    setUcpProxyForwardingAlertForTests();
  }
});

test("UCP discovery creates a hosted-checkout escalation without delegated payment", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  setUcpProfileResolverForTests(resolveTestUcpProfile);
  let stripeCreates = 0;
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      stripeCreates += 1;
      assert.equal(params.customer_email, undefined);
      return {
        id: `cs_test_ucp_${randomUUID().replaceAll("-", "")}`,
        url: "https://checkout.stripe.test/ucp-handoff",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: 49000,
        metadata: params.metadata,
      } as never;
    },
  });
  try {
    const profileResponse = await fetch(`${origin}/.well-known/ucp`);
    assert.equal(profileResponse.status, 200);
    const profile = (await profileResponse.json()) as Record<string, any>;
    assert.equal(
      profile.ucp.services["dev.ucp.shopping"][0].endpoint,
      "https://reserve.example.com/ucp/v1",
    );
    assert.deepEqual(profile.ucp.payment_handlers, {});

    const idempotencyKey = randomUUID();
    const checkoutBody = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    });
    const expectedAuthenticationFailure = {
      ucp: { version: "2026-04-08", status: "error" },
      messages: [
        {
          type: "error",
          code: "not_found",
          content: "Checkout session not found.",
          severity: "unrecoverable",
        },
      ],
    };
    const spoofedCreateResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          ...signedUcpHeaders({
            method: "POST",
            target: "/ucp/v1/checkout-sessions",
            body: checkoutBody,
            idempotencyKey,
            privateKey: otherAgentKeys.privateKey,
          }),
        },
        body: checkoutBody,
      },
    );
    assert.equal(spoofedCreateResponse.status, 404);
    assert.deepEqual(
      await spoofedCreateResponse.json(),
      expectedAuthenticationFailure,
    );
    assert.equal(stripeCreates, 0);

    const checkoutResponse = await fetch(`${origin}/ucp/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        ...signedUcpHeaders({
          method: "POST",
          target: "/ucp/v1/checkout-sessions",
          body: checkoutBody,
          idempotencyKey,
        }),
      },
      body: checkoutBody,
    });
    assert.equal(checkoutResponse.status, 201);
    const checkout = (await checkoutResponse.json()) as Record<string, any>;
    createdIds.push(String(checkout.id));
    assert.equal(checkout.status, "requires_escalation");
    assert.equal(checkout.currency, "USD");
    assert.equal(checkout.line_items[0].item.id, "reserve-490");
    assert.equal(checkout.line_items[0].item.price, 49000);
    assert.equal(checkout.continue_url, "https://checkout.stripe.test/ucp-handoff");
    assert.deepEqual(checkout.ucp.payment_handlers, {});
    assert.equal(
      checkout.messages[0].severity,
      "requires_buyer_input",
    );
    assert.equal(typeof checkout.expires_at, "string");

    const heldReplayResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          ...signedUcpHeaders({
            method: "POST",
            target: "/ucp/v1/checkout-sessions",
            body: checkoutBody,
            idempotencyKey,
          }),
        },
        body: checkoutBody,
      },
    );
    assert.equal(heldReplayResponse.status, 201);
    const heldReplay = (await heldReplayResponse.json()) as Record<string, any>;
    assert.equal(heldReplay.id, checkout.id);
    assert.equal(heldReplay.status, "requires_escalation");
    assert.equal(
      heldReplay.messages[0].severity,
      "requires_buyer_input",
    );
    assert.equal(heldReplay.expires_at, checkout.expires_at);
    assert.equal(stripeCreates, 1);

    const aliasReplayResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          ...signedUcpHeaders({
            method: "POST",
            target: "/ucp/v1/checkout-sessions",
            body: checkoutBody,
            idempotencyKey,
            profileUrl: "https://agent-alias.example/.well-known/ucp",
          }),
        },
        body: checkoutBody,
      },
    );
    assert.equal(aliasReplayResponse.status, 201);
    assert.equal(
      ((await aliasReplayResponse.json()) as Record<string, unknown>).id,
      checkout.id,
    );
    assert.equal(stripeCreates, 1);

    const storedTarget = `/ucp/v1/checkout-sessions/${checkout.id}`;
    const storedHeaders = signedUcpHeaders({
      method: "GET",
      target: storedTarget,
    });
    const storedResponse = await fetch(
      `${origin}${storedTarget}`,
      {
        headers: storedHeaders,
      },
    );
    assert.equal(storedResponse.status, 200);
    const storedCheckout = (await storedResponse.json()) as Record<string, any>;
    assert.equal(storedCheckout.id, checkout.id);
    assert.equal(storedCheckout.continue_url, checkout.continue_url);
    assert.equal(
      storedCheckout.messages[0].severity,
      "requires_buyer_input",
    );
    assert.equal(storedCheckout.expires_at, checkout.expires_at);

    const replayedProofResponse = await fetch(`${origin}${storedTarget}`, {
      headers: storedHeaders,
    });
    assert.equal(replayedProofResponse.status, 404);
    assert.deepEqual(
      await replayedProofResponse.json(),
      expectedAuthenticationFailure,
    );

    const spoofedReadResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}`,
      {
        headers: {
          ...signedUcpHeaders({
            method: "GET",
            target: `/ucp/v1/checkout-sessions/${checkout.id}`,
            privateKey: otherAgentKeys.privateKey,
          }),
        },
      },
    );
    assert.equal(spoofedReadResponse.status, 404);
    assert.deepEqual(
      await spoofedReadResponse.json(),
      expectedAuthenticationFailure,
    );
    const staleCancelResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
            timestamp: String(Math.floor(Date.now() / 1000) - 301),
          }),
        },
      },
    );
    assert.equal(staleCancelResponse.status, 404);
    assert.deepEqual(
      await staleCancelResponse.json(),
      expectedAuthenticationFailure,
    );

    const otherAgentResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}`,
      {
        headers: {
          ...signedUcpHeaders({
            method: "GET",
            target: `/ucp/v1/checkout-sessions/${checkout.id}`,
            profileUrl: otherAgentProfileUrl,
            privateKey: otherAgentKeys.privateKey,
          }),
        },
      },
    );
    assert.equal(otherAgentResponse.status, 404);
    assert.deepEqual(
      await otherAgentResponse.json(),
      expectedAuthenticationFailure,
    );

    await db
      .update(splashAdReservationsTable)
      .set({ ucpAgentIdentityHash: null })
      .where(eq(splashAdReservationsTable.id, String(checkout.id)));
    const legacyReplayResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          ...signedUcpHeaders({
            method: "POST",
            target: "/ucp/v1/checkout-sessions",
            body: checkoutBody,
            idempotencyKey,
          }),
        },
        body: checkoutBody,
      },
    );
    assert.equal(legacyReplayResponse.status, 201);
    assert.equal(
      ((await legacyReplayResponse.json()) as Record<string, unknown>).id,
      checkout.id,
    );
    assert.equal(stripeCreates, 1);

    const [reservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(checkout.id)));
    assert.ok(reservation?.stripeCheckoutSessionId);
    assert.equal(
      reservation.ucpAgentIdentityHash,
      agentIdentityHash(),
    );
    assert.notEqual(
      reservation.ucpAgentIdentityHash,
      "https://agent.example/.well-known/ucp",
    );
    assert.equal(
      Date.parse(String(checkout.expires_at)),
      (reservation.inventoryHeldAt ?? reservation.createdAt).getTime() +
        20 * 60 * 1000,
    );
    await markSplashReservationPaidFromSession({
      id: reservation.stripeCheckoutSessionId,
      client_reference_id: reservation.id,
      currency: "usd",
      amount_total: 49000,
      payment_status: "paid",
      payment_intent: "pi_ucp_paid",
      customer_details: { email: "buyer@example.com" },
      metadata: {
        reservationId: reservation.id,
        offerKey: "reserve-490",
        sku: "reserve-490",
        checkoutAttempt: String(reservation.checkoutAttempt),
      },
    } as never);

    const replayResponse = await fetch(`${origin}/ucp/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        ...signedUcpHeaders({
          method: "POST",
          target: "/ucp/v1/checkout-sessions",
          body: checkoutBody,
          idempotencyKey,
        }),
      },
      body: checkoutBody,
    });
    assert.equal(replayResponse.status, 201);
    const replay = (await replayResponse.json()) as Record<string, any>;
    assert.equal(replay.id, checkout.id);
    assert.equal(replay.status, "completed");
    assert.equal(replay.continue_url, undefined);
    assert.equal(stripeCreates, 1);

    const changedBody = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
      context: { brand: "Changed payload" },
    });
    const changedBodyResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          ...signedUcpHeaders({
            method: "POST",
            target: "/ucp/v1/checkout-sessions",
            body: changedBody,
            idempotencyKey,
          }),
        },
        body: changedBody,
      },
    );
    assert.equal(changedBodyResponse.status, 409);

    const completeResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}/complete`,
      {
        method: "POST",
        headers: {
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${checkout.id}/complete`,
          }),
        },
      },
    );
    assert.equal(completeResponse.status, 405);
    const complete = (await completeResponse.json()) as Record<string, any>;
    assert.equal(complete.messages[0].code, "unsupported");
  } finally {
    setStripeCheckoutFunctionsForTests();
    setUcpProfileResolverForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("verified key succession preserves forward checkout access without enabling rollback", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  const rotationCheckoutIds: string[] = [];
  const stripeSessions = new Map<string, Record<string, unknown>>();
  let currentProfile = ucpProfile();
  let stripeCreates = 0;
  setUcpProfileResolverForTests(() => Promise.resolve(currentProfile));
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      stripeCreates += 1;
      const session = {
        id: `cs_test_rotation_${randomUUID().replaceAll("-", "")}`,
        url: "https://checkout.stripe.test/key-rotation",
        status: "open",
        payment_status: "unpaid",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: 49000,
        metadata: params.metadata,
      };
      stripeSessions.set(session.id, session);
      return session as never;
    },
    retrieve: async (id) => stripeSessions.get(id) as never,
    expire: async (id) => {
      const session = stripeSessions.get(id);
      assert.ok(session);
      session.status = "expired";
      return session as never;
    },
  });
  const createCheckout = async (input?: {
    keyId?: string;
    privateKey?: KeyObject;
    idempotencyKey?: string;
    expectedStatus?: number;
  }) => {
    const idempotencyKey = input?.idempotencyKey ?? randomUUID();
    const body = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    });
    const response = await fetch(`${origin}/ucp/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        ...signedUcpHeaders({
          method: "POST",
          target: "/ucp/v1/checkout-sessions",
          body,
          idempotencyKey,
          keyId: input?.keyId,
          privateKey: input?.privateKey,
        }),
      },
      body,
    });
    assert.equal(response.status, input?.expectedStatus ?? 201);
    const checkout = (await response.json()) as Record<string, unknown>;
    if (checkout.id) rotationCheckoutIds.push(String(checkout.id));
    return checkout;
  };
  const readCheckout = (
    id: unknown,
    input?: {
      keyId?: string;
      privateKey?: KeyObject;
      profileUrl?: string;
    },
  ) => {
    const target = `/ucp/v1/checkout-sessions/${String(id)}`;
    return fetch(`${origin}${target}`, {
      headers: signedUcpHeaders({
        method: "GET",
        target,
        keyId: input?.keyId,
        privateKey: input?.privateKey,
        profileUrl: input?.profileUrl,
      }),
    });
  };

  try {
    const predecessorIdempotencyKey = randomUUID();
    const predecessorCheckout = await createCheckout({
      idempotencyKey: predecessorIdempotencyKey,
    });
    await db
      .delete(ucpAgentCheckoutIdempotencyTable)
      .where(
        eq(
          ucpAgentCheckoutIdempotencyTable.reservationId,
          String(predecessorCheckout.id),
        ),
      );
    const predecessorLegacyReplay = await createCheckout({
      idempotencyKey: predecessorIdempotencyKey,
    });
    assert.equal(predecessorLegacyReplay.id, predecessorCheckout.id);
    assert.equal(stripeCreates, 1);
    await db
      .delete(ucpAgentCheckoutIdempotencyTable)
      .where(
        eq(
          ucpAgentCheckoutIdempotencyTable.reservationId,
          String(predecessorCheckout.id),
        ),
      );
    const validSuccession = keySuccession();
    await db
      .update(splashAdReservationsTable)
      .set({ ucpAgentIdentityHash: null })
      .where(
        eq(
          splashAdReservationsTable.id,
          String(predecessorCheckout.id),
        ),
      );
    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [validSuccession],
    });

    const successorReplay = await createCheckout({
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
      idempotencyKey: predecessorIdempotencyKey,
    });
    assert.equal(successorReplay.id, predecessorCheckout.id);
    assert.equal(stripeCreates, 1);
    const successorRead = await readCheckout(predecessorCheckout.id, {
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
    });
    assert.equal(successorRead.status, 200);
    assert.equal(
      ((await successorRead.json()) as Record<string, unknown>).id,
      predecessorCheckout.id,
    );
    const adoptedMappings = await db
      .select()
      .from(ucpAgentCheckoutIdempotencyTable)
      .where(
        eq(
          ucpAgentCheckoutIdempotencyTable.reservationId,
          String(predecessorCheckout.id),
        ),
      );
    assert.deepEqual(
      new Set(adoptedMappings.map((mapping) => mapping.agentIdentityHash)),
      new Set([
        agentIdentityHash(),
        agentIdentityHash(successorAgentKeys.publicKey),
      ]),
    );
    const [adoptedReservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(
        eq(
          splashAdReservationsTable.id,
          String(predecessorCheckout.id),
        ),
      );
    assert.equal(
      adoptedReservation?.ucpAgentIdentityHash,
      agentIdentityHash(),
    );

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
    });
    const postSuccessionLegacyRead = await readCheckout(
      predecessorCheckout.id,
      {
        keyId: "checkout-agent-key-v2",
        privateKey: successorAgentKeys.privateKey,
      },
    );
    assert.equal(postSuccessionLegacyRead.status, 404);
    await createCheckout({
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
      idempotencyKey: predecessorIdempotencyKey,
      expectedStatus: 404,
    });
    assert.equal(stripeCreates, 1);

    currentProfile = ucpProfile();
    const predecessorAfterAdoption = await createCheckout({
      idempotencyKey: predecessorIdempotencyKey,
    });
    assert.equal(predecessorAfterAdoption.id, predecessorCheckout.id);
    assert.equal(stripeCreates, 1);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [validSuccession],
    });
    const secondSuccession = keySuccession({
      predecessorKeys: successorAgentKeys,
      successorKeys: secondSuccessorAgentKeys,
      predecessorKeyId: "checkout-agent-key-v2",
      successorKeyId: "checkout-agent-key-v3",
    });
    currentProfile = ucpProfile(secondSuccessorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v3",
      keySuccession: [validSuccession, secondSuccession],
    });
    const secondSuccessorRead = await readCheckout(predecessorCheckout.id, {
      keyId: "checkout-agent-key-v3",
      privateKey: secondSuccessorAgentKeys.privateKey,
    });
    assert.equal(secondSuccessorRead.status, 200);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [validSuccession],
    });
    const wrongProfileRead = await readCheckout(predecessorCheckout.id, {
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
      profileUrl: "https://agent-alias.example/.well-known/ucp",
    });
    assert.equal(wrongProfileRead.status, 404);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [
        keySuccession({ signingKey: successorAgentKeys.privateKey }),
      ],
    });
    const forgedRead = await readCheckout(predecessorCheckout.id, {
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
    });
    assert.equal(forgedRead.status, 404);

    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [
        keySuccession({
          notBefore: new Date(Date.now() - 120_000).toISOString(),
          expiresAt: expiredAt,
        }),
      ],
    });
    const expiredRead = await readCheckout(predecessorCheckout.id, {
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
    });
    assert.equal(expiredRead.status, 404);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [
        keySuccession({
          notBefore: new Date(Date.now() + 60_000).toISOString(),
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        }),
      ],
    });
    const prematureRead = await readCheckout(predecessorCheckout.id, {
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
    });
    assert.equal(prematureRead.status, 404);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [validSuccession],
    });
    const successorIdempotencyKey = randomUUID();
    const successorCheckout = await createCheckout({
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
      idempotencyKey: successorIdempotencyKey,
    });
    currentProfile = ucpProfile();
    const rollbackRead = await readCheckout(successorCheckout.id);
    assert.equal(rollbackRead.status, 404);
    await createCheckout({
      idempotencyKey: successorIdempotencyKey,
      expectedStatus: 404,
    });
    assert.equal(stripeCreates, 2);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
    });
    const postExpiryReplay = await createCheckout({
      keyId: "checkout-agent-key-v2",
      privateKey: successorAgentKeys.privateKey,
      idempotencyKey: successorIdempotencyKey,
    });
    assert.equal(postExpiryReplay.id, successorCheckout.id);
    assert.equal(stripeCreates, 2);

    currentProfile = ucpProfile(successorAgentKeys.publicKey, {
      keyId: "checkout-agent-key-v2",
      keySuccession: [validSuccession],
    });
    const cancelTarget =
      `/ucp/v1/checkout-sessions/${String(predecessorCheckout.id)}/cancel`;
    const successorCancel = await fetch(`${origin}${cancelTarget}`, {
      method: "POST",
      headers: signedUcpHeaders({
        method: "POST",
        target: cancelTarget,
        keyId: "checkout-agent-key-v2",
        privateKey: successorAgentKeys.privateKey,
      }),
    });
    assert.equal(successorCancel.status, 200);
    assert.equal(
      ((await successorCancel.json()) as Record<string, unknown>).status,
      "canceled",
    );
  } finally {
    for (const id of rotationCheckoutIds) {
      await db
        .delete(splashAdReservationsTable)
        .where(eq(splashAdReservationsTable.id, id));
    }
    setStripeCheckoutFunctionsForTests();
    setUcpProfileResolverForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("UCP rotates active checkout ownership only with the recorded identity key and audits it", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  const previousProfileUrl = "https://old-agent.example/.well-known/ucp";
  const replacementProfileUrl =
    "https://new-agent.example/.well-known/ucp";
  const unrelatedProfileUrl =
    "https://unrelated-agent.example/.well-known/ucp";
  const previousKeys = generateKeyPairSync("ed25519");
  const replacementKeys = generateKeyPairSync("ed25519");
  const unrelatedKeys = generateKeyPairSync("ed25519");
  const publicKeys = new Map<string, Record<string, unknown>>([
    [
      previousProfileUrl,
      previousKeys.publicKey.export({ format: "jwk" }) as Record<
        string,
        unknown
      >,
    ],
    [
      replacementProfileUrl,
      replacementKeys.publicKey.export({ format: "jwk" }) as Record<
        string,
        unknown
      >,
    ],
    [
      unrelatedProfileUrl,
      unrelatedKeys.publicKey.export({ format: "jwk" }) as Record<
        string,
        unknown
      >,
    ],
  ]);
  const keyPairs = new Map([
    [previousProfileUrl, previousKeys],
    [replacementProfileUrl, replacementKeys],
    [unrelatedProfileUrl, unrelatedKeys],
  ]);
  setUcpProfileResolverForTests(async (profileUrl) => {
    const keyPair = keyPairs.get(profileUrl);
    assert.ok(keyPair);
    const profile = ucpProfile(keyPair.publicKey);
    return {
      ucp: {
        ...profile.ucp,
        identityPublicKey: publicKeys.get(profileUrl) ?? null,
      },
    };
  });
  const requestAs = (
    profileUrl: string,
    target: string,
    init: {
      method?: string;
      headers?: HeadersInit;
      body?: string;
    } = {},
  ) => {
    const keyPair = keyPairs.get(profileUrl);
    assert.ok(keyPair);
    return signedUcpRequest({
      target,
      method: init.method,
      headers: init.headers,
      body: init.body,
      profileUrl,
      privateKey: keyPair.privateKey,
    });
  };
  const sessions = new Map<string, Record<string, any>>();
  const expiredSessions: string[] = [];
  let stripeCreates = 0;
  const blockedSessionIds = new Set<string>();
  let blockedRetrieveCount = 0;
  let blockedRetrieveTarget = 0;
  let blockedRetrieveGate: Promise<void> | undefined;
  let signalBlockedRetrieve: (() => void) | undefined;
  let blockNextStripeCreate = false;
  let blockedCreateGate: Promise<void> | undefined;
  let signalBlockedCreate: (() => void) | undefined;
  let releaseBlockedCreate: (() => void) | undefined;
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      stripeCreates += 1;
      if (blockNextStripeCreate && blockedCreateGate) {
        blockNextStripeCreate = false;
        signalBlockedCreate?.();
        await blockedCreateGate;
      }
      const session = {
        id: `cs_test_rotation_${randomUUID().replaceAll("-", "")}`,
        url: "https://checkout.stripe.test/identity-rotation",
        status: "open",
        payment_status: "unpaid",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: 49000,
        metadata: params.metadata,
      };
      sessions.set(session.id, session);
      return session as never;
    },
    retrieve: async (sessionId) => {
      if (blockedSessionIds.has(sessionId) && blockedRetrieveGate) {
        blockedRetrieveCount += 1;
        if (blockedRetrieveCount === blockedRetrieveTarget) {
          signalBlockedRetrieve?.();
        }
        await blockedRetrieveGate;
      }
      return sessions.get(sessionId) as never;
    },
    expire: async (sessionId) => {
      const session = sessions.get(sessionId);
      assert.ok(session);
      session.status = "expired";
      expiredSessions.push(sessionId);
      return session as never;
    },
  });
  try {
    const checkoutBody = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    });
    const legacyIdempotencyKey = randomUUID();
    const legacyPublicIdempotencyKey = `ucp:${createHash("sha256")
      .update(`${previousProfileUrl}\n${legacyIdempotencyKey}`)
      .digest("hex")}`;
    const [legacyReservation] = await db
      .insert(splashAdReservationsTable)
      .values({
        email: `ucp-${createHash("sha256")
          .update(legacyIdempotencyKey)
          .digest("hex")
          .slice(0, 24)}@buyer.invalid`,
        brandName: "UCP buyer",
        adInterest: "post_checkout",
        promotedOffer: "Birch Reserve Starter",
        status: "payment_pending",
        offerKey: "reserve-490",
        amountCents: 49000,
        currency: "usd",
        source: "birch_reserve_v1_checkout",
        followUpBy: new Date(),
        paymentStatus: "checkout_created",
        creativeStatus: "locked",
        inventoryHeldAt: new Date(),
        checkoutAttempt: 1,
        stripeCheckoutSessionId: `cs_test_legacy_${randomUUID().replaceAll("-", "")}`,
        stripeCheckoutUrl: "https://checkout.stripe.test/legacy-profile-owner",
        publicIdempotencyKey: legacyPublicIdempotencyKey,
        publicRequestFingerprint: createHash("sha256")
          .update(checkoutBody)
          .digest("hex"),
        ucpAgentIdentityHash: createHash("sha256")
          .update(previousProfileUrl)
          .digest("hex"),
      })
      .returning();
    createdIds.push(legacyReservation.id);
    sessions.set(String(legacyReservation.stripeCheckoutSessionId), {
      id: legacyReservation.stripeCheckoutSessionId,
      url: legacyReservation.stripeCheckoutUrl,
      status: "open",
      payment_status: "unpaid",
      client_reference_id: legacyReservation.id,
      currency: "usd",
      amount_total: 49000,
      metadata: {
        reservationId: legacyReservation.id,
        offerKey: "reserve-490",
        sku: "reserve-490",
        checkoutAttempt: "1",
      },
    });

    const legacyReadBeforeEnrollment = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${legacyReservation.id}`,
      { headers: { "ucp-agent": `profile="${previousProfileUrl}"` } },
    );
    assert.equal(legacyReadBeforeEnrollment.status, 404);

    const legacyRetry = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": legacyIdempotencyKey,
          "ucp-agent": `profile="${previousProfileUrl}"`,
        },
        body: checkoutBody,
      },
    );
    assert.equal(legacyRetry.status, 201);
    assert.equal(
      ((await legacyRetry.json()) as Record<string, unknown>).id,
      legacyReservation.id,
    );
    assert.equal(stripeCreates, 0);

    const [enrolledLegacyReservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, legacyReservation.id));
    assert.equal(
      enrolledLegacyReservation?.ucpAgentIdentityHash,
      agentIdentityHash(previousKeys.publicKey),
    );
    assert.equal(
      enrolledLegacyReservation?.ucpAgentProfileUrl,
      previousProfileUrl,
    );
    assert.deepEqual(
      enrolledLegacyReservation?.ucpAgentPublicKey,
      publicKeys.get(previousProfileUrl),
    );
    const [enrollmentAudit] = await db
      .select()
      .from(ucpAgentIdentityEnrollmentsTable)
      .where(
        eq(
          ucpAgentIdentityEnrollmentsTable.reservationId,
          legacyReservation.id,
        ),
      );
    assert.equal(enrollmentAudit?.profileUrl, previousProfileUrl);
    assert.equal(
      enrollmentAudit?.previousIdentityHash,
      createHash("sha256").update(previousProfileUrl).digest("hex"),
    );
    assert.equal(
      enrollmentAudit?.recoveryProofHash,
      createHash("sha256").update(legacyIdempotencyKey).digest("hex"),
    );

    const legacyReadAfterEnrollment = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${legacyReservation.id}`,
      { headers: { "ucp-agent": `profile="${previousProfileUrl}"` } },
    );
    assert.equal(legacyReadAfterEnrollment.status, 200);

    const legacyRotationAuthorization = continuityAuthorization({
      checkoutId: legacyReservation.id,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
    });
    const legacyRotation = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${legacyReservation.id}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${replacementProfileUrl}"`,
          "ucp-identity-continuity": legacyRotationAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: legacyIdempotencyKey,
        }),
      },
    );
    assert.equal(legacyRotation.status, 200);
    const legacyReplacementRead = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${legacyReservation.id}`,
      { headers: { "ucp-agent": `profile="${replacementProfileUrl}"` } },
    );
    assert.equal(legacyReplacementRead.status, 200);
    const legacyPreviousRead = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${legacyReservation.id}`,
      { headers: { "ucp-agent": `profile="${previousProfileUrl}"` } },
    );
    assert.equal(legacyPreviousRead.status, 404);

    const idempotencyKey = randomUUID();
    const createResponse = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "ucp-agent": `profile="${previousProfileUrl}"`,
        },
        body: checkoutBody,
      },
    );
    assert.equal(createResponse.status, 201);
    const checkout = (await createResponse.json()) as Record<string, any>;
    const checkoutId = String(checkout.id);
    createdIds.push(checkoutId);
    const [createdReservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, checkoutId));
    assert.match(createdReservation?.publicIdempotencyKey ?? "", /^ucp:/);
    const unsignedPublicRetryBody = JSON.stringify({
      sku: "reserve-490",
      email: `ucp-${createHash("sha256")
        .update(idempotencyKey)
        .digest("hex")
        .slice(0, 24)}@buyer.invalid`,
      brand: "UCP buyer",
      idempotency_key: createdReservation?.publicIdempotencyKey,
    });
    const unsignedPublicRetryBeforeRotation = await fetch(
      `${origin}/v1/checkout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: unsignedPublicRetryBody,
      },
    );
    assert.equal(unsignedPublicRetryBeforeRotation.status, 400);
    assert.deepEqual(
      await unsignedPublicRetryBeforeRotation.json(),
      {
        error: "Invalid checkout request.",
        checkout_url: null,
        order_id: null,
        reservationId: null,
        amountCents: 49000,
        currency: "usd",
      },
    );
    assert.equal(stripeCreates, 1);

    const unsignedRotation = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${replacementProfileUrl}"`,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: idempotencyKey,
        }),
      },
    );
    assert.equal(unsignedRotation.status, 404);

    const unrelatedAuthorization = continuityAuthorization({
      checkoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: unrelatedKeys.privateKey,
    });
    const unrelatedRotation = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${replacementProfileUrl}"`,
          "ucp-identity-continuity": unrelatedAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: idempotencyKey,
        }),
      },
    );
    assert.equal(unrelatedRotation.status, 404);

    const authorizationId = randomUUID();
    const authorization = continuityAuthorization({
      checkoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
      authorizationId,
    });
    const rotationResponses = await Promise.all(
      [1, 2].map(() =>
        requestAs(
          replacementProfileUrl,
          `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "ucp-agent": `profile="${replacementProfileUrl}"`,
              "ucp-identity-continuity": authorization,
            },
            body: JSON.stringify({
              previous_profile: previousProfileUrl,
              idempotency_key: idempotencyKey,
            }),
          },
        ),
      ),
    );
    assert.deepEqual(
      rotationResponses.map((response) => response.status).sort(),
      [200, 404],
    );
    const successfulRotation = rotationResponses.find(
      (response) => response.status === 200,
    );
    assert.ok(successfulRotation);
    assert.equal(
      ((await successfulRotation.json()) as Record<string, unknown>).id,
      checkoutId,
    );

    const replayedRotation = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${replacementProfileUrl}"`,
          "ucp-identity-continuity": authorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: idempotencyKey,
        }),
      },
    );
    assert.equal(replayedRotation.status, 404);

    const [stored] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, checkoutId));
    assert.equal(stored?.ucpAgentProfileUrl, replacementProfileUrl);
    assert.equal(
      stored?.ucpAgentIdentityHash,
      agentIdentityHash(replacementKeys.publicKey),
    );
    assert.deepEqual(stored?.ucpAgentPublicKey, publicKeys.get(replacementProfileUrl));
    const unsignedPublicRetryAfterRotation = await fetch(
      `${origin}/v1/checkout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: unsignedPublicRetryBody,
      },
    );
    assert.equal(unsignedPublicRetryAfterRotation.status, 400);
    assert.deepEqual(
      await unsignedPublicRetryAfterRotation.json(),
      {
        error: "Invalid checkout request.",
        checkout_url: null,
        order_id: null,
        reservationId: null,
        amountCents: 49000,
        currency: "usd",
      },
    );
    assert.equal(stripeCreates, 1);

    const [audit] = await db
      .select()
      .from(ucpAgentIdentityRotationsTable)
      .where(eq(ucpAgentIdentityRotationsTable.reservationId, checkoutId));
    assert.equal(audit?.previousProfileUrl, previousProfileUrl);
    assert.equal(audit?.replacementProfileUrl, replacementProfileUrl);
    assert.equal(
      audit?.authorizationIdHash,
      createHash("sha256").update(authorizationId).digest("hex"),
    );
    assert.equal(
      audit?.authorizationProofHash,
      createHash("sha256").update(authorization).digest("hex"),
    );
    assert.match(audit?.previousPublicKeyThumbprint ?? "", /^[A-Za-z0-9_-]{43}$/);

    const oldAccess = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}`,
      { headers: { "ucp-agent": `profile="${previousProfileUrl}"` } },
    );
    const unrelatedAccess = await requestAs(
      unrelatedProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}`,
      { headers: { "ucp-agent": `profile="${unrelatedProfileUrl}"` } },
    );
    const replacementAccess = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}`,
      { headers: { "ucp-agent": `profile="${replacementProfileUrl}"` } },
    );
    const replacementCreateReplay = await requestAs(
      replacementProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "ucp-agent": `profile="${replacementProfileUrl}"`,
        },
        body: checkoutBody,
      },
    );
    const oldCreateReplay = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "ucp-agent": `profile="${previousProfileUrl}"`,
        },
        body: checkoutBody,
      },
    );
    assert.equal(oldAccess.status, 404);
    assert.equal(unrelatedAccess.status, 404);
    assert.equal(oldCreateReplay.status, 404);
    assert.equal(replacementCreateReplay.status, 201);
    assert.equal(
      ((await replacementCreateReplay.json()) as Record<string, unknown>).id,
      checkoutId,
    );
    assert.equal(stripeCreates, 1);
    const notFound = await oldAccess.json();
    assert.deepEqual(await unrelatedAccess.json(), notFound);
    assert.deepEqual(await oldCreateReplay.json(), notFound);
    assert.equal(replacementAccess.status, 200);
    const legitimatePublicCheckout = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-490",
        email: "public-buyer@example.com",
        brand: "Public buyer",
        idempotency_key: randomUUID(),
      }),
    });
    assert.equal(legitimatePublicCheckout.status, 200);
    const legitimatePublicReceipt =
      (await legitimatePublicCheckout.json()) as Record<string, unknown>;
    assert.notEqual(legitimatePublicReceipt.order_id, checkoutId);
    assert.equal(typeof legitimatePublicReceipt.checkout_url, "string");
    assert.equal(stripeCreates, 2);
    createdIds.push(String(legitimatePublicReceipt.order_id));

    const collisionIdempotencyKey = randomUUID();
    const oldCollisionCheckoutResponse = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": collisionIdempotencyKey,
        },
        body: checkoutBody,
      },
    );
    const replacementCollisionCheckoutResponse = await requestAs(
      replacementProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": collisionIdempotencyKey,
        },
        body: checkoutBody,
      },
    );
    assert.equal(oldCollisionCheckoutResponse.status, 201);
    assert.equal(replacementCollisionCheckoutResponse.status, 201);
    const oldCollisionCheckout =
      (await oldCollisionCheckoutResponse.json()) as Record<string, unknown>;
    const replacementCollisionCheckout =
      (await replacementCollisionCheckoutResponse.json()) as Record<
        string,
        unknown
      >;
    const oldCollisionCheckoutId = String(oldCollisionCheckout.id);
    const replacementCollisionCheckoutId = String(
      replacementCollisionCheckout.id,
    );
    assert.notEqual(oldCollisionCheckoutId, replacementCollisionCheckoutId);
    createdIds.push(oldCollisionCheckoutId, replacementCollisionCheckoutId);
    const collisionAuthorization = continuityAuthorization({
      checkoutId: oldCollisionCheckoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
    });
    const collisionRotation = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${oldCollisionCheckoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-identity-continuity": collisionAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: collisionIdempotencyKey,
        }),
      },
    );
    assert.equal(collisionRotation.status, 404);
    const [unchangedCollisionCheckout] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, oldCollisionCheckoutId));
    assert.equal(
      unchangedCollisionCheckout?.ucpAgentIdentityHash,
      agentIdentityHash(previousKeys.publicKey),
    );
    const [unexpectedCollisionAlias] = await db
      .select()
      .from(ucpCheckoutIdempotencyAliasesTable)
      .where(
        and(
          eq(
            ucpCheckoutIdempotencyAliasesTable.reservationId,
            oldCollisionCheckoutId,
          ),
          eq(
            ucpCheckoutIdempotencyAliasesTable.agentIdentityHash,
            agentIdentityHash(replacementKeys.publicKey),
          ),
        ),
      );
    const [unexpectedCollisionAudit] = await db
      .select()
      .from(ucpAgentIdentityRotationsTable)
      .where(
        eq(
          ucpAgentIdentityRotationsTable.reservationId,
          oldCollisionCheckoutId,
        ),
      );
    assert.equal(unexpectedCollisionAlias, undefined);
    assert.equal(unexpectedCollisionAudit, undefined);
    const stripeCreatesAfterExistingCollision = stripeCreates;
    const replacementCollisionRetry = await requestAs(
      replacementProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": collisionIdempotencyKey,
        },
        body: checkoutBody,
      },
    );
    assert.equal(replacementCollisionRetry.status, 201);
    assert.equal(
      ((await replacementCollisionRetry.json()) as Record<string, unknown>).id,
      replacementCollisionCheckoutId,
    );
    assert.equal(stripeCreates, stripeCreatesAfterExistingCollision);

    const concurrentIdempotencyKey = randomUUID();
    const oldConcurrentCheckoutResponse = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": concurrentIdempotencyKey,
        },
        body: checkoutBody,
      },
    );
    assert.equal(oldConcurrentCheckoutResponse.status, 201);
    const oldConcurrentCheckout =
      (await oldConcurrentCheckoutResponse.json()) as Record<string, unknown>;
    const oldConcurrentCheckoutId = String(oldConcurrentCheckout.id);
    createdIds.push(oldConcurrentCheckoutId);
    blockedCreateGate = new Promise<void>((resolve) => {
      releaseBlockedCreate = resolve;
    });
    const blockedCreateStarted = new Promise<void>((resolve) => {
      signalBlockedCreate = resolve;
    });
    blockNextStripeCreate = true;
    const concurrentReplacementCreate = requestAs(
      replacementProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": concurrentIdempotencyKey,
        },
        body: checkoutBody,
      },
    );
    await blockedCreateStarted;
    const concurrentAuthorization = continuityAuthorization({
      checkoutId: oldConcurrentCheckoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
    });
    let concurrentRotationSettled = false;
    const concurrentRotationPromise = requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${oldConcurrentCheckoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-identity-continuity": concurrentAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: concurrentIdempotencyKey,
        }),
      },
    ).then((response) => {
      concurrentRotationSettled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(concurrentRotationSettled, false);
    releaseBlockedCreate?.();
    const [
      concurrentReplacementCreateResponse,
      concurrentRotationResponse,
    ] = await Promise.all([
      concurrentReplacementCreate,
      concurrentRotationPromise,
    ]);
    assert.equal(concurrentReplacementCreateResponse.status, 201);
    assert.equal(concurrentRotationResponse.status, 404);
    const concurrentReplacementCheckout =
      (await concurrentReplacementCreateResponse.json()) as Record<
        string,
        unknown
      >;
    const concurrentReplacementCheckoutId = String(
      concurrentReplacementCheckout.id,
    );
    createdIds.push(concurrentReplacementCheckoutId);
    const [unchangedConcurrentCheckout] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, oldConcurrentCheckoutId));
    assert.equal(
      unchangedConcurrentCheckout?.ucpAgentIdentityHash,
      agentIdentityHash(previousKeys.publicKey),
    );
    const [unexpectedConcurrentAlias] = await db
      .select()
      .from(ucpCheckoutIdempotencyAliasesTable)
      .where(
        and(
          eq(
            ucpCheckoutIdempotencyAliasesTable.reservationId,
            oldConcurrentCheckoutId,
          ),
          eq(
            ucpCheckoutIdempotencyAliasesTable.agentIdentityHash,
            agentIdentityHash(replacementKeys.publicKey),
          ),
        ),
      );
    const [unexpectedConcurrentAudit] = await db
      .select()
      .from(ucpAgentIdentityRotationsTable)
      .where(
        eq(
          ucpAgentIdentityRotationsTable.reservationId,
          oldConcurrentCheckoutId,
        ),
      );
    assert.equal(unexpectedConcurrentAlias, undefined);
    assert.equal(unexpectedConcurrentAudit, undefined);
    const stripeCreatesAfterConcurrentCollision = stripeCreates;
    const concurrentReplacementRetry = await requestAs(
      replacementProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": concurrentIdempotencyKey,
        },
        body: checkoutBody,
      },
    );
    assert.equal(concurrentReplacementRetry.status, 201);
    assert.equal(
      ((await concurrentReplacementRetry.json()) as Record<string, unknown>).id,
      concurrentReplacementCheckoutId,
    );
    assert.equal(stripeCreates, stripeCreatesAfterConcurrentCollision);
    blockedCreateGate = undefined;
    signalBlockedCreate = undefined;
    releaseBlockedCreate = undefined;

    const oldCancelAfterRotation = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}/cancel`,
      {
        method: "POST",
        headers: { "ucp-agent": `profile="${previousProfileUrl}"` },
      },
    );
    assert.equal(oldCancelAfterRotation.status, 404);
    assert.deepEqual(expiredSessions, []);

    const rotateBackAuthorization = continuityAuthorization({
      checkoutId,
      previousProfileUrl: replacementProfileUrl,
      replacementProfileUrl: previousProfileUrl,
      privateKey: replacementKeys.privateKey,
    });
    const rotateBack = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${previousProfileUrl}"`,
          "ucp-identity-continuity": rotateBackAuthorization,
        },
        body: JSON.stringify({
          previous_profile: replacementProfileUrl,
          idempotency_key: idempotencyKey,
        }),
      },
    );
    assert.equal(rotateBack.status, 200);
    const rotateAgainAuthorization = continuityAuthorization({
      checkoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
    });
    const rotateAgain = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${replacementProfileUrl}"`,
          "ucp-identity-continuity": rotateAgainAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: idempotencyKey,
        }),
      },
    );
    assert.equal(rotateAgain.status, 200);
    const rotationHistory = await db
      .select()
      .from(ucpAgentIdentityRotationsTable)
      .where(eq(ucpAgentIdentityRotationsTable.reservationId, checkoutId));
    assert.equal(rotationHistory.length, 3);

    const raceIdempotencyKey = randomUUID();
    const raceCreateResponse = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": raceIdempotencyKey,
          "ucp-agent": `profile="${previousProfileUrl}"`,
        },
        body: checkoutBody,
      },
    );
    assert.equal(raceCreateResponse.status, 201);
    const raceCheckout =
      (await raceCreateResponse.json()) as Record<string, unknown>;
    const raceCheckoutId = String(raceCheckout.id);
    createdIds.push(raceCheckoutId);
    const [raceReservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, raceCheckoutId));
    assert.ok(raceReservation?.stripeCheckoutSessionId);
    blockedSessionIds.add(raceReservation.stripeCheckoutSessionId);
    blockedRetrieveCount = 0;
    blockedRetrieveTarget = 1;
    let releaseBlockedRetrieve = () => {};
    blockedRetrieveGate = new Promise<void>((resolve) => {
      releaseBlockedRetrieve = resolve;
    });
    const blockedRetrieveStarted = new Promise<void>((resolve) => {
      signalBlockedRetrieve = resolve;
    });
    const racingCancel = requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${raceCheckoutId}/cancel`,
      {
        method: "POST",
        headers: { "ucp-agent": `profile="${previousProfileUrl}"` },
      },
    );
    await blockedRetrieveStarted;
    const racingAuthorization = continuityAuthorization({
      checkoutId: raceCheckoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
    });
    let racingRotationSettled = false;
    const racingRotationPromise = requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${raceCheckoutId.toUpperCase()}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-agent": `profile="${replacementProfileUrl}"`,
          "ucp-identity-continuity": racingAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: raceIdempotencyKey,
        }),
      },
    ).then((response) => {
      racingRotationSettled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(racingRotationSettled, false);
    releaseBlockedRetrieve();
    const [racingRotation, racingCancelResponse] = await Promise.all([
      racingRotationPromise,
      racingCancel,
    ]);
    assert.equal(racingRotation.status, 404);
    assert.equal(racingCancelResponse.status, 200);
    assert.deepEqual(expiredSessions, [raceReservation.stripeCheckoutSessionId]);

    blockedSessionIds.clear();
    blockedRetrieveGate = undefined;
    signalBlockedRetrieve = undefined;

    const headerlessCreateResponse = await requestAs(
      previousProfileUrl,
      "/ucp/v1/checkout-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: checkoutBody,
      },
    );
    assert.equal(headerlessCreateResponse.status, 201);
    const generatedIdempotencyKey =
      headerlessCreateResponse.headers.get("idempotency-key");
    assert.match(generatedIdempotencyKey ?? "", /^[0-9a-f-]{36}$/);
    const headerlessCheckout = (await headerlessCreateResponse.json()) as Record<
      string,
      unknown
    >;
    const headerlessCheckoutId = String(headerlessCheckout.id);
    createdIds.push(headerlessCheckoutId);
    const headerlessAuthorization = continuityAuthorization({
      checkoutId: headerlessCheckoutId,
      previousProfileUrl,
      replacementProfileUrl,
      privateKey: previousKeys.privateKey,
    });
    const headerlessRotation = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${headerlessCheckoutId}/identity-rotations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "ucp-identity-continuity": headerlessAuthorization,
        },
        body: JSON.stringify({
          previous_profile: previousProfileUrl,
          idempotency_key: generatedIdempotencyKey,
        }),
      },
    );
    assert.equal(headerlessRotation.status, 200);
    const headerlessReplacementRead = await requestAs(
      replacementProfileUrl,
      `/ucp/v1/checkout-sessions/${headerlessCheckoutId}`,
    );
    const headerlessPreviousRead = await requestAs(
      previousProfileUrl,
      `/ucp/v1/checkout-sessions/${headerlessCheckoutId}`,
    );
    assert.equal(headerlessReplacementRead.status, 200);
    assert.equal(headerlessPreviousRead.status, 404);

    const rotationCapacityInputs = [];
    for (let index = 0; index < 10; index += 1) {
      const idempotencyKey = randomUUID();
      const response = await requestAs(
        previousProfileUrl,
        "/ucp/v1/checkout-sessions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: checkoutBody,
        },
      );
      assert.equal(response.status, 201);
      const checkout = (await response.json()) as Record<string, unknown>;
      rotationCapacityInputs.push({
        checkoutId: String(checkout.id),
        idempotencyKey,
      });
    }
    createdIds.push(
      ...rotationCapacityInputs.map(({ checkoutId }) => checkoutId),
    );
    const capacityRotationResponses = await Promise.race([
      Promise.all(
        rotationCapacityInputs.map(({ checkoutId, idempotencyKey }) =>
          requestAs(
            replacementProfileUrl,
            `/ucp/v1/checkout-sessions/${checkoutId}/identity-rotations`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "ucp-identity-continuity": continuityAuthorization({
                  checkoutId,
                  previousProfileUrl,
                  replacementProfileUrl,
                  privateKey: previousKeys.privateKey,
                }),
              },
              body: JSON.stringify({
                previous_profile: previousProfileUrl,
                idempotency_key: idempotencyKey,
              }),
            },
          ),
        ),
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Concurrent rotations exhausted the pool.")),
          2_000,
        ),
      ),
    ]);
    assert.deepEqual(
      capacityRotationResponses.map((response) => response.status),
      Array.from({ length: 10 }, () => 200),
    );

    const capacityCreates = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const response = await requestAs(
          previousProfileUrl,
          "/ucp/v1/checkout-sessions",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "idempotency-key": randomUUID(),
            },
            body: checkoutBody,
          },
        );
        assert.equal(response.status, 201);
        return String(
          ((await response.json()) as Record<string, unknown>).id,
        );
      }),
    );
    createdIds.push(...capacityCreates);
    for (const session of sessions.values()) {
      if (capacityCreates.includes(String(session.client_reference_id))) {
        blockedSessionIds.add(String(session.id));
      }
    }
    assert.equal(blockedSessionIds.size, 10);
    blockedRetrieveCount = 0;
    blockedRetrieveTarget = 10;
    let releaseCapacityRetrieves = () => {};
    blockedRetrieveGate = new Promise<void>((resolve) => {
      releaseCapacityRetrieves = resolve;
    });
    const allCapacityRetrievesStarted = new Promise<void>((resolve) => {
      signalBlockedRetrieve = resolve;
    });
    const capacityCancellations = capacityCreates.map((checkoutId) =>
      requestAs(
        previousProfileUrl,
        `/ucp/v1/checkout-sessions/${checkoutId}/cancel`,
        { method: "POST" },
      ),
    );
    try {
      await Promise.race([
        allCapacityRetrievesStarted,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Cancellation pool capacity was exhausted.")),
            2_000,
          ),
        ),
      ]);
    } finally {
      releaseCapacityRetrieves();
    }
    const capacityCancellationResponses = await Promise.race([
      Promise.all(capacityCancellations),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Concurrent cancellations did not finish.")),
          2_000,
        ),
      ),
    ]);
    assert.deepEqual(
      capacityCancellationResponses.map((response) => response.status),
      Array.from({ length: 10 }, () => 200),
    );
    const completedCancellationSyncs = await waitFor(
      () =>
        Promise.all(
          [raceCheckoutId, ...capacityCreates].map(async (checkoutId) => {
            const [reservation] = await db
              .select({
                sheetSyncStatus: splashAdReservationsTable.sheetSyncStatus,
              })
              .from(splashAdReservationsTable)
              .where(eq(splashAdReservationsTable.id, checkoutId))
              .limit(1);
            return reservation?.sheetSyncStatus;
          }),
        ),
      (statuses) => statuses.every((status) => status === "disabled"),
    );
    assert.ok(
      completedCancellationSyncs.every((status) => status === "disabled"),
    );
  } finally {
    releaseBlockedCreate?.();
    setStripeCheckoutFunctionsForTests();
    setUcpProfileResolverForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("UCP cancellation expires Stripe before atomically releasing only unpaid holds", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  setUcpProfileResolverForTests(resolveTestUcpProfile);
  const sessions = new Map<string, Record<string, any>>();
  const expired: string[] = [];
  const pipelineUpdates: Array<{
    id: string;
    status: string;
    lifecycleReason: string | null;
  }> = [];
  setReservationPipelineUpdaterForTests(async (reservation) => {
    pipelineUpdates.push({
      id: reservation.id,
      status: reservation.status,
      lifecycleReason: reservation.lifecycleReason,
    });
    return "synced";
  });
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      const id = `cs_test_cancel_${randomUUID().replaceAll("-", "")}`;
      const session = {
        id,
        url: `https://checkout.stripe.test/${id}`,
        status: "open",
        payment_status: "unpaid",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: 49000,
        metadata: params.metadata,
      };
      sessions.set(id, session);
      return session as never;
    },
    retrieve: async (id) => sessions.get(id) as never,
    expire: async (id) => {
      const session = sessions.get(id);
      assert.ok(session);
      session.status = "expired";
      expired.push(id);
      return session as never;
    },
  });
  const headers = {
    "content-type": "application/json",
  };
  const createCheckout = () => {
    const idempotencyKey = randomUUID();
    const body = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    });
    return fetch(`${origin}/ucp/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        ...headers,
        "idempotency-key": idempotencyKey,
        ...signedUcpHeaders({
          method: "POST",
          target: "/ucp/v1/checkout-sessions",
          body,
          idempotencyKey,
        }),
      },
      body,
    });
  };

  try {
    const checkoutResponse = await createCheckout();
    assert.equal(checkoutResponse.status, 201);
    const checkout = (await checkoutResponse.json()) as Record<string, any>;
    createdIds.push(String(checkout.id));
    const sessionId = String(
      (
        await db
          .select()
          .from(splashAdReservationsTable)
          .where(eq(splashAdReservationsTable.id, String(checkout.id)))
      )[0]?.stripeCheckoutSessionId,
    );

    const otherAgentCancel = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
            profileUrl: otherAgentProfileUrl,
            privateKey: otherAgentKeys.privateKey,
          }),
        },
      },
    );
    assert.equal(otherAgentCancel.status, 404);
    assert.deepEqual(await otherAgentCancel.json(), {
      ucp: { version: "2026-04-08", status: "error" },
      messages: [
        {
          type: "error",
          code: "not_found",
          content: "Checkout session not found.",
          severity: "unrecoverable",
        },
      ],
    });
    assert.deepEqual(expired, []);
    const [stillOwned] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(checkout.id)));
    assert.equal(stillOwned?.status, "payment_pending");

    const cancelResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
          }),
        },
      },
    );
    assert.equal(cancelResponse.status, 200);
    assert.equal(
      ((await cancelResponse.json()) as Record<string, unknown>).status,
      "canceled",
    );
    assert.deepEqual(expired, [sessionId]);

    const repeatedResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${checkout.id}/cancel`,
          }),
        },
      },
    );
    assert.equal(repeatedResponse.status, 200);
    assert.equal(
      ((await repeatedResponse.json()) as Record<string, unknown>).status,
      "canceled",
    );
    assert.deepEqual(expired, [sessionId]);
    const [canceled] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(checkout.id)));
    assert.equal(canceled?.status, "expired");
    assert.equal(canceled?.paymentStatus, "checkout_created");
    assert.equal(canceled?.lifecycleReason, "buyer_agent_canceled");
    assert.equal(canceled?.stripeCheckoutUrl, null);
    const completedPipelineUpdates = await waitFor(
      async () => [...pipelineUpdates],
      (updates) =>
        updates.filter((update) => update.id === String(checkout.id)).length ===
        1,
    );
    assert.deepEqual(completedPipelineUpdates, [
      {
        id: String(checkout.id),
        status: "expired",
        lifecycleReason: "buyer_agent_canceled",
      },
    ]);

    const paidCheckoutResponse = await createCheckout();
    const paidCheckout = (await paidCheckoutResponse.json()) as Record<string, any>;
    createdIds.push(String(paidCheckout.id));
    const [paidReservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(paidCheckout.id)));
    assert.ok(paidReservation?.stripeCheckoutSessionId);
    await markSplashReservationPaidFromSession({
      ...sessions.get(paidReservation.stripeCheckoutSessionId),
      payment_status: "paid",
      status: "complete",
      payment_intent: "pi_cancel_race",
    } as never);
    const paidCancelResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${paidCheckout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${paidCheckout.id}/cancel`,
          }),
        },
      },
    );
    assert.equal(paidCancelResponse.status, 200);
    assert.equal(
      ((await paidCancelResponse.json()) as Record<string, unknown>).status,
      "completed",
    );
    const [stillPaid] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(paidCheckout.id)));
    assert.equal(stillPaid?.status, "paid");
    assert.equal(stillPaid?.paymentStatus, "paid");

    const [heldWithoutStripe] = await db
      .insert(splashAdReservationsTable)
      .values({
        email: `ucp-cancel-concurrent-${randomUUID()}@buyer.invalid`,
        status: "seat_held",
        offerKey: "reserve-490",
        amountCents: 49000,
        currency: "usd",
        source: "birch_reserve_v1_checkout",
        followUpBy: new Date(),
        paymentStatus: "unpaid",
        creativeStatus: "locked",
        ucpAgentIdentityHash: agentIdentityHash(),
      })
      .returning();
    createdIds.push(heldWithoutStripe.id);
    const concurrentCancels = await Promise.all(
      [1, 2].map(() =>
        fetch(
          `${origin}/ucp/v1/checkout-sessions/${heldWithoutStripe.id}/cancel`,
          {
            method: "POST",
            headers: {
              ...headers,
              ...signedUcpHeaders({
                method: "POST",
                target: `/ucp/v1/checkout-sessions/${heldWithoutStripe.id}/cancel`,
              }),
            },
          },
        ),
      ),
    );
    assert.deepEqual(
      concurrentCancels.map((response) => response.status),
      [200, 200],
    );
    assert.deepEqual(
      await Promise.all(
        concurrentCancels.map(async (response) => {
          const body = (await response.json()) as Record<string, unknown>;
          return body.status;
        }),
      ),
      ["canceled", "canceled"],
    );
    const concurrentSyncResult = await waitFor(
      async () => {
        const [reservation] = await db
          .select()
          .from(splashAdReservationsTable)
          .where(eq(splashAdReservationsTable.id, heldWithoutStripe.id));
        return {
          updateCount: pipelineUpdates.filter(
            (update) => update.id === heldWithoutStripe.id,
          ).length,
          sheetSyncStatus: reservation?.sheetSyncStatus,
        };
      },
      (result) =>
        result.updateCount === 1 && result.sheetSyncStatus === "synced",
    );
    assert.equal(concurrentSyncResult.updateCount, 1);

    let releaseInitialAppend: (() => void) | undefined;
    const initialAppendReleased = new Promise<void>((resolve) => {
      releaseInitialAppend = resolve;
    });
    let markInitialAppendStarted: (() => void) | undefined;
    const initialAppendStarted = new Promise<void>((resolve) => {
      markInitialAppendStarted = resolve;
    });
    let staffRow:
      | { id: string; status: string; lifecycleReason: string | null }
      | undefined;
    setReservationPipelineAppenderForTests(async (reservation) => {
      markInitialAppendStarted?.();
      await initialAppendReleased;
      staffRow = {
        id: reservation.id,
        status: reservation.status,
        lifecycleReason: reservation.lifecycleReason,
      };
      return "synced";
    });
    setReservationPipelineUpdaterForTests(async (reservation) => {
      staffRow = {
        id: reservation.id,
        status: reservation.status,
        lifecycleReason: reservation.lifecycleReason,
      };
      return "synced";
    });
    const racingCheckoutResponse = await createCheckout();
    assert.equal(racingCheckoutResponse.status, 201);
    const racingCheckout =
      (await racingCheckoutResponse.json()) as Record<string, unknown>;
    createdIds.push(String(racingCheckout.id));
    await initialAppendStarted;
    const racingCancelResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${racingCheckout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${racingCheckout.id}/cancel`,
          }),
        },
      },
    );
    assert.equal(racingCancelResponse.status, 200);
    releaseInitialAppend?.();
    const raceResult = await waitFor(
      async () => {
        const [reservation] = await db
          .select()
          .from(splashAdReservationsTable)
          .where(
            eq(splashAdReservationsTable.id, String(racingCheckout.id)),
          );
        return { reservation, staffRow };
      },
      ({ reservation, staffRow: currentStaffRow }) =>
        reservation?.sheetSyncStatus === "synced" &&
        currentStaffRow?.status === "expired" &&
        currentStaffRow.lifecycleReason === "buyer_agent_canceled",
    );
    assert.equal(raceResult.staffRow?.id, String(racingCheckout.id));
    assert.equal(raceResult.staffRow?.status, "expired");
    assert.equal(
      raceResult.staffRow?.lifecycleReason,
      "buyer_agent_canceled",
    );
    assert.equal(raceResult.reservation?.sheetSyncStatus, "synced");
    assert.equal(raceResult.reservation?.sheetSyncError, null);
    setReservationPipelineAppenderForTests();

    const [heldForFailedSync] = await db
      .insert(splashAdReservationsTable)
      .values({
        email: `ucp-cancel-sync-failure-${randomUUID()}@buyer.invalid`,
        status: "seat_held",
        offerKey: "reserve-490",
        amountCents: 49000,
        currency: "usd",
        source: "birch_reserve_v1_checkout",
        followUpBy: new Date(),
        paymentStatus: "unpaid",
        creativeStatus: "locked",
        ucpAgentIdentityHash: agentIdentityHash(),
      })
      .returning();
    createdIds.push(heldForFailedSync.id);
    setReservationPipelineUpdaterForTests(async () => {
      throw new Error("Pipeline is temporarily unavailable");
    });
    const failedSyncCancelResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${heldForFailedSync.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${heldForFailedSync.id}/cancel`,
          }),
        },
      },
    );
    assert.equal(failedSyncCancelResponse.status, 200);
    const releasedDespiteSyncFailure = await waitFor(
      async () =>
        (
          await db
            .select()
            .from(splashAdReservationsTable)
            .where(eq(splashAdReservationsTable.id, heldForFailedSync.id))
        )[0],
      (reservation) => reservation?.sheetSyncStatus === "failed",
    );
    assert.equal(releasedDespiteSyncFailure?.status, "expired");
    assert.equal(
      releasedDespiteSyncFailure?.lifecycleReason,
      "buyer_agent_canceled",
    );
    assert.equal(releasedDespiteSyncFailure?.sheetSyncStatus, "failed");

    const unresolvedCheckoutResponse = await createCheckout();
    const unresolvedCheckout =
      (await unresolvedCheckoutResponse.json()) as Record<string, any>;
    createdIds.push(String(unresolvedCheckout.id));
    setStripeCheckoutFunctionsForTests({
      retrieve: async () => {
        throw new Error("Stripe is temporarily unavailable");
      },
    });
    const unavailableCancelResponse = await fetch(
      `${origin}/ucp/v1/checkout-sessions/${unresolvedCheckout.id}/cancel`,
      {
        method: "POST",
        headers: {
          ...headers,
          ...signedUcpHeaders({
            method: "POST",
            target: `/ucp/v1/checkout-sessions/${unresolvedCheckout.id}/cancel`,
          }),
        },
      },
    );
    assert.equal(unavailableCancelResponse.status, 503);
    assert.deepEqual(await unavailableCancelResponse.json(), {
      ucp: { version: UCP_VERSION, status: "error" },
      messages: [
        {
          type: "error",
          code: "service_unavailable",
          content: "Checkout cancellation is temporarily unavailable.",
          severity: "recoverable",
        },
      ],
    });
    const [stillHeld] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(
        eq(splashAdReservationsTable.id, String(unresolvedCheckout.id)),
      );
    assert.equal(stillHeld?.status, "payment_pending");
    assert.equal(stillHeld?.paymentStatus, "checkout_created");
  } finally {
    setReservationPipelineAppenderForTests();
    setReservationPipelineUpdaterForTests();
    setStripeCheckoutFunctionsForTests();
    setUcpProfileResolverForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("UCP profile transport connects to the validated DNS address", async () => {
  let requestedAddress = "";
  setUcpNetworkFunctionsForTests({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async (target) => {
      requestedAddress = target.address;
      return {
        status: 200,
        payload: {
          ucp: {
            version: "2026-04-08",
            services: {},
            capabilities: {
              "dev.ucp.shopping.checkout": [
                {
                  version: "2026-04-08",
                  spec: "https://ucp.dev/2026-04-08/specification/checkout",
                  schema:
                    "https://ucp.dev/2026-04-08/schemas/shopping/checkout.json",
                },
              ],
            },
            payment_handlers: {},
            authentication: ucpProfile().ucp.authentication,
          },
        },
      };
    },
  });
  setUcpProfileResolverForTests();
  try {
    const result = await negotiateUcpAgent(
      'profile="https://agent.example/.well-known/ucp"',
    );
    assert.equal(result.ok, true);
    assert.equal(requestedAddress, "93.184.216.34");
  } finally {
    setUcpProfileResolverForTests();
    setUcpNetworkFunctionsForTests();
  }
});

test("failed UCP profile resolutions are negatively cached", async () => {
  let now = 1_000;
  let lookups = 0;
  let hostAvailable = false;
  setUcpNetworkFunctionsForTests({
    lookup: async () => {
      lookups += 1;
      if (!hostAvailable) throw new Error("NXDOMAIN");
      return [{ address: "93.184.216.34", family: 4 }];
    },
    request: async () => ({
      status: 200,
      payload: {
        ucp: {
          ...ucpProfile().ucp,
          services: {},
          payment_handlers: {},
        },
      },
    }),
    now: () => now,
  });
  setUcpProfileResolverForTests();
  try {
    const header = 'profile="https://missing-agent.example/.well-known/ucp"';
    const first = await negotiateUcpAgent(header);
    const retry = await negotiateUcpAgent(header);
    assert.equal(first.ok, false);
    assert.equal(retry.ok, false);
    if (first.ok || retry.ok) return;
    assert.equal(first.code, "invalid_profile_url");
    assert.deepEqual(retry, first);
    assert.equal(lookups, 1);
    hostAvailable = true;
    now += 15_001;
    const recovered = await negotiateUcpAgent(header);
    assert.equal(recovered.ok, true);
    assert.equal(lookups, 2);
  } finally {
    setUcpNetworkFunctionsForTests();
    setUcpProfileResolverForTests();
  }
});

test("UCP requires compatible agent negotiation before creating a resource", async () => {
  const missingAgent = await fetch(`${origin}/ucp/v1/checkout-sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    }),
  });
  assert.equal(missingAgent.status, 400);
  assert.equal(
    ((await missingAgent.json()) as Record<string, any>).messages[0].code,
    "invalid_profile_url",
  );

  setUcpProfileResolverForTests(async () => ({
    ...ucpProfile(),
    ucp: {
      ...ucpProfile().ucp,
      capabilities: {},
    },
  }));
  try {
    const body = JSON.stringify({
      line_items: [{ item: { id: "reserve-490" }, quantity: 1 }],
    });
    const incompatible = await fetch(`${origin}/ucp/v1/checkout-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...signedUcpHeaders({
          method: "POST",
          target: "/ucp/v1/checkout-sessions",
          body,
        }),
      },
      body,
    });
    assert.equal(incompatible.status, 200);
    assert.equal(
      ((await incompatible.json()) as Record<string, any>).messages[0].code,
      "capabilities_incompatible",
    );
  } finally {
    setUcpProfileResolverForTests();
  }
});

test("quote and checkout reject unsupported contract values", async () => {
  assert.equal((await fetch(`${origin}/v1/quote?format=unknown&days=30`)).status, 400);
  assert.equal((await fetch(`${origin}/v1/quote?format=recovery_plan&days=31`)).status, 400);
  assert.equal(
    (await fetch(`${origin}/v1/quote?format=recovery_plan&days=30`)).status,
    400,
  );
  const response = await fetch(`${origin}/v1/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sku: "other",
      email: "buyer@example.com",
      brand: "Buyer",
      idempotency_key: randomUUID(),
    }),
  });
  assert.equal(response.status, 400);
});

test("catalog and quotes expose every exact canonical tier", async () => {
  const catalog = (await (await fetch(`${origin}/v1/catalog.json`)).json()) as {
    offers: Array<Record<string, unknown>>;
  };
  const expected = [
    ["hold-190", 19000],
    ["reserve-490", 49000],
  ] as const;
  assert.deepEqual(
    catalog.offers.map((offer) => [offer.sku, offer.amount_cents]),
    expected,
  );
  for (const [sku, amountCents] of expected) {
    const response = await fetch(
      `${origin}/v1/quote?sku=${sku}&format=post_checkout&days=30`,
    );
    assert.equal(response.status, 200);
    const quote = (await response.json()) as Record<string, unknown>;
    assert.equal(quote.sku, sku);
    assert.equal(quote.offerKey, sku);
    assert.equal(quote.amountCents, amountCents);
    assert.equal(quote.currency, "USD");
  }
});

test("each exact canonical tier is stored and charged with exact Stripe data", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  const expected = [
    ["hold-190", 19000],
    ["reserve-490", 49000],
  ] as const;
  const sessions: Array<Record<string, unknown>> = [];
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      const line = params.line_items?.[0];
      const priceData = line?.price_data;
      sessions.push({
        amount: priceData?.unit_amount,
        currency: priceData?.currency,
        metadata: params.metadata,
        productMetadata: priceData?.product_data?.metadata,
      });
      return {
        id: `cs_test_matrix_${randomUUID().replaceAll("-", "")}`,
        url: `https://checkout.stripe.test/matrix-${sessions.length}`,
        client_reference_id: params.client_reference_id,
        currency: priceData?.currency,
        amount_total: priceData?.unit_amount,
        metadata: params.metadata,
      } as never;
    },
  });
  try {
    for (const [sku, amountCents] of expected) {
      const response = await fetch(`${origin}/v1/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku,
          email: `${sku}-${randomUUID()}@example.com`,
          brand: `Matrix ${sku}`,
          idempotency_key: randomUUID(),
        }),
      });
      assert.equal(response.status, 200);
      const receipt = (await response.json()) as Record<string, unknown>;
      createdIds.push(String(receipt.order_id));
      assert.equal(receipt.amountCents, amountCents);
      assert.equal(receipt.currency, "usd");
      const session = sessions.at(-1);
      assert.equal(session?.amount, amountCents);
      assert.equal(session?.currency, "usd");
      assert.equal((session?.metadata as Record<string, string>).offerKey, sku);
      assert.equal((session?.metadata as Record<string, string>).sku, sku);
      assert.equal(
        (session?.productMetadata as Record<string, string>).offerKey,
        sku,
      );
    }
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("checkout uses Stripe Price env ids when set and otherwise inline price_data", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  const previousHold = process.env.STRIPE_PRICE_HOLD_190;
  const previousSeat = process.env.STRIPE_PRICE_RESERVE_490;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  process.env.STRIPE_PRICE_HOLD_190 = "price_test_hold_190";
  delete process.env.STRIPE_PRICE_RESERVE_490;
  const seen: Array<{ price?: string; amount?: number }> = [];
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      const line = params.line_items?.[0];
      seen.push({
        price: typeof line?.price === "string" ? line.price : undefined,
        amount: line?.price_data?.unit_amount,
      });
      return {
        id: `cs_test_priceenv_${randomUUID().replaceAll("-", "")}`,
        url: "https://checkout.stripe.test/price-env",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: line?.price ? 19000 : line?.price_data?.unit_amount,
        metadata: params.metadata,
      } as never;
    },
  });
  try {
    const hold = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "hold-190",
        email: `hold-price-${randomUUID()}@example.com`,
        brand: "Price Env Hold",
        idempotency_key: randomUUID(),
      }),
    });
    assert.equal(hold.status, 200);
    createdIds.push(String(((await hold.json()) as { order_id: string }).order_id));
    assert.deepEqual(seen.at(-1), { price: "price_test_hold_190", amount: undefined });

    const seat = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-490",
        email: `seat-price-${randomUUID()}@example.com`,
        brand: "Price Env Seat",
        idempotency_key: randomUUID(),
      }),
    });
    assert.equal(seat.status, 200);
    createdIds.push(String(((await seat.json()) as { order_id: string }).order_id));
    assert.equal(seen.at(-1)?.price, undefined);
    assert.equal(seen.at(-1)?.amount, 49000);
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
    if (previousHold === undefined) delete process.env.STRIPE_PRICE_HOLD_190;
    else process.env.STRIPE_PRICE_HOLD_190 = previousHold;
    if (previousSeat === undefined) delete process.env.STRIPE_PRICE_RESERVE_490;
    else process.env.STRIPE_PRICE_RESERVE_490 = previousSeat;
  }
});

test("public idempotency keys cannot be reused across canonical tiers", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = "100";
  const key = randomUUID();
  try {
    const first = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-490",
        email: `idempotency-${randomUUID()}@example.com`,
        brand: "Idempotency Buyer",
        idempotency_key: key,
      }),
    });
    assert.equal(first.status, 503);
    const firstReceipt = (await first.json()) as Record<string, unknown>;
    createdIds.push(String(firstReceipt.order_id));
    const second = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "hold-190",
        email: `idempotency-${randomUUID()}@example.com`,
        brand: "Idempotency Buyer",
        idempotency_key: key,
      }),
    });
    assert.equal(second.status, 409);
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("canonical tiers draw from one shared eight-seat inventory pool", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  const current = (await (await fetch(`${origin}/v1/availability.json`)).json()) as {
    seats_paid: number;
    seats_held: number;
  };
  process.env.SEATS_TOTAL = String(current.seats_paid + current.seats_held + 1);
  const requests = ["reserve-490", "reserve-490", "hold-190"].map((sku) =>
    fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku,
        email: `shared-pool-${sku}-${randomUUID()}@example.com`,
        brand: `Shared Pool ${sku}`,
        idempotency_key: randomUUID(),
      }),
    }),
  );
  try {
    const responses = await Promise.all(requests);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [409, 503, 503],
    );
    for (const response of responses) {
      const body = (await response.json()) as Record<string, unknown>;
      if (body.order_id) createdIds.push(String(body.order_id));
    }
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("Stripe-disabled checkout durably reuses one public reservation", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = "100";
  const idempotencyKey = randomUUID();
  const payload = {
    sku: "reserve-490",
    email: `public-${randomUUID()}@example.com`,
    brand: "Public-safe Buyer",
    format_pref: "recovery_plan",
    idempotency_key: idempotencyKey,
  };
  const first = await fetch(`${origin}/v1/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 503);
  const firstReceipt = (await first.json()) as Record<string, unknown>;
  assert.equal(firstReceipt.checkout_url, null);
  assert.equal(firstReceipt.amountCents, 49000);
  assert.equal(firstReceipt.currency, "usd");
  createdIds.push(String(firstReceipt.order_id));

  const second = await fetch(`${origin}/v1/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(second.status, 503);
  const secondReceipt = (await second.json()) as Record<string, unknown>;
  assert.equal(secondReceipt.order_id, firstReceipt.order_id);

  const rows = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.publicIdempotencyKey, idempotencyKey));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.offerKey, "reserve-490");
  assert.equal(rows[0]?.amountCents, 49000);
  assert.equal(rows[0]?.currency, "usd");

  const orderResponse = await fetch(`${origin}/v1/orders/${firstReceipt.order_id}`);
  const orderText = await orderResponse.text();
  assert.equal(orderResponse.status, 200);
  assert.doesNotMatch(orderText, new RegExp(payload.email));
  assert.doesNotMatch(orderText, /stripe|token|alert|pipeline/i);
  const order = JSON.parse(orderText) as Record<string, unknown>;
  assert.equal(order.status, "reserved");
  if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
  else process.env.SEATS_TOTAL = previousTotal;
});

test("a successful public checkout confirms payment without a webhook", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const previousTotal = process.env.SEATS_TOTAL;
  const sessionId = `cs_test_return_${randomUUID().replaceAll("-", "")}`;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  delete process.env.STRIPE_WEBHOOK_SECRET;
  setStripeCheckoutFunctionsForTests({
    create: async (params) =>
      ({
        id: sessionId,
        url: "https://checkout.stripe.test/public-return",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: 49000,
        metadata: params.metadata,
      }) as never,
    retrieve: async () =>
      ({
        id: sessionId,
        currency: "usd",
        amount_total: 49000,
        payment_status: "paid",
        payment_intent: "pi_public_return",
      }) as never,
  });

  try {
    const checkout = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-490",
        email: `paid-return-${randomUUID()}@example.com`,
        brand: "No Webhook Buyer",
        idempotency_key: randomUUID(),
      }),
    });
    assert.equal(checkout.status, 200);
    const receipt = (await checkout.json()) as Record<string, unknown>;
    const orderId = String(receipt.order_id);
    createdIds.push(orderId);

    setStripeCheckoutFunctionsForTests({
      retrieve: async () =>
        ({
          id: sessionId,
          client_reference_id: orderId,
          currency: "usd",
          amount_total: 49000,
          payment_status: "paid",
          payment_intent: "pi_public_return",
          metadata: {
            reservationId: orderId,
            offerKey: "reserve-490",
            sku: "reserve-490",
            checkoutAttempt: "1",
          },
        }) as never,
    });
    const confirmation = await fetch(
      `${origin}/v1/orders/${orderId}/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      },
    );
    assert.equal(confirmation.status, 200);
    const order = (await confirmation.json()) as Record<string, unknown>;
    assert.equal(order.status, "paid");
    assert.equal(order.payment_status, "paid");

    const [stored] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, orderId));
    assert.equal(stored?.status, "paid");
    assert.equal(stored?.paymentStatus, "paid");
    assert.equal(stored?.stripePaymentIntentId, "pi_public_return");
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("machine checkout confirmation rejects incomplete Stripe metadata", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  const sessionId = `cs_test_metadata_${randomUUID().replaceAll("-", "")}`;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  let orderId = "";
  setStripeCheckoutFunctionsForTests({
    create: async (params) =>
      ({
        id: sessionId,
        url: "https://checkout.stripe.test/metadata",
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: 49000,
        metadata: params.metadata,
      }) as never,
  });

  try {
    const checkout = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-490",
        email: `metadata-${randomUUID()}@example.com`,
        brand: "Strict Metadata Buyer",
        idempotency_key: randomUUID(),
      }),
    });
    assert.equal(checkout.status, 200);
    const receipt = (await checkout.json()) as Record<string, unknown>;
    orderId = String(receipt.order_id);
    createdIds.push(orderId);

    setStripeCheckoutFunctionsForTests({
      retrieve: async () =>
        ({
          id: sessionId,
          client_reference_id: orderId,
          currency: "usd",
          amount_total: 49000,
          payment_status: "paid",
          payment_intent: "pi_incomplete_metadata",
          metadata: {
            reservationId: orderId,
            offerKey: "reserve-490",
            sku: "reserve-490",
          },
        }) as never,
    });
    const confirmation = await fetch(`${origin}/v1/orders/${orderId}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    assert.equal(confirmation.status, 409);

    const [stored] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, orderId));
    assert.equal(stored?.paymentStatus, "checkout_created");
    assert.equal(stored?.stripePaymentIntentId, null);
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("sold-out inventory does not insert a new v1 reservation", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = "0";
  const idempotencyKey = randomUUID();
  try {
    const response = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-490",
        email: `sold-out-${randomUUID()}@example.com`,
        brand: "No Remaining Seat",
        idempotency_key: idempotencyKey,
      }),
    });
    assert.equal(response.status, 409);
    const rows = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.publicIdempotencyKey, idempotencyKey));
    assert.equal(rows.length, 0);
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("availability is integer-valued and buycalc remains useful without JavaScript", async () => {
  const availability = (await (
    await fetch(`${origin}/v1/availability.json`)
  ).json()) as Record<string, unknown>;
  assert.equal(Number.isInteger(availability.seats_open), true);
  assert.equal(Number.isInteger(availability.seats_held), true);

  const response = await fetch(`${origin}/buycalc`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  const html = await response.text();
  assert.match(html, /\$490 USD/);
  assert.match(html, /\$190 USD/);
  assert.doesNotMatch(html, /\$899/);
  assert.doesNotMatch(html, /\$4,900/);
  assert.doesNotMatch(html, /\$9,900/);
  assert.match(html, /100%/);
  assert.match(html, /No PHI/);
  assert.match(html, /<noscript>/);
  assert.match(html, /#C8F55A/);
});

test("an expired public hold returns its seat and receipt reports it as recycled", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `availability-${randomUUID()}@example.com`,
      status: "seat_held",
      offerKey: "reserve-490",
      amountCents: 49000,
      currency: "usd",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      inventoryHeldAt: old,
      followUpBy: old,
      createdAt: old,
    })
    .returning();
  assert.ok(reservation);
  createdIds.push(reservation.id);

  const cleanup = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
  });
  assert.equal(cleanup.expiredUnpaid, 1);

  const order = (await (
    await fetch(`${origin}/v1/orders/${reservation.id}`)
  ).json()) as Record<string, unknown>;
  assert.equal(order.status, "recycled");
  assert.equal(order.payment_status, "not_paid");
});

test("concurrent buyers cannot both claim the final open seat", async () => {
  const initial = (await (
    await fetch(`${origin}/v1/availability.json`)
  ).json()) as Record<string, number>;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = String(initial.seats_paid + initial.seats_held + 1);
  const payload = () => ({
    sku: "reserve-490",
    email: `last-seat-${randomUUID()}@example.com`,
    brand: "Concurrent Buyer",
    idempotency_key: randomUUID(),
  });
  try {
    const responses = await Promise.all(
      [payload(), payload()].map((body) =>
        fetch(`${origin}/v1/checkout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    );
    const receipts = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
      })),
    );
    assert.deepEqual(
      receipts.map((receipt) => receipt.status).sort(),
      [409, 503],
    );
    for (const receipt of receipts) {
      if (receipt.body.order_id) createdIds.push(String(receipt.body.order_id));
    }
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("same-key retry safely replaces an invalid Stripe session", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  const idempotencyKey = randomUUID();
  let createCalls = 0;
  let expiredSessionId = "";
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      createCalls += 1;
      return {
        id: `cs_test_retry_${createCalls}`,
        url: `https://checkout.stripe.test/retry-${createCalls}`,
        client_reference_id: params.client_reference_id,
        currency: "usd",
        amount_total: createCalls === 1 ? 1 : 49000,
        metadata: params.metadata,
      } as never;
    },
    expire: async (sessionId) => {
      expiredSessionId = sessionId;
      return { id: sessionId, status: "expired" } as never;
    },
  });
  const payload = {
    sku: "reserve-490",
    email: `retry-${randomUUID()}@example.com`,
    brand: "Retry Buyer",
    idempotency_key: idempotencyKey,
  };
  try {
    const submit = () =>
      fetch(`${origin}/v1/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    const first = await submit();
    const firstReceipt = (await first.json()) as Record<string, unknown>;
    assert.equal(first.status, 503);
    createdIds.push(String(firstReceipt.order_id));
    assert.equal(expiredSessionId, "cs_test_retry_1");

    const second = await submit();
    const secondReceipt = (await second.json()) as Record<string, unknown>;
    assert.equal(second.status, 200);
    assert.equal(secondReceipt.order_id, firstReceipt.order_id);
    assert.equal(secondReceipt.checkout_url, "https://checkout.stripe.test/retry-2");
    const [row] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(firstReceipt.order_id)));
    assert.equal(row?.checkoutAttempt, 2);
    assert.equal(row?.paymentStatus, "checkout_created");
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("ambiguous Stripe creation failure stays held for reconciliation", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.PUBLIC_BASE_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.PUBLIC_BASE_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  setStripeCheckoutFunctionsForTests({
    create: async () => {
      throw new Error("Stripe response was lost");
    },
  });
  const payload = {
    sku: "reserve-490",
    email: `ambiguous-${randomUUID()}@example.com`,
    brand: "Ambiguous Buyer",
    idempotency_key: randomUUID(),
  };
  try {
    const first = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const receipt = (await first.json()) as Record<string, unknown>;
    assert.equal(first.status, 503);
    createdIds.push(String(receipt.order_id));
    const retry = await fetch(`${origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(retry.status, 409);
    const [row] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, String(receipt.order_id)));
    assert.equal(row?.status, "payment_pending");
    assert.equal(row?.paymentStatus, "checkout_creating");
    assert.equal(row?.lifecycleReason, "checkout_reconciliation_required");
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("public projection is an array fallback without marketplace details or private access", async () => {
  const projection = await fetch(`${origin}/v1/placements?status=open&format=motion_15s`);
  assert.equal(projection.status, 200);
  const rows = (await projection.json()) as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0] ?? {}).sort(), ["format", "id", "reserve_url", "status", "window"]);
  assert.equal(rows[0]?.format, "motion_15s");
  const privateResponse = await fetch(
    `${origin}/api/marketplace/placements?hostId=${randomUUID()}`,
  );
  assert.notEqual(privateResponse.status, 200);
});