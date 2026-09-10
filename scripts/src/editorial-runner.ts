import { createHash } from "node:crypto";
import {
  db, editorialArticlesTable, editorialArticleSourcesTable, editorialGenerationJobsTable,
  editorialSourcesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const authoritativeSources = [
  ["https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/tracking-and-ads/gl_ba_1112/", "Office of the Privacy Commissioner of Canada", "Guidelines on privacy and online behavioural advertising", "Government guidance", "2012", "Relevant to consent and meaningful choice in online behavioural advertising.", "Regulatory guidance, not an effectiveness study."],
  ["https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/tracking-and-ads/bg_ba_1206/", "Office of the Privacy Commissioner of Canada", "Policy position on online behavioural advertising", "Government policy position", "2012", "Relevant to privacy-protective advertising boundaries.", "Policy position, not a measure of consumer outcomes."],
  ["https://thecma.ca/docs/default-source/default-document-library/cma-2025-consumer-expectations-for-privacy-and-relevance-in-a-data-driven-world.pdf?sfvrsn=e254497b_3", "Canadian Marketing Association", "Consumer Expectations for Privacy and Relevance in a Data-Driven World", "Trade-association stakeholder survey", "April 2025", "Relevant stakeholder research on privacy and relevance expectations.", "Trade-association survey material; it is not independent population research."],
  ["https://link.springer.com/article/10.1186/s12966-017-0548-1", "International Journal of Behavioral Nutrition and Physical Activity", "A systematic review and meta-analyses of the impact of health-related claims on dietary choices", "Peer-reviewed systematic review and meta-analysis", "2017", "Relevant to how health-related claims can affect dietary choices.", "The review concerns dietary choices and should not be generalized to clinical outcomes or all wellness advertising."],
  ["https://www.ftc.gov/sites/default/files/documents/reports/consumer-perceptions-qualified-health-claims-advertising/wp277_0.pdf", "FTC Bureau of Economics", "Consumer Perceptions of Qualified Health Claims in Advertising, Working Paper 277", "Government working paper", "2005", "Relevant to consumer interpretation of qualified health claims.", "Working paper; its age and studied claim formats limit transfer to current channels."],
  ["https://www.cambridge.org/core/journals/proceedings-of-the-nutrition-society/article/healthier-swaps-evaluating-the-effects-of-instore-point-of-sale-messaging-to-encourage-choice-of-healthier-alternatives-to-popular-products/06B2F237D996FB539AE9C5F45C5AFB24", "Proceedings of the Nutrition Society", "Healthier swaps: evaluating the effects of in-store point of sale messaging", "Peer-reviewed conference proceedings", "2024", "Relevant to point-of-sale messaging in a specific retail choice context.", "Specific in-store setting; it does not establish health outcomes or broad advertising effects."],
  ["https://www.nber.org/system/files/working_papers/w19520/w19520.pdf", "National Bureau of Economic Research", "Measuring the Effects of Advertising: The Digital Frontier", "Research working paper", "2013", "Relevant to measurement challenges and experimental advertising evidence.", "Working paper and platform-era context; findings should not be treated as universal."],
  ["https://ideas.repec.org/a/inm/ormksc/v38y2019i2p193-225.html", "Marketing Science", "A Comparison of Approaches to Advertising Measurement: Evidence from Big Field Experiments at Facebook", "Peer-reviewed journal article", "2019", "Relevant comparison of measurement approaches using field experiments.", "Evidence comes from a particular platform and experiments, not every advertising context."],
  ["https://ideas.repec.org/a/inm/ormksc/v42y2023i4p768-793.html", "Marketing Science", "Close Enough? A Large-Scale Exploration of Non-Experimental Approaches to Advertising Measurement", "Peer-reviewed journal article", "2023", "Relevant to limitations of non-experimental measurement approaches.", "Specific methods and platform data constrain generalization."],
] as const;
const drafts = [
  ["privacy-first-audiences", "Privacy-first audiences begin with context, not surveillance", "A private working draft on contextual relevance, transparency, and why audience strategy can start without individual profiles.", 0, 3],
  ["health-wellness-advertising-context", "Health and wellness advertising needs a careful contextual boundary", "A private working draft on separating general wellness context from sensitive health inference and individualized targeting.", 3, 6],
  ["evidence-led-measurement", "Evidence-led measurement means describing what was observed", "A private working draft on defining measures, limitations, and uncertainty without turning directional evidence into promises.", 6, 9],
] as const;

function workingDraft(
  subject: string,
  sources: readonly (typeof authoritativeSources)[number][],
): string {
  const evidence = sources.map(([, publisher, title, evidenceType, date, relevance, limitations], index) =>
    `${index + 1}. **${title}** (${publisher}, ${date}; ${evidenceType}) is included because ${relevance.toLowerCase()} Its stated boundary matters here: ${limitations}`,
  ).join("\n\n");
  return `## Evidence

This is a private editorial working draft about ${subject}. It is not a campaign brief, legal advice, health advice, or a statement of expected performance. The evidence base is deliberately narrow: the citations below are the only sources selected for this draft. They support careful questions and bounded descriptions, not a claim that a particular tactic will produce a particular result. Editors should open the canonical records before publication and check that the surrounding context has not changed.

${evidence}

Taken together, these records establish different kinds of evidence rather than one combined proof. Regulatory material can identify a policy or consent boundary. A systematic review, working paper, proceedings paper, or journal article can describe a study design and its subject. Stakeholder research can report what its participants said. None of those categories should be rewritten as a universal finding. The source labels are retained so that an editor can see the difference before deciding what language belongs in a public article.

## Interpretation

For ${subject}, the useful editorial move is to begin with the decision that is actually in view. A reader may be choosing language, a context, a measurement plan, or a review step. The draft can explain that decision in ordinary terms and then point to the relevant source. It should not imply that a reader has been classified, that sensitive information has been inferred, or that a commercial outcome follows automatically. Context can be useful without becoming a proxy for a person, and a measurement plan can be informative without becoming a promise.

The proposed interpretation is therefore procedural. Describe what was observed, what the cited material addresses, and what remains outside the record. Where the source discusses choices or perceptions, say choices or perceptions. Where it discusses a framework or policy position, say framework or policy position. Where it compares methods, say comparison. This discipline makes the article less dramatic, but it also makes it easier for readers to distinguish evidence from a recommendation and a recommendation from an offer.

An advertiser or editor may reasonably want practical relevance. Relevance does not require a performance claim. A public explanation can say that careful context selection, clear qualifying language, transparent notice, or an experimental design may be worth considering, depending on the work at hand. It should also say that suitability, compliance, availability, and implementation are reviewed separately. The sources do not authorize claims about a person’s health, a customer’s intent, an audience’s identity, or a guaranteed effect.

## Limitations and counterarguments

A cautious reading has costs. It can feel less concise than a simple assertion, and it may leave a reader wanting a definitive answer. That is a valid counterargument: readers often need a next step, not only a list of caveats. The response is not to remove the caveats. It is to pair them with a clear question and a citation. The available sources concern particular jurisdictions, research settings, formats, time periods, or stakeholder populations. Their relevance is real, but it is bounded.

Another counterargument is that a source from an earlier period may not describe current interfaces or market practice. That is also fair. Earlier material can still explain a policy principle or a measurement problem, but it should not be presented as a current market forecast. Similarly, a peer-reviewed study may be rigorous without matching every setting, and a trade-association survey may be useful stakeholder research without representing the whole public. Editors should retain these distinctions rather than flatten them into a single evidence score.

The draft also does not resolve legal, clinical, or platform-specific questions. It does not substitute for counsel, ethics review, product review, or a private commercial discussion. If the intended public copy would make a claim beyond the cited record, the correct action is to narrow the copy, locate an additional approved public source, or omit the claim. No inference should be made from the absence of evidence in this draft.

## Practical questions for editors and advertisers

1. What exact statement does the proposed article make, and which selected source supports that statement?

2. Does the wording describe evidence, interpretation, or a recommendation? Can those categories be signalled clearly rather than blended together?

3. Are any health, identity, behavioural, or performance claims broader than the cited material? If so, can they be removed or qualified?

4. Does a reader need to know the source type, date, setting, or limitation to interpret the statement fairly?

5. Is the content genuinely public-facing, with no customer, member, patient, advertiser-intake, staff, credential, payment, or unpublished-plan data?

6. What would falsify or limit the interpretation, and is that limitation stated in language a non-specialist can understand?

7. Before publication, has a sales manager checked the citations, approved the final wording, and made the explicit human publication decision?

This draft remains private until those questions are answered. Its purpose is to make the editorial review concrete, not to automate approval or publication.`;
}

async function main() {
  const sourceIds: string[] = [];
  for (const [canonicalUrl, publisher, title, evidenceType, publicationDateLabel, relevance, limitations] of authoritativeSources) {
    const excerpt = `${relevance} Limitation: ${limitations}`;
    const contentHash = createHash("sha256").update(`${canonicalUrl}|${excerpt}`).digest("hex");
    const [source] = await db.insert(editorialSourcesTable).values({
      canonicalUrl, publisher, title, excerpt, evidenceType, publicationDateLabel, relevance, limitations,
      sourceType: evidenceType.includes("Government") ? "government" : "research", publicApproved: "approved", contentHash,
    }).onConflictDoNothing().returning({ id: editorialSourcesTable.id });
    const id = source?.id ?? (await db.select({ id: editorialSourcesTable.id }).from(editorialSourcesTable).where(eq(editorialSourcesTable.canonicalUrl, canonicalUrl)).limit(1))[0]?.id;
    if (!id) throw new Error("Authoritative source was not persisted.");
    sourceIds.push(id);
  }
  for (const [slug, title, summary, sourceStart, sourceEnd] of drafts) {
    const key = `seed:${slug}:v2`;
    const [job] = await db.insert(editorialGenerationJobsTable).values({
      idempotencyKey: key, status: "completed", topic: title, sourceIds: sourceIds.slice(sourceStart, sourceEnd), completedAt: new Date(),
    }).onConflictDoNothing().returning({ id: editorialGenerationJobsTable.id });
    if (!job) continue;
    const selectedSourceIds = sourceIds.slice(sourceStart, sourceEnd);
    const body = workingDraft(title, authoritativeSources.slice(sourceStart, sourceEnd));
    const [existing] = await db.select().from(editorialArticlesTable).where(eq(editorialArticlesTable.slug, slug)).limit(1);
    if (existing && existing.status !== "draft") continue;
    const [article] = existing
      ? await db.update(editorialArticlesTable).set({ title, summary, body, generationJobId: job.id }).where(eq(editorialArticlesTable.id, existing.id)).returning({ id: editorialArticlesTable.id })
      : await db.insert(editorialArticlesTable).values({ slug, title, summary, body, status: "draft", generationJobId: job.id }).returning({ id: editorialArticlesTable.id });
    if (article) {
      await db.delete(editorialArticleSourcesTable).where(eq(editorialArticleSourcesTable.articleId, article.id));
      await db.insert(editorialArticleSourcesTable).values(selectedSourceIds.map((sourceId) => ({ articleId: article.id, sourceId, citationLabel: "Authoritative public source" })));
    }
  }
}
await main();