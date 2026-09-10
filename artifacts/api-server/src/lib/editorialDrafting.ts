import { z } from "zod/v4";

export type ApprovedEditorialSource = {
  id: string; canonicalUrl: string; publisher: string; title: string; excerpt: string;
};
export type ApprovedEditorialContext = { name: string; content: string };

const modelOutput = z.object({
  title: z.string().min(12).max(180),
  summary: z.string().min(30).max(600),
  body: z.string().min(200).max(30_000),
  sourceIds: z.array(z.string().uuid()).min(1).max(12),
}).strict();

/** The sole model-input boundary. Do not add database queries here. */
export function buildEditorialModelInput(
  sources: ApprovedEditorialSource[],
  contexts: ApprovedEditorialContext[],
  topic: string,
) {
  return {
    task: "Write an evidence-led private editorial draft. Do not make claims unsupported by a supplied source. Avoid guarantees, health advice, and fabricated numbers. Cite source IDs in sourceIds.",
    topic,
    approvedPublicContext: contexts.map(({ name, content }) => ({ name, content })),
    selectedSources: sources.map(({ id, canonicalUrl, publisher, title, excerpt }) => ({ id, canonicalUrl, publisher, title, excerpt })),
  };
}

export function validateEditorialModelOutput(value: unknown, selectedSourceIds: string[]) {
  const parsed = modelOutput.parse(value);
  if (parsed.sourceIds.some((id) => !selectedSourceIds.includes(id))) {
    throw new Error("Model cited a source outside the selected editorial sources.");
  }
  if (/\b(guarantee|will increase|proven results)\b/i.test(`${parsed.summary} ${parsed.body}`)) {
    throw new Error("Model output contains unsupported or generic performance claims.");
  }
  return parsed;
}

/** Calls the configured Replit OpenAI integration only with the allowlisted payload. */
export async function requestEditorialDraft(
  sources: ApprovedEditorialSource[],
  contexts: ApprovedEditorialContext[],
  topic: string,
) {
  if (process.env["EDITORIAL_AI_DISABLED"] === "true") {
    throw new Error("Editorial AI is disabled by EDITORIAL_AI_DISABLED.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      max_completion_tokens: 2_000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: JSON.stringify(buildEditorialModelInput(sources, contexts, topic)) }],
    }, { signal: controller.signal });
    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error("Editorial model returned no content.");
    return validateEditorialModelOutput(JSON.parse(content), sources.map((source) => source.id));
  } finally {
    clearTimeout(timeout);
  }
}