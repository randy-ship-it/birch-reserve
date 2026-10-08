import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, test } from "node:test";
import {
  legacyReserveCopyPatch,
  mentionsLegacyHeroPrice,
  rewriteAlignNetworkCopy,
  SCALE_HUBS_ARTICLE,
  SHELF_AFTER_RECEIPT_ARTICLE,
} from "../../../lib/db/src/public-insights-copy.ts";
import {
  seedPublicInsightsWithStore,
  type InsightsSeedStore,
  type PublishedInsightCopy,
} from "../../../lib/db/src/public-insights-seed.ts";
import app from "../src/app";
import {
  parseUiEvent,
  resetUiEventRateLimitForTests,
  setUiEventRecorderForTests,
  uiEventBurstLimited,
  type ParsedUiEvent,
} from "../src/lib/uiEvents";

const LIVE_LEGACY_SENTENCE =
  "The first Display Reserve is deliberately concrete: a fixed $899 USD reservation for eight seats, with a media credit and a final insertion order.";

test("published insights copy drops legacy $899 and inserts the Scale Health article once", async () => {
  assert.equal(mentionsLegacyHeroPrice(SCALE_HUBS_ARTICLE.title), false);
  assert.equal(mentionsLegacyHeroPrice(SCALE_HUBS_ARTICLE.summary), false);
  assert.equal(mentionsLegacyHeroPrice(SCALE_HUBS_ARTICLE.body), false);
  assert.match(SCALE_HUBS_ARTICLE.body, /Scale Health/);
  assert.match(SCALE_HUBS_ARTICLE.summary, /Hold \$190/);
  assert.match(SCALE_HUBS_ARTICLE.summary, /Reserve \$490/);
  assert.equal(SCALE_HUBS_ARTICLE.slug, "after-booking-category-seats-scale-hubs");
  assert.equal(SCALE_HUBS_ARTICLE.topic, "Closed-hub advertising");
  assert.equal(SCALE_HUBS_ARTICLE.authorName, "Birch Reserve Editorial");
  assert.equal(SCALE_HUBS_ARTICLE.publishedAt.toISOString(), "2026-09-24T16:00:00.000Z");
  assert.doesNotMatch(SCALE_HUBS_ARTICLE.body, /50MM|1MM unique|impression guarantee/i);

  assert.equal(SHELF_AFTER_RECEIPT_ARTICLE.slug, "the-shelf-after-the-receipt");
  assert.equal(SHELF_AFTER_RECEIPT_ARTICLE.title, "The shelf after the receipt");
  assert.equal(SHELF_AFTER_RECEIPT_ARTICLE.authorName, "Birch Reserve Editorial");
  assert.equal(SHELF_AFTER_RECEIPT_ARTICLE.topic, "Closed-hub advertising");
  assert.equal(
    SHELF_AFTER_RECEIPT_ARTICLE.publishedAt.toISOString(),
    "2026-09-27T16:00:00.000Z",
  );
  assert.match(SHELF_AFTER_RECEIPT_ARTICLE.summary, /media credit, not a flight that starts itself/);
  assert.match(SHELF_AFTER_RECEIPT_ARTICLE.body, /^# The shelf after the receipt\n/);
  assert.doesNotMatch(SHELF_AFTER_RECEIPT_ARTICLE.body, /\*\*Slug:\*\*|\*\*Summary:\*\*|\*\*Author:\*\*/);
  assert.match(SHELF_AFTER_RECEIPT_ARTICLE.body, /Nothing runs before step 2/);
  assert.equal(mentionsLegacyHeroPrice(SHELF_AFTER_RECEIPT_ARTICLE.title), false);
  assert.equal(mentionsLegacyHeroPrice(SHELF_AFTER_RECEIPT_ARTICLE.summary), false);
  assert.equal(mentionsLegacyHeroPrice(SHELF_AFTER_RECEIPT_ARTICLE.body), false);
  assert.doesNotMatch(SHELF_AFTER_RECEIPT_ARTICLE.body, /1MM|5MM|Align 80|payments paused|\$49 ICA/i);

  const untouched = "Agent-led advertising needs a receipt, not a price.";
  assert.equal(legacyReserveCopyPatch(untouched, untouched), null);

  const summary = "A practical model for cross-promoting relevant brands after a purchase or booking.";
  const body = `${LIVE_LEGACY_SENTENCE} Payments are currently paused, so this article is not an active checkout promise. describes virtual rehab embedded into clinic, studio, and wellness businesses [2].`;
  const patch = legacyReserveCopyPatch(summary, body);
  assert.ok(patch);
  assert.equal(patch.summary, summary);
  assert.equal(mentionsLegacyHeroPrice(patch.body), false);
  assert.match(patch.body, /Hold \$190/);
  assert.match(patch.body, /Reserve \$490/);
  assert.match(patch.body, /Payments are currently paused/);
  assert.doesNotMatch(patch.body, /\$899 USD reservation/);
  assert.doesNotMatch(patch.body, /\$899/);
  assert.equal(legacyReserveCopyPatch(patch.summary, patch.body), null);

  const phraseOnly = legacyReserveCopyPatch("summary", "Still selling a fixed $899\u00a0USD reservation.");
  assert.ok(phraseOnly);
  assert.doesNotMatch(phraseOnly.body, /\$899/);
  assert.match(phraseOnly.body, /Hold \$190 or Reserve \$490/);

  const fallback = legacyReserveCopyPatch("fine", "Do not hero 899 or sell reserve-899 at 899 USD.");
  assert.ok(fallback);
  assert.equal(mentionsLegacyHeroPrice(fallback.body), false);
  assert.match(fallback.body, /reserve-490/);
  assert.match(fallback.body, /Hold \$190 or Reserve \$490/);

  const rows: PublishedInsightCopy[] = [
    {
      id: "trusted",
      slug: "trusted-context-loop-curated-private-network",
      summary,
      body,
    },
    {
      id: "agent",
      slug: "agent-led-advertising-evidence-standards",
      summary: "What a buyer should require from an advertising agent.",
      body: untouched,
    },
  ];
  const updates: string[] = [];
  const inserts: string[] = [];
  const store: InsightsSeedStore = {
    async listPublished() {
      return rows.map((row) => ({ ...row }));
    },
    async updateCopy(id, copy) {
      updates.push(id);
      const row = rows.find((item) => item.id === id);
      assert.ok(row);
      row.summary = copy.summary;
      row.body = copy.body;
    },
    async insertPublishedIfMissing(article) {
      if (inserts.includes(article.slug) || rows.some((row) => row.slug === article.slug)) return false;
      inserts.push(article.slug);
      rows.push({
        id: "new",
        slug: article.slug,
        summary: article.summary,
        body: article.body,
      });
      return true;
    },
  };

  const first = await seedPublicInsightsWithStore(store);
  assert.deepEqual(first, { inserted: true, corrected: 1 });
  assert.deepEqual(updates, ["trusted"]);
  assert.deepEqual(inserts, [
    SCALE_HUBS_ARTICLE.slug,
    SHELF_AFTER_RECEIPT_ARTICLE.slug,
  ]);
  assert.equal(rows[0]?.slug, "trusted-context-loop-curated-private-network");
  assert.equal(mentionsLegacyHeroPrice(rows[0]?.body ?? ""), false);
  assert.match(rows[0]?.body ?? "", /embedded into health and wellness businesses \[2\]\./);
  assert.doesNotMatch(rows[0]?.body ?? "", /clinic, studio, and wellness/);
  assert.match(rows[0]?.body ?? "", /Payments are currently paused/);
  assert.equal(
    rewriteAlignNetworkCopy(
      "its own site describes virtual rehab embedded into clinic, studio, and wellness businesses [2]. That creates",
    ),
    "its own site describes virtual rehab embedded into health and wellness businesses [2]. That creates",
  );
  assert.equal(rows[1]?.body, untouched);
  assert.equal(rows[1]?.summary, "What a buyer should require from an advertising agent.");

  const second = await seedPublicInsightsWithStore(store);
  assert.deepEqual(second, { inserted: false, corrected: 0 });
  assert.equal(updates.length, 1);
});

test("POST /v1/ui-events allowlists CTA events and rejects unknown or oversized payloads", async () => {
  resetUiEventRateLimitForTests();
  const stored: ParsedUiEvent[] = [];
  setUiEventRecorderForTests(async (event) => {
    stored.push(event);
  });

  const server = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("listening", () => resolveReady());
    server.once("error", rejectReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const accepted = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_hold_190", path: "/", offer: "hold-190", locale: "en-US" }),
    });
    assert.equal(accepted.status, 204);
    assert.deepEqual(stored, [{ event: "cta_hold_190", path: "/", offer: "hold-190" }]);

    const reserve = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_reserve_490", path: "/insights/after-booking-category-seats-scale-hubs", offer: null }),
    });
    assert.equal(reserve.status, 204);
    assert.equal(stored[1]?.offer, null);
    assert.equal(stored[1]?.path, "/insights/after-booking-category-seats-scale-hubs");

    const unknown = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "page_view", path: "/" }),
    });
    assert.equal(unknown.status, 400);
    assert.equal(stored.length, 2);

    const pii = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "cta_book_call",
        path: "/",
        email: "person@example.com",
        phone: "555-0100",
        name: "Ada",
      }),
    });
    assert.equal(pii.status, 400);
    assert.equal(stored.length, 2);
    assert.doesNotMatch(JSON.stringify(stored), /person@example.com|555-0100/);

    const longPath = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_open_reserve", path: `/${"a".repeat(200)}` }),
    });
    assert.equal(longPath.status, 400);

    const queryPath = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_book_call", path: "/?email=person@example.com" }),
    });
    assert.equal(queryPath.status, 400);

    const oversized = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_hold_190", path: `/${"b".repeat(1800)}` }),
    });
    assert.equal(oversized.status, 413);
    assert.equal(stored.length, 2);

    setUiEventRecorderForTests(async () => {
      throw new Error("database unavailable");
    });
    const failedWrite = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "nav_insights", path: "/insights" }),
    });
    assert.equal(failedWrite.status, 204);

    resetUiEventRateLimitForTests(2);
    const firstBurst = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_book_call", path: "/" }),
    });
    const secondBurst = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_book_call", path: "/" }),
    });
    const thirdBurst = await fetch(`${origin}/v1/ui-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "cta_book_call", path: "/" }),
    });
    assert.equal(firstBurst.status, 204);
    assert.equal(secondBurst.status, 204);
    assert.equal(thirdBurst.status, 429);

    resetUiEventRateLimitForTests(3);
    assert.equal(uiEventBurstLimited(1_000), false);
    assert.equal(uiEventBurstLimited(1_000), false);
    assert.equal(uiEventBurstLimited(1_000), false);
    assert.equal(uiEventBurstLimited(1_000), true);
    assert.equal(uiEventBurstLimited(12_000), false);
  } finally {
    setUiEventRecorderForTests(null);
    resetUiEventRateLimitForTests();
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
});

test("marketing CTAs call the first-party helper and no third-party pixel", async () => {
  const root = resolve(process.cwd(), "..");
  const [home, concierge, layout, helper, editorial] = await Promise.all([
    readFile(resolve(root, "clinichub-media/src/pages/home.tsx"), "utf8"),
    readFile(resolve(root, "clinichub-media/src/components/sales-concierge.tsx"), "utf8"),
    readFile(resolve(root, "clinichub-media/src/components/layout.tsx"), "utf8"),
    readFile(resolve(root, "clinichub-media/src/lib/track-cta.ts"), "utf8"),
    readFile(resolve(process.cwd(), "src/routes/editorial.ts"), "utf8"),
  ]);
  const clientEvents = [...helper.matchAll(/"(cta_[a-z0-9_]+|nav_[a-z0-9_]+|buycalc_[a-z0-9_]+)"/g)].map((match) => match[1]);
  for (const event of ["cta_hero_reserve", "cta_hold_190", "cta_reserve_490", "cta_book_call", "nav_insights", "buycalc_open"]) {
    assert.equal(clientEvents.includes(event), true);
    assert.equal(parseUiEvent({ event, path: "/" })?.event, event);
  }
  assert.match(helper, /\/v1\/ui-events/);
  assert.match(helper, /sendBeacon/);
  assert.match(helper, /keepalive:\s*true/);
  assert.match(home, /cta_hero_reserve/);
  assert.match(home, /buycalc_open/);
  assert.match(home, /cta_book_call/);
  // cta_custom_onprem CTA was removed from home in #25 (Book a call CTAs dropped).
  assert.match(concierge, /cta_book_call/);
  assert.match(layout, /nav_insights/);
  assert.match(layout, /label: 'Ad Examples'/);
  assert.match(layout, /#placements/);
  assert.match(home, /id="placements"/);
  assert.match(home, /data-testid="three-steps"/);
  assert.match(home, /Nothing runs before step 2/);
  assert.match(home, /Claim an early slot on the Reserve List\. Paid reserves are 100% media credit\./);
  assert.match(home, /data-testid="reserve-list-hero"/);
  assert.match(home, /href=\{RESERVE_LIST_HREF\}/);
  assert.match(home, /See the Reserve List/);
  assert.match(home, /Early slots open in \$\{availability\.seats_open\} of \$\{availability\.seats_total\} categories/);
  assert.match(home, /No brand gets more than 20% of a category's digital real estate\./);
  assert.doesNotMatch(home, /Hold a category for 7 days — \$190/);
  assert.doesNotMatch(home, /One brand per aisle/);
  assert.match(home, /Insertion order names the hub\./);
  assert.match(home, /Unit sits after checkout, on a plan, or at a booking\./);
  assert.match(home, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.doesNotMatch(home, /\$899/);
  assert.doesNotMatch(home, /payments paused/i);
  assert.match(editorial, /const PUBLIC_SITE_ORIGIN = "https:\/\/birchreserve\.net"/);
  assert.doesNotMatch(editorial, /www\.birchreserve\.net/);
  const surfaces = `${home}\n${concierge}\n${layout}\n${helper}`;
  assert.doesNotMatch(surfaces, /googletagmanager|google-analytics|plausible|posthog|vercel\.com\/analytics|gtag\(/i);
  // Randy 2026-09-24: third-party analytics lives only in lib/analytics.ts and is env-gated
  // (VITE_PLAUSIBLE_DOMAIN / VITE_GA4_ID); no hard-coded property id or domain.
  const analytics = await readFile(resolve(root, "clinichub-media/src/lib/analytics.ts"), "utf8");
  assert.match(analytics, /VITE_PLAUSIBLE_DOMAIN/);
  assert.match(analytics, /VITE_GA4_ID/);
  assert.doesNotMatch(analytics, /G-[A-Z0-9]{6,}/);
  assert.doesNotMatch(analytics, /data-domain=["']birchreserve/);
});

const BRAND_TITLE = "Birch Reserve | The Reserve List · Scale Health demand, Canada";
const BRAND_DESCRIPTION =
  "See the Reserve List: a network demand pool of 8.7M purchase orders a year and 56M monthly views in Canada, plus an est. 20M+ more in the queue and 100M+ purchase orders a year (2027 projection). Early slots are open. Paid reserves are 100% media credit.";

test("public marketing title and description match the brand strings", async () => {
  const indexHtml = await readFile(
    resolve(process.cwd(), "../clinichub-media/index.html"),
    "utf8",
  );
  assert.ok(indexHtml.includes(`<title>${BRAND_TITLE}</title>`));
  for (const attr of [
    'name="description"',
    'property="og:description"',
    'name="twitter:description"',
  ]) {
    assert.ok(indexHtml.includes(`<meta ${attr} content="${BRAND_DESCRIPTION}" />`));
  }
  assert.ok(indexHtml.includes(`property="og:title" content="${BRAND_TITLE}"`));
  assert.ok(indexHtml.includes(`name="twitter:title" content="${BRAND_TITLE}"`));
  assert.doesNotMatch(indexHtml, /Eight category seats inside signed Scale Health hubs\./);
  assert.doesNotMatch(indexHtml, /\$899|payments paused/i);

  const buying = await readFile(resolve(process.cwd(), "src/routes/publicBuying.ts"), "utf8");
  assert.match(buying, /const PUBLIC_BRAND_DESCRIPTION =\s*\n\s*"\$190 holds a category 7 days\./);
  assert.doesNotMatch(buying, /\$490 holds a category seat inside signed Scale Health hubs/);
});

test("GET /oatmeal is a permanent redirect to /buycalc and keeps the query string", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("listening", () => resolveReady());
    server.once("error", rejectReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const withQuery = await fetch(`${origin}/oatmeal?sku=hold-190&format=post_checkout`, {
      redirect: "manual",
    });
    assert.equal(withQuery.status, 301);
    assert.equal(
      withQuery.headers.get("location"),
      "/buycalc?sku=hold-190&format=post_checkout",
    );
    const body = await withQuery.text();
    assert.doesNotMatch(body, /id="root"/);

    const bare = await fetch(`${origin}/oatmeal`, { redirect: "manual" });
    assert.equal(bare.status, 301);
    assert.equal(bare.headers.get("location"), "/buycalc");
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
});


test("GET /advertise is a permanent redirect to /buycalc and keeps the query string", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("listening", () => resolveReady());
    server.once("error", rejectReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const withQuery = await fetch(`${origin}/advertise?sku=hold-190&format=post_checkout`, {
      redirect: "manual",
    });
    assert.equal(withQuery.status, 301);
    assert.equal(
      withQuery.headers.get("location"),
      "/buycalc?sku=hold-190&format=post_checkout",
    );
    const body = await withQuery.text();
    assert.doesNotMatch(body, /id="root"/);

    const bare = await fetch(`${origin}/advertise`, { redirect: "manual" });
    assert.equal(bare.status, 301);
    assert.equal(bare.headers.get("location"), "/buycalc");
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
});


test("GET /availability.json aliases /v1/availability.json (same handler, not SPA)", async () => {
  const buying = await readFile(resolve(process.cwd(), "src/routes/publicBuying.ts"), "utf8");
  assert.match(buying, /router\.get\("\/availability\.json"/);
  assert.match(buying, /async function sendAvailabilityJson/);
  assert.match(
    buying,
    /router\.get\("\/availability\.json"[\s\S]*?await sendAvailabilityJson\(res\)/,
  );
  assert.match(
    buying,
    /router\.get\("\/v1\/availability\.json"[\s\S]*?await sendAvailabilityJson\(res\)/,
  );

  const server = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("listening", () => resolveReady());
    server.once("error", rejectReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const v1 = await fetch(`${origin}/v1/availability.json`);
    const alias = await fetch(`${origin}/availability.json`);
    // Without a live DB both may 500; they must still match each other and not be SPA HTML.
    assert.equal(alias.status, v1.status);
    const v1Text = await v1.text();
    const aliasText = await alias.text();
    assert.doesNotMatch(v1Text, /id="root"/);
    assert.doesNotMatch(aliasText, /id="root"/);
    if (v1.status === 200 && alias.status === 200) {
      assert.match(alias.headers.get("content-type") ?? "", /application\/json/);
      const v1Body = JSON.parse(v1Text) as Record<string, unknown>;
      const aliasBody = JSON.parse(aliasText) as Record<string, unknown>;
      assert.equal(typeof v1Body.seats_open, "number");
      assert.equal(typeof aliasBody.seats_open, "number");
      assert.equal(aliasBody.inventory_model, v1Body.inventory_model);
      assert.equal(aliasBody.default_sku, v1Body.default_sku);
      assert.deepEqual(aliasBody.formats, v1Body.formats);
    }
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
});

test("legal and insights routes return readable HTML instead of the SPA shell", async () => {
  const artifact = await readFile(
    resolve(process.cwd(), ".replit-artifact/artifact.toml"),
    "utf8",
  );
  for (const path of ["/terms", "/privacy", "/sample-io", "/kit", "/insights", "/advertise", "/availability.json"]) {
    assert.match(artifact, new RegExp(`"${path.replace("/", "\\/")}"`));
  }

  const server = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("listening", () => resolveReady());
    server.once("error", rejectReady);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const terms = await fetch(`${origin}/terms`);
    const termsHtml = await terms.text();
    assert.equal(terms.status, 200);
    assert.match(terms.headers.get("content-type") ?? "", /text\/html/);
    assert.match(termsHtml, /<h1>Terms of sale<\/h1>/);
    assert.match(termsHtml, /counsel stamps this page/);
    assert.match(termsHtml, /hold-190/);
    assert.match(termsHtml, /reserve-490/);
    assert.doesNotMatch(termsHtml, /id="root"/);
    assert.doesNotMatch(termsHtml, /\$899/);

    const privacy = await (await fetch(`${origin}/privacy`)).text();
    assert.match(privacy, /<h1>Privacy<\/h1>/);
    assert.match(privacy, /does not store full card numbers/);
    assert.match(privacy, /protected health information/);
    assert.doesNotMatch(privacy, /id="root"/);

    const sample = await (await fetch(`${origin}/sample-io`)).text();
    assert.match(sample, /<h1>Sample insertion order<\/h1>/);
    assert.match(sample, /not an approved insertion order/);
    assert.match(sample, /hold-190/);
    assert.doesNotMatch(sample, /id="root"/);
    assert.doesNotMatch(sample, /\$899/);

    const kit = await (await fetch(`${origin}/kit`)).text();
    assert.match(kit, /<h1>Creative brief for Birch Reserve placements<\/h1>/);
    assert.match(kit, /Square still/);
    assert.match(kit, /Pain relief \/ topicals/);
    assert.match(kit, /post_checkout/);
    assert.match(kit, /sales@silverbirchgrowth\.com/);
    assert.doesNotMatch(kit, /id="root"/);
    assert.doesNotMatch(kit, /\$899/);

    const insightsResponse = await fetch(`${origin}/insights`);
    const insights = await insightsResponse.text();
    assert.equal(insightsResponse.status, 200);
    assert.match(insights, /Insights &amp; Evidence/);
    assert.match(insights, /href="\/insights\/the-shelf-after-the-receipt"/);
    assert.match(insights, /The shelf after the receipt/);
    assert.doesNotMatch(insights, /id="root"/);
    assert.doesNotMatch(insights, /\$899/);

    const article = await (await fetch(`${origin}/insights/the-shelf-after-the-receipt`)).text();
    assert.match(article, /<h1>The shelf after the receipt<\/h1>/);
    assert.equal(article.match(/<h1>/g)?.length, 1);
    assert.match(article, /Nothing runs before step 2/);
    assert.doesNotMatch(article, /\*\*Slug:\*\*/);
    assert.doesNotMatch(article, /id="root"/);
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  }
});

after(() => {
  setUiEventRecorderForTests(null);
  resetUiEventRateLimitForTests();
});
