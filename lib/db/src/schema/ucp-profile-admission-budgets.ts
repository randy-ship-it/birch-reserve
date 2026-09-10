import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ucpProfileAdmissionBudgetsTable = pgTable(
  "ucp_profile_admission_budgets",
  {
    clientKey: text("client_key").primaryKey(),
    tokens: doublePrecision("tokens").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("ucp_profile_admission_budgets_updated_at_idx").on(table.updatedAt),
  ],
);