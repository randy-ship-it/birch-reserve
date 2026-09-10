import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const ucpAgentRequestProofsTable = pgTable(
  "ucp_agent_request_proofs",
  {
    agentIdentityHash: text("agent_identity_hash").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "ucp_agent_request_proofs_identity_nonce",
      columns: [table.agentIdentityHash, table.nonceHash],
    }),
    index("ucp_agent_request_proofs_expiry").on(table.expiresAt),
  ],
);