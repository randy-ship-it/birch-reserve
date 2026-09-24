import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, test } from "node:test";
import {
  legacyReserveCopyPatch,
  mentionsLegacyHeroPrice,
  SCALE_HUBS_ARTICLE,
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

  const untouched = "Agent-led advertising needs a receipt, not a price.";
  assert.equal(legacyReserveCopyPatch(untouched, untouched), null);

  const summary = "A practical model for cross-promoting relevant brands after a purchase or booking.";
  const body = `${LIVE_LEGACY_SENTENCE} Payments are currently paused, so this article is not an active checkout promise.`;
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
  assert.deepEqual(inserts, [SCALE_HUBS_ARTICLE.slug]);
  assert.equal(rows[0]?.slug, "trusted-context-loop-curated-private-network");
  assert.equal(mentionsLegacyHeroPrice(rows[0]?.body ?? ""), false);
  assert.equal(rows[1]?.body, untouched);

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
  assert.match(home, /cta_custom_onprem/);
  assert.match(concierge, /cta_book_call/);
  assert.match(layout, /nav_insights/);
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

after(() => {
  setUiEventRecorderForTests(null);
  resetUiEventRateLimitForTests();
});
