import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGENCY_EXAMPLES, AGENCY_FAQ, AGENCY_SHARE, BRAND_BONUS_LINE, GOAL_PLAN, PLAIN_TERMS, INVENTORY_LINE, SELL_ASSUMPTION_LINE, SELL_ASSUMPTION_PCT, SPEC_ROWS } from "../src/lib/overhaul/agencyShowcase";
import { AGENCY_CASH_PCT, agencyCash } from "../src/lib/overhaul/mediaKit";
import { AGENCY, DEPOSIT_TIERS, SURFACES } from "../src/lib/overhaul/model";
import { OVERHAUL_ROUTES, llmsTxt } from "../src/lib/overhaul/seo";

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");

test("agency cut: 10% of media spend, paid in cash to the agency of record (Randy 8:14 PM ET)", () => {
  assert.equal(AGENCY_SHARE.pct, 10);
  assert.equal(AGENCY_CASH_PCT, AGENCY.commissionPct);
  assert.match(AGENCY_SHARE.line, /10% of media spend, paid in cash/);
  assert.match(AGENCY_SHARE.line, /agency of record/);
  assert.equal(AGENCY_SHARE.timing, "Paid to the agency of record per the IO.");
  assert.deepEqual(AGENCY_EXAMPLES.map((e) => [e.spend, e.cash]), [[490, 49], [25000, 2500]]);
  assert.equal(agencyCash(25000), 2500);
  assert.equal(agencyCash(50000), 5000);
});

test("/agencies: 10% paid in cash; client tests start on the $190 / $490 USD offers", () => {
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  assert.match(page, /10% of media spend, paid in cash to the agency of record/);
  assert.doesNotMatch(page, /\$1,500|\$3,000|\$6,000|SLOT_LADDER/);
  assert.match(page, /<BuyPaths /); // Nov 24: card vs IO compare, now folded under "The details"
  assert.equal(AGENCY.line, "10% of media spend, paid in cash to the agency of record.");
  assert.match(AGENCY.bonusNote, /\$190 USD/);
  assert.match(AGENCY.bonusNote, /\$490 USD/);
});

test("brand pages lead with the $190 / $490 USD offers, not the old deposit ladder", () => {
  const brands = read("../clinichub-media/src/pages/br/advertise-brands.tsx");
  assert.doesNotMatch(brands, /\$1,500|\$3,000|\$6,000|SlotLadder/);
  assert.match(brands, /StarterOffers/);
  void BRAND_BONUS_LINE; void DEPOSIT_TIERS;
});

test("spec sheet: four placements at the published starting CPMs, Post-Purchase is Inquire", () => {
  assert.equal(SPEC_ROWS.length, 4);
  for (const r of SPEC_ROWS) assert.equal(r.cpmFloorUsd, SURFACES.find((s) => s.key === r.key)!.cpmUsd);
  assert.deepEqual(SPEC_ROWS.filter((r) => r.inquire).map((r) => r.key), ["post_purchase"]);
});

test("20% sell assumption is labelled an assumption; no unverified order or partner counts (Nov 16 2026)", () => {
  assert.equal(SELL_ASSUMPTION_PCT, 20);
  assert.match(SELL_ASSUMPTION_LINE, /assumption/i);
  assert.doesNotMatch(INVENTORY_LINE, /20MM|8\.7|listed partners|Scale Health hubs/);
});

test("quick-buy preselects Hub Home, matching the server and /buycalc default", () => {
  assert.match(read("../clinichub-media/src/components/br/quick-buy.tsx"), /QUICK_BUY_DEFAULT_PLACEMENT: PlacementKey = "hub_home"/);
});

