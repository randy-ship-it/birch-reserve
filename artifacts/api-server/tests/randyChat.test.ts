import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import randyChatRouter, { BIRCH_SITE_SCOPE_PROMPT } from "../src/routes/randyChat";
import {
  loadVoiceCloserSystemPrompt,
  resolveVoiceCloserKnowledgeDir,
} from "../src/lib/voiceCloserKnowledge";

let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;
const prevDisabled = process.env["RANDY_CHAT_AI_DISABLED"];
const prevXai = process.env["XAI_API_KEY"];
const prevGrok = process.env["GROK_API_KEY"];

before(async () => {
  process.env["RANDY_CHAT_AI_DISABLED"] = "true";
  delete process.env["XAI_API_KEY"];
  delete process.env["GROK_API_KEY"];

  // Mount only the Randy router — avoid full app Clerk middleware in this box.
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", randyChatRouter);

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
  if (prevDisabled === undefined) delete process.env["RANDY_CHAT_AI_DISABLED"];
  else process.env["RANDY_CHAT_AI_DISABLED"] = prevDisabled;
  if (prevXai === undefined) delete process.env["XAI_API_KEY"];
  else process.env["XAI_API_KEY"] = prevXai;
  if (prevGrok === undefined) delete process.env["GROK_API_KEY"];
  else process.env["GROK_API_KEY"] = prevGrok;
});

test("vendored voice-closer knowledge loads", () => {
  const dir = resolveVoiceCloserKnowledgeDir();
  assert.ok(dir, "knowledge dir should resolve");
  const prompt = loadVoiceCloserSystemPrompt(true);
  assert.match(prompt, /FILE: SYSTEM-PROMPT\.md/);
  assert.match(prompt, /NEVER-SAY|hold-190|Hold \$190/i);
  assert.doesNotMatch(prompt, /xai-[a-z0-9]{20,}/i);
});

test("randy-chat returns 503 when AI disabled", async () => {
  const response = await fetch(`${baseUrl}/launch/randy-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "What is Hold 190?" }],
      mode: "chat",
    }),
  });
  assert.equal(response.status, 503);
  const body = (await response.json()) as {
    disabled?: boolean;
    source?: string;
    error?: string;
  };
  assert.equal(body.disabled, true);
  assert.equal(body.source, "disabled");
  assert.ok(body.error);
});

test("randy-chat rejects oversized messages", async () => {
  const response = await fetch(`${baseUrl}/launch/randy-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "x".repeat(2000) }],
    }),
  });
  assert.equal(response.status, 400);
});

test("randy-chat rejects unknown fields", async () => {
  const response = await fetch(`${baseUrl}/launch/randy-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hello" }],
      apiKey: "should-not-be-accepted",
    }),
  });
  assert.equal(response.status, 400);
});

test("randy-chat site scope is Birch Reserve only", () => {
  assert.match(BIRCH_SITE_SCOPE_PROMPT, /Birch Reserve only/);
  assert.match(BIRCH_SITE_SCOPE_PROMPT, /Never pitch the portfolio/);
  assert.match(BIRCH_SITE_SCOPE_PROMPT, /physio\.drhonow\.com/);
  assert.doesNotMatch(BIRCH_SITE_SCOPE_PROMPT, /899|50\s*MM/i);
});

test("randy-chat accepts Birch chips and rejects old portfolio chips", async () => {
  const ok = await fetch(`${baseUrl}/launch/randy-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "How seats work" }],
      chipId: "how_seats",
    }),
  });
  assert.equal(ok.status, 503); // valid body; AI disabled in test
  const bad = await fetch(`${baseUrl}/launch/randy-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Scale" }],
      chipId: "scale_providers",
    }),
  });
  assert.equal(bad.status, 400);
});
