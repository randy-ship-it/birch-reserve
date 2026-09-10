import {
  db,
  marketplaceCampaignsTable,
  marketplaceDeliveriesTable,
} from "@workspace/db";
import { and, eq, sql, type SQL } from "drizzle-orm";

export type MarketplaceTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function expireIssuedReservations(
  tx: MarketplaceTransaction,
  condition: SQL<unknown>,
): Promise<number> {
  const expired = await tx
    .update(marketplaceDeliveriesTable)
    .set({ status: "expired" })
    .where(
      and(
        eq(marketplaceDeliveriesTable.status, "issued"),
        condition,
      ),
    )
    .returning({
      campaignId: marketplaceDeliveriesTable.campaignId,
      reservedMilliCents:
        marketplaceDeliveriesTable.reservedMilliCents,
    });

  const releasedByCampaign = new Map<string, number>();
  for (const reservation of expired) {
    releasedByCampaign.set(
      reservation.campaignId,
      (releasedByCampaign.get(reservation.campaignId) ?? 0) +
        reservation.reservedMilliCents,
    );
  }

  for (const [campaignId, releasedMilliCents] of releasedByCampaign) {
    await tx
      .update(marketplaceCampaignsTable)
      .set({
        spentMilliCents: sql`greatest(0, ${marketplaceCampaignsTable.spentMilliCents} - ${releasedMilliCents})::integer`,
        spentCents: sql`greatest(0, (${marketplaceCampaignsTable.spentMilliCents} - ${releasedMilliCents}) / 1000)::integer`,
      })
      .where(eq(marketplaceCampaignsTable.id, campaignId));
  }

  return expired.length;
}