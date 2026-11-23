# Hub status ladder and "insertion order (IO)"

Randy, Nov 23 2026: one hub list on every page, and "insertion order (IO)" spelled out on first use.

- **Data:** `artifacts/api-server/src/lib/hubLadder.ts` is the only place hub names, tiers (Live now, Activating, and more launching),
  one-line audiences and hub page links live. React pages, server HTML (`hubLadderHtml.ts`), llms.txt, the `.md` copies, the chat
  knowledge and the agent catalog all read it. To change a hub's status, edit that one file.
- **Links:** a hub is linked only if it has a real page. Scale pages use `scaleHref` (always scalehealth.ca). Integrity Fitness is in the
  file with `public: false` (no hub page, and older rules keep the name off public pages); flip it to show it.
- **IO:** `lib/ioExplain.ts` is one browser script (React bundle + server pages via `middlewares/ioExplain.ts`). The first plain "IO" on a
  page becomes "insertion order (IO)" with a ? that opens the buyer explainer. Copy of the explainer: `IO_EXPLAINER`.
- **Blocks:** `components/br/hub-story.tsx` (OwnTheMoment, FourSteps, SeeTheProof). Mocks show Live now hubs only.
- Ad serving is untouched: `sponsorKit.ts` hub `status` ("Live inventory") still decides which slots serve.