test("copy scan: agency sections, home and media kit carry no banned or retired wording", () => {
  const files = [
    "../clinichub-media/src/components/br/agency-showcase.tsx",
    "../clinichub-media/src/pages/br/home.tsx",
    "../clinichub-media/src/pages/br/media-kit.tsx",
    "../clinichub-media/src/pages/br/agencies.tsx",
    "./src/lib/overhaul/agencyShowcase.ts",
    "./src/lib/overhaul/mediaKit.ts",
    "./src/lib/overhaul/seo.ts",
  ].map(read).join("\n");
  for (const re of [/Scale Health Connect/i, /Clairvoyant/i, /\bAlign\b/, /8\.7\s?(mm|M)\b/i, /gross profit/i, /\bCIM\b/, /10\s*[–-]\s*12/, /\b12%/, /exclusive (category )?seat/i, /AGENCY_CREDIT_PCT|agencyCredit/, /Placeholder:/]) {
    assert.doesNotMatch(files, re, String(re));
  }
  const agencyOnly = ["../clinichub-media/src/components/br/agency-showcase.tsx", "./src/lib/overhaul/agencyShowcase.ts"].map(read).join("\n");
  assert.doesNotMatch(agencyOnly, /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/);
  assert.doesNotMatch(agencyOnly, /fridayapp|cockpit/i);
  assert.doesNotMatch(agencyOnly, /keeps?[^.\n]{0,30}as media credit/i);
  // Nov 14 2026: broad network positioning; the reserve CTA shows the buyer-currency price.
  assert.match(files, /Reserve your space — \{price\.seat\}/);
  assert.doesNotMatch(files, /8 categories|8 self-serve seats|Eight categories/);
  assert.doesNotMatch(files, /\$490[^.\n]{0,40}(lock(s|ed)? (the|your) category|exclusive)/i);
});

test("/agencies (Nov 16 2026, rebuilt Nov 24): fast lock path, brokers folded into the agency tier, USD-only, shared detail blocks", () => {
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  // Fast paths: self-serve reserve on the existing checkout, look + IO inside the card-or-IO fold.
  assert.match(page, /RESERVE_HREF/);
  assert.match(page, /lookHref\("agencies_paths_look"\)/);
  // Brokers & resellers: same agency-of-record terms (agency tier copy), no new commission number.
  assert.match(page, /Exclusive partner bids, client tests and broker lists all come here/);
  assert.doesNotMatch(page, /\b(5|8|12|15|20)% (broker|referral|finder)/i);
  // No invented deadlines, countdowns or seat counts.
  assert.doesNotMatch(page, /\d+ (seats?|spots?|placements?) (left|remaining|open)/i);
  assert.doesNotMatch(page, /only \d+ left|countdown|ends (today|tonight)|Dec(ember)? 31/i);
  // USD only until the CAD checkout is tested (Randy, Nov 16 2026).
  assert.doesNotMatch(page, /\bCAD\b|t\.cad/);
  // Reuses the shared spec sheet, IO steps and payout table (folded).
  for (const c of ["<InventorySpec />", "<IoProcess />", "<AgencyPayouts />"]) assert.ok(page.includes(c), c);
});

test("plan by goal (Nov 17 2026): four goals map to the four spec-sheet placements at the published starting rates, no claims", () => {
  assert.deepEqual(GOAL_PLAN.map((g) => g.key), ["awareness", "consideration", "conversion", "loyalty"]);
  assert.deepEqual(new Set(GOAL_PLAN.map((g) => g.placement)), new Set(SPEC_ROWS.map((r) => r.key)));
  for (const g of GOAL_PLAN) {
    const row = SPEC_ROWS.find((r) => r.key === g.placement)!;
    assert.equal(g.cpmFloorUsd, row.cpmFloorUsd, g.key);
    assert.equal(g.cpcFloorUsd, row.cpcFloorUsd, g.key);
    assert.equal(g.inquire, row.inquire, g.key);
    assert.match(g.measure, /^(Views|Clicks|UTM visits|promo-code redemptions|and| )+$/i, g.key);
    assert.doesNotMatch(g.brief + g.measure, /guarantee|lift|CTR|\d+%|\bsigned partners?\b|Align|Clairvoyant|Kalaya/i, g.key);
  }
  assert.equal(GOAL_PLAN.find((g) => g.key === "conversion")!.buy, "Insertion order (inquire)");
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  assert.match(page, /id="plan-by-goal"/);
  assert.match(page, /<GoalPlanner \/>/);
  assert.match(read("../clinichub-media/src/components/br/agency-showcase.tsx"), /Starting rates are illustrative planning estimates, not a quote/);
});

