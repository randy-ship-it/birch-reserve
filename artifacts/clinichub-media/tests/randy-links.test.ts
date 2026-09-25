import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeRandyLinks, safeLinkHref, labelForHref } from "../src/lib/randy-links.ts";

const links = (s: string) => tokenizeRandyLinks(s).filter((t) => t.kind === "link");
const visible = (s: string) => tokenizeRandyLinks(s).map((t) => (t.kind === "text" ? t.text : t.label)).join("");

test("markdown [label](url) renders the label, keeps the href, opens in a new tab", () => {
  const [l] = links("See [the DR-HO hub](https://physio.drhonow.com/dr-ho/portal) now.");
  assert.equal(l.kind, "link");
  if (l.kind !== "link") return;
  assert.equal(l.label, "the DR-HO hub");
  assert.equal(l.href, "https://physio.drhonow.com/dr-ho/portal");
  assert.equal(l.external, true);
  assert.equal(visible("See [the DR-HO hub](https://physio.drhonow.com/dr-ho/portal) now."), "See the DR-HO hub now.");
});

test("bare URLs never show as raw text: known label or bare host", () => {
  const v = visible("Here’s a live hub: https://physio.drhonow.com/dr-ho/portal That’s it.");
  assert.equal(v, "Here’s a live hub: the live DR-HO hub That’s it.");
  assert.doesNotMatch(v, /https?:|drhonow\.com\/dr-ho/);
  assert.equal(visible("Try https://www.example.org/a/b?c=1."), "Try example.org.");
  assert.equal(visible("Go to scalehealth.ca/clinichubs"), "Go to Scale Health clinic hubs");
  assert.equal(visible("(https://example.com/x)"), "(example.com)");
});

test("markdown whose label is itself a URL gets a short label", () => {
  assert.equal(visible("[https://physio.drhonow.com/dr-ho/portal](https://physio.drhonow.com/dr-ho/portal)"), "the live DR-HO hub");
});

test("only http/https/tel/mailto are linkable; unsafe schemes are dropped to text", () => {
  assert.equal(safeLinkHref("javascript:alert(1)"), null);
  assert.equal(safeLinkHref("data:text/html,<b>x</b>"), null);
  assert.equal(safeLinkHref("https://user:pw@evil.com"), null);
  assert.equal(links("[click](javascript:alert(1))").length, 0);
  assert.equal(visible("[click](javascript:alert(1))"), "click");
  assert.equal(links("[x](vbscript:msgbox)").length, 0);
  const tel = links("Call tel:+16479316278 anytime")[0];
  assert.ok(tel && tel.kind === "link");
  if (tel.kind === "link") {
    assert.equal(tel.href, "tel:+16479316278");
    assert.equal(tel.label, "+1 (647) 931-6278");
    assert.equal(tel.external, false);
  }
  const mail = links("[Email Randy](mailto:randy@example.com)")[0];
  assert.ok(mail && mail.kind === "link" && mail.label === "Email Randy");
});

test("HTML in replies stays inert text (React renders it as text)", () => {
  const toks = tokenizeRandyLinks('<img src=x onerror=alert(1)> [<b>hi</b>](https://example.com)');
  const link = toks.find((t) => t.kind === "link");
  assert.ok(link && link.kind === "link");
  if (link.kind === "link") assert.equal(link.label, "<b>hi</b>"); // rendered as a text node, not markup
  assert.equal(toks[0].kind, "text");
});

test("emails are not mangled into host links", () => {
  assert.equal(links("email me at qa@acme.com").length, 0);
  assert.equal(visible("email me at qa@acme.com"), "email me at qa@acme.com");
});

test("calendar links are flagged for gating", () => {
  const [l] = links("Pick a time: https://cal.com/randy/15min");
  assert.ok(l && l.kind === "link" && l.calendar && l.label === "Randy's calendar");
  assert.equal(labelForHref("https://unknown.example.com/very/long"), "unknown.example.com");
});
