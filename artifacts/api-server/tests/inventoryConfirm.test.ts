import test from "node:test";
import assert from "node:assert/strict";
import { buildTamAccessConfirmation } from "../src/routes/inventoryNotify";

test("TAM access confirmation is a fixed template without the access code", () => {
  const m = buildTamAccessConfirmation("Emma <script>QA", "tam-acc-0123456789ab");
  assert.equal(m.subject, "We received your Scale Health TAM access request");
  assert.match(m.text, /^Hi Emma,/);
  assert.match(m.text, /We'll review your request and send your access code shortly\./);
  assert.match(m.text, /Ref: tam-acc-0123456789ab/);
  assert.doesNotMatch(m.text + m.html, /Gwen|<script/i);
});

test("bad refs are dropped and test mode is labelled", () => {
  const m = buildTamAccessConfirmation("", "https://evil.example/x", true);
  assert.match(m.subject, /^\[TEST\] /);
  assert.match(m.text, /^Hi there,/);
  assert.doesNotMatch(m.text + m.html, /evil/);
});