test("in plain terms (Nov 18 2026): five category answers, published terms only, one server-side FAQPage on /agencies", () => {
  assert.deepEqual(PLAIN_TERMS.map((t) => t.key), ["what", "moment", "data", "report", "start"]);
  const text = PLAIN_TERMS.map((t) => t.q + " " + t.a).join("\n");
  // Restates published terms only: the two USD offers, the 14-day refund window, aggregate reporting.
  assert.match(text, /\$190 USD 7-day look/);
  assert.match(text, /\$490 USD reserve/);
  assert.match(text, /fully refundable until 14 days before the launch date/);
  assert.match(text, /Never names, contact details or health information/);
  // No counts, claims, guarantees, banned names or CAD.
  assert.doesNotMatch(text, /guarantee|lift|CTR|\b\d+MM\b|million|listed partners|\bsigned partners?\b|Align\b|Clairvoyant|Kalaya|80 locations|we sell them customers|\bCAD\b/i);
  // Only the four published placements.
  for (const s of ["post-purchase", "hub home page", "product and services pages", "member dashboard"]) assert.match(text, new RegExp(s, "i"), s);
  const meta = OVERHAUL_ROUTES["/agencies"].jsonld as { "@graph": Array<Record<string, unknown>> };
  const faqs = meta["@graph"].filter((n) => n["@type"] === "FAQPage");
  assert.equal(faqs.length, 1);
  assert.equal((faqs[0].mainEntity as unknown[]).length, PLAIN_TERMS.length + AGENCY_FAQ.length);
  assert.ok(meta["@graph"].some((n) => n["@type"] === "Service"));
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  assert.match(page, /id="plain-terms"/);
  assert.match(page, /<PlainTerms \/>/);
  // The client FAQ does not emit a second FAQPage.
  assert.match(page, /<Faq items=\{AGENCY_FAQ\} schema=\{false\} \/>/);
  assert.match(llmsTxt(), /agencies#plain-terms/);
});

test("home (Nov 18 2026): one FAQPage for the page, not two", () => {
  const home = read("../clinichub-media/src/pages/br/home.tsx");
  assert.match(home, /<TrustFaq schema=\{false\} \/>/);
  assert.match(home, /<Faq items=\{FAQ\} schema=\{false\} \/>/);
  assert.equal((home.match(/"FAQPage"/g) ?? []).length, 1);
  assert.match(home, /\[\.\.\.TRUST_FAQ, \.\.\.FAQ\]/);
});

test("start small (Nov 19 2026): $190 / $490 / starter block / $1K–$5K agency tiers, refundable deposit, no zero-demand or exclusive wording", async () => {
  const { startSmallHtml, START_SMALL_BLOCK_USD } = await import("../src/lib/startSmallHtml");
  const html = startSmallHtml();
  for (const k of ["look", "seat", "block", "agency"]) assert.match(html, new RegExp(`data-testid="start-small-${k}"`));
  assert.match(html, /Start small from \$190\. Fully refundable deposit\./);
  assert.match(html, /\$190 USD/); assert.match(html, /\$490 USD/); assert.match(html, /\$1K–\$5K USD/);
  assert.equal(START_SMALL_BLOCK_USD, 400);
  assert.match(html, /data-pick-sku="hold-190"/); assert.match(html, /data-pick-sku="reserve-490"/);
  assert.equal((html.match(/Deposit collected at confirmation/g) ?? []).length, 2);
  assert.match(html, /<details><summary>Refund terms<\/summary>/);
  const src = read("../clinichub-media/src/components/br/start-small.tsx");
  for (const t of [html, src]) {
    assert.doesNotMatch(t, /exclusiv|not taken|\bavailable\b|\bopen\b|\b0 (purchases|holds|signed)\b|guarantee(d)? (views|impressions)|CTR|ROAS|\bCAD\b|Friday|\bAlign\b|Clairvoyant|80 locations|10\s*[–-]\s*12|\b12%/i);
  }
  // Home stays condensed (#163, Randy t226u); its cards link to /intake, where the two-lane reserve lives.
  for (const p of ["audiences", "media-kit"]) {
    assert.match(read(`../clinichub-media/src/pages/br/${p}.tsx`), new RegExp(`<StartSmall page="${p}"`));
  }
  assert.doesNotMatch(read("../clinichub-media/src/pages/br/audiences.tsx"), /<Eyebrow>Start now<\/Eyebrow>/);
  // Nov 24 (t543u): /agencies drops the start-small tiers; its three tier cards are the one offer block.
  assert.doesNotMatch(read("../clinichub-media/src/pages/br/agencies.tsx"), /<StartSmall /);
});

test("Nov 23: /agencies payout table pays 10% of the seat price actually shown (CAD $690 -> $69, not $49)", async () => {
  const { agencyPayoutRows } = await import("../src/lib/overhaul/agencyShowcase");
  const cad = agencyPayoutRows(690, "CAD");
  assert.deepEqual(cad.map((r) => r.key), ["seat", "client_test", "premium"]);
  assert.equal(cad[0]!.label, "$690 CAD reserve (card)");
  assert.equal(cad[0]!.cash, "$69");
  assert.equal(cad[1]!.spend, "$1K–$5K");
  assert.equal(cad[1]!.cash, "$100–$500");
  assert.equal(cad[2]!.cash, "$2,500");
  const usd = agencyPayoutRows(490, "USD");
  assert.equal(usd[0]!.label, "$490 USD reserve (card)");
  assert.equal(usd[0]!.cash, "$49");
  const ui = read("../clinichub-media/src/components/br/agency-showcase.tsx");
  assert.match(ui, /agencyPayoutRows\(priceFor\("reserve-490"/);
  assert.match(ui, /data-currency-fixed data-testid="agency-payout-table"/);
});

test("Nov 24: /agencies leads with two ways to buy (card vs insertion order), published terms only", async () => {
  const { BUY_PATHS } = await import("../src/lib/overhaul/agencyShowcase");
  assert.deepEqual(BUY_PATHS.rows.map((r) => r.k), ["Best for", "Pay", "Before it runs", "Refunds", "Agency cash"]);
  assert.equal(BUY_PATHS.io.price, "$1K–$5K USD");
  assert.match(BUY_PATHS.io.kicker, /^Insertion order \(IO\)/);
  const text = JSON.stringify(BUY_PATHS);
  for (const t of ["$190 USD", "$490 USD", "10% of media spend", "14 days before launch", "Deposit collected at confirmation", "Stripe-hosted"]) assert.ok(text.includes(t), t);
  assert.doesNotMatch(text, /guarantee|CTR|ROAS|lift|\bCAD\b|signed partners?|Align\b|Clairvoyant|Kalaya|80 locations|call|minutes|hours|today only|left\b/i);
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  // Nov 24 PM (t543u): the compare moved into "The details", after the tiers; still one block, no duplicate offers.
  assert.ok(page.indexOf('id="two-ways-to-buy"') > page.indexOf('id="tiers"'));
  assert.match(page, /<BuyPaths reserveHref=\{RESERVE_HREF\} lookHref=\{lookHref\("agencies_paths_look"\)\} \/>/);
  assert.doesNotMatch(page, /Same two offers as brands/);
});

test("Nov 24 PM (Randy t543u): /agencies is one canister, three tiers, Randy's exact numbers, no call CTA", async () => {
  const { AGENCY_TIERS, EXCLUSIVE_PARTNER_DISCOUNT, EXCLUSIVE_PARTNER_PERKS } = await import("../src/lib/overhaul/agencyShowcase");
  const { TRACK_RECORD } = await import("../src/lib/overhaul/trackRecord");
  assert.deepEqual(AGENCY_TIERS.map((t) => t.key), ["direct", "agency", "exclusive"]);
  const [direct, agency, exclusive] = AGENCY_TIERS;
  assert.equal(direct!.pay, "List price");
  assert.equal(agency!.pay, "List price");
  assert.equal(agency!.keep, "10% of media spend, paid in cash");
  assert.deepEqual(EXCLUSIVE_PARTNER_DISCOUNT, { lo: 10, hi: 25 });
  assert.equal(exclusive!.pay, "10–25% off list price");
  assert.equal(exclusive!.keep, "10% of spend");
  assert.equal(EXCLUSIVE_PARTNER_PERKS.length, 4);
  const ui = read("../clinichub-media/src/components/br/agency-showcase.tsx");
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  // List price = the live ladder (no new prices); the example is the existing nameless track-record card.
  assert.match(ui, /priceLadder\("usd"\)/);
  assert.match(ui, /TRACK_RECORD\.cards\.find\(\(c\) => c\.key === "partner-launch"\)/);
  assert.ok(TRACK_RECORD.cards.some((c) => c.key === "partner-launch"));
  for (const c of ["<InventoryCanister />", "<AgencyTierCards ", "<ExclusivePerks />"]) assert.ok(page.includes(c), c);
  // One primary hero CTA, before the canister.
  const hero = page.slice(page.indexOf("<H1>"), page.indexOf('id="tiers"'));
  assert.equal((hero.match(/<Cta /g) ?? []).length, 1);
  // Exclusive partners ask for a bid on the existing form; never a phone call or a chat with Randy.
  assert.match(ui, /Send a bid or interest/);
  const all = page + ui + JSON.stringify({ AGENCY_TIERS, EXCLUSIVE_PARTNER_PERKS });
  assert.doesNotMatch(all, /book a call|phone|tel:|talk to (the founder|randy)|chat with randy|schedule a call/i);
  assert.doesNotMatch(all, /MedVibe|Kalaya|Clairvoyant|Alset|\bAlign\b|80 locations|pier ?39|Ankita|Friday/i);
  assert.doesNotMatch(JSON.stringify({ AGENCY_TIERS, EXCLUSIVE_PARTNER_PERKS }), /guarantee|CTR|ROAS|reach|\d+ (views|clicks)/i);
  // Home: a visible agencies door next to the $190/$490 strip and in the hero; the lime Buy ads now stays primary.
  const home = read("../clinichub-media/src/pages/br/home.tsx");
  assert.match(home, /data-testid="home-strip-agencies"/);
  assert.match(home, /data-testid="home-cta-agencies"/);
  assert.match(home, /<BuyCta placement="hero_home"/);
});

test("Nov 24 1:53 PM (Randy): home partner section says 'Exclusive inventory partners' and 10–25% off list, same as /agencies; no blended effective figure", () => {
  const tap = read("../clinichub-media/src/components/br/trusted-agency-partners.tsx");
  const home = read("../clinichub-media/src/pages/br/home.tsx");
  // Name and numbers come from the /agencies tier data, not a second copy.
  assert.match(tap, /AGENCY_TIERS\.find\(\(t\) => t\.key === "exclusive"\)/);
  assert.match(tap, /EXCLUSIVE\.pay/);
  assert.match(tap, /EXCLUSIVE\.keep/);
  assert.match(tap, /Exclusive inventory partner/);
  assert.match(tap, /within 10–25% off list price/);
  assert.doesNotMatch(tap + home, /Trusted Agency Partner|10–20%|20–30%|Effective/);
  assert.doesNotMatch(tap, /trusted-agency-partner-badge\.svg/); // the old badge image said "Birch Reserve" on the Scale skin too
  assert.match(home, /Exclusive inventory partners get 10–25% off list price\./);
});
