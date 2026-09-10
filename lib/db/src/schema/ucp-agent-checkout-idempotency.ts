import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { splashAdReservationsTable } from "./splash-ad-reservations";

export const ucpAgentCheckoutIdempotencyTable = pgTable(
  "ucp_agent_checkout_idempotency",
  {
    agentIdentityHash: text("agent_identity_hash").notNull(),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => splashAdReservationsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "ucp_agent_checkout_idempotency_identity_key",
      columns: [table.agentIdentityHash, table.idempotencyKeyHash],
    }),
    index("ucp_agent_checkout_idempotency_reservation").on(
      table.reservationId,
    ),
  ],
);