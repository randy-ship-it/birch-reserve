/** /brand-kit: the hero path (Randy, Nov 18 2026 10:13 PM ET). view=brand on Friday. noindex while in preview. */
import { usePageMeta } from "@/components/br/ui";
import { ChannelTiles, MockBanner, RoleTabs } from "@/components/br/intake-kit";
import { KitBuilder } from "@/components/br/kit-builder";
import { CategoryCards, HubShots, PilotHero, ReportingBlock, ThreeSteps } from "@/components/br/pilot-path";

export default function BrBrandKit() {
  usePageMeta("Download your media kit | Birch Reserve", "Four numbers in, a two-sided media kit out: your revenue opportunity and your exposure opportunity. Estimates only.");
  return (
    <div data-testid="brand-kit-page">
      <MockBanner />
      <PilotHero headingLevel={1} />
      <KitBuilder showMockBanner={false} />
      <CategoryCards />
      <HubShots />
      <ReportingBlock />
      <ThreeSteps />
      <ChannelTiles />
      <RoleTabs />
    </div>
  );
}
