import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to check marketplace integrity.");
}

const safetyCategoryPrefixes = [
  "one-impression-budget-",
  "reservation-release-",
  "category-exclusivity-",
  "signed-reporting-",
  "duplicate-event-id-",
  "campaign-revocation-",
  "advertiser-revocation-",
  "placement-revocation-",
  "host-revocation-",
] as const;

const pool = new pg.Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query("BEGIN");

  const { rows: relations } = await client.query<{
    campaigns: string | null;
    advertisers: string | null;
  }>(`
    SELECT
      to_regclass('public.marketplace_campaigns')::text AS campaigns,
      to_regclass('public.marketplace_advertisers')::text AS advertisers
  `);

  if (!relations[0]?.campaigns || !relations[0]?.advertisers) {
    console.log(
      "Marketplace campaign integrity check skipped until marketplace tables exist.",
    );
    await client.query("COMMIT");
    process.exitCode = 0;
  } else {
    const { rows: orphans } = await client.query<{
      id: string;
      name: string;
      category: string;
    }>(`
    SELECT campaign.id, campaign.name, campaign.category
    FROM marketplace_campaigns AS campaign
    LEFT JOIN marketplace_advertisers AS advertiser
      ON advertiser.id = campaign.advertiser_id
    WHERE advertiser.id IS NULL
    FOR UPDATE OF campaign
  `);

    const unsafeOrphans = orphans.filter(
      (campaign) =>
        !campaign.name.startsWith("Safety campaign ") ||
        !safetyCategoryPrefixes.some((prefix) =>
          campaign.category.startsWith(prefix),
        ),
    );

    if (unsafeOrphans.length > 0) {
      throw new Error(
        `Marketplace integrity check found ${unsafeOrphans.length} orphan campaign(s) that do not match synthetic safety fixtures. Repair them manually before pushing the schema. Campaign IDs: ${unsafeOrphans
          .map((campaign) => campaign.id)
          .join(", ")}`,
      );
    }

    const orphanIds = orphans.map((campaign) => campaign.id);
    if (orphanIds.length > 0) {
      await client.query(
        `DELETE FROM marketplace_delivery_events WHERE campaign_id = ANY($1::uuid[])`,
        [orphanIds],
      );
      await client.query(
        `DELETE FROM marketplace_category_locks WHERE campaign_id = ANY($1::uuid[])`,
        [orphanIds],
      );
      await client.query(
        `DELETE FROM marketplace_deliveries WHERE campaign_id = ANY($1::uuid[])`,
        [orphanIds],
      );
      await client.query(
        `DELETE FROM marketplace_campaigns WHERE id = ANY($1::uuid[])`,
        [orphanIds],
      );
      console.log(
        `Removed ${orphanIds.length} orphan marketplace safety campaign fixture(s).`,
      );
    } else {
      console.log("Marketplace campaign integrity check passed.");
    }

    await client.query("COMMIT");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
