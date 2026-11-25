import { pilotWaitlistEntriesTable } from "@workspace/db";

type RefreshedDatabaseField =
  typeof pilotWaitlistEntriesTable.$inferSelect["typecheckRefreshFixture"];

const refreshedDatabaseField: RefreshedDatabaseField = null;
void refreshedDatabaseField;
