import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEditorialModelInput,
  validateEditorialModelOutput,
} from "../src/lib/editorialDrafting";

const sourceId = "00000000-0000-4000-8000-000000000001";

test("editorial model input contains only selected sources and approved public context", () => {
  const input = buildEditorialModelInput(
    [{ id: sourceId, canonicalUrl: "https://example.org/source", publisher: "Publisher", title: "Source title", excerpt: "A public source excerpt." }],
    [{ name: "style", content: "Use cautious language." }],
    "Privacy-first audiences",
  );
  const serialized = JSON.stringify(input);
  assert.match(serialized, /selectedSources/);
  assert.doesNotMatch(serialized, /advertiser|email|clerk|payment|credential|transcript/i);
});

test("editorial output rejects unselected citations and unsupported promises", () => {
  const base = { title: "A sufficiently specific editorial title", summary: "A sufficiently detailed evidence-led editorial summary.", body: "A".repeat(220), sourceIds: [sourceId] };
  assert.deepEqual(validateEditorialModelOutput(base, [sourceId]), base);
  assert.throws(() => validateEditorialModelOutput({ ...base, sourceIds: ["00000000-0000-4000-8000-000000000002"] }, [sourceId]));
  assert.throws(() => validateEditorialModelOutput({ ...base, body: `${base.body} This will increase outcomes.` }, [sourceId]));
});
