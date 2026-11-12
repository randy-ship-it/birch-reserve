/**
 * BR-side seat ledger: the fallback availability source while Friday App has no
 * seat endpoint (see docs/SEATS-FRIDAY-CONTRACT.md). Friday stays the source of
 * truth: when GET {FRIDAY}/api/birch/seats answers, this file is ignored.
 *
 * Basis for "open" as of 2026-11-12: no advertiser has paid (Stripe live has no
 * Birch advertiser payments; the live webhook and Neon are off), and no seat is
 * confirmed under an insertion order. A seat moves to "held"/"locked" only when
 * Randy confirms it (Friday stage Hold $190 / Reserved $490), never on a form submit.
 *
 * Fail-safe: entries older than LEDGER_MAX_AGE_DAYS are treated as unknown and the
 * site shows "call to confirm" instead of a count. Ops can override without a code
 * change by setting SEAT_LEDGER_JSON (same shape) and redeploying.
 */
export type LedgerStatus = "open" | "held" | "locked";

export type SeatLedger = {
  as_of: string; // YYYY-MM-DD (America/Toronto)
  basis: string;
  seats: Record<string, { status: LedgerStatus; until?: string }>;
};

export const LEDGER_MAX_AGE_DAYS = 14;

export const SEAT_LEDGER: SeatLedger = {
  as_of: "2026-11-12",
  basis: "No paid or confirmed category seats on record (Birch Reserve, Nov 12 2026).",
  seats: {
    "pain-relief": { status: "open" },
    "recovery-hardware": { status: "open" },
    nutrition: { status: "open" },
    sleep: { status: "open" },
    "meal-prep": { status: "open" },
    "womens-health": { status: "open" },
    "mens-health": { status: "open" },
    "diagnostics-services": { status: "open" },
  },
};
