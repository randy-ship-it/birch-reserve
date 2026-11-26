/**
 * Rapid pulse check (Randy, Nov 26 2026 3:43 PM ET): a compact card on /agencies (and the /fit alias) where an agency
 * leaves an email and a couple of sentences about their client base. Randy answers the first ten by hand: there is NO
 * automated email to the submitter and no model assessment.
 *
 * Storage: every submission is one row in `rapid_pulse_checks` (Postgres, created on first use). The Google Sheet
 * "Rapid pulse check – agency intake" is fed from that table through the Drive connector (the repo has no Google
 * credentials): GET /v1/pulse-check/export lists unsynced rows, scripts/pulse-check-sync.mjs turns them into sheet rows,
 * POST /v1/pulse-check/export/ack marks them synced.
 */
import { randomBytes } from "node:crypto";

export type PulseRow = {
  id: number;
  ref: string;
  createdAt: Date;
  email: string;
  blurb: string;
  sourceSite: string;
  page: string;
  country: string;
  userAgent: string;
  status: string;
  isTest: boolean;
  friday: string;
  alert: string;
  syncedAt: Date | null;
};

export type PulseInsert = Omit<PulseRow, "id" | "createdAt" | "syncedAt">;

export interface PulseStore {
  insert(row: PulseInsert): Promise<PulseRow>;
  /** True when this address already submitted in the last `windowMs` (the throttle's per-address rule). */
  recentForEmail(email: string, windowMs: number): Promise<boolean>;
  listUnsynced(limit: number): Promise<PulseRow[]>;
  ack(refs: string[]): Promise<number>;
  update(ref: string, patch: Partial<Pick<PulseRow, "friday" | "alert">>): Promise<void>;
}

export const PULSE_EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
export const PULSE_BLURB_MIN = 15;
export const PULSE_BLURB_MAX = 1500;
export const PULSE_PER_EMAIL_WINDOW_MS = 60 * 60_000;

// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
export const cleanText = (v: unknown, max: number): string => String(v ?? "").replace(CTRL, "").trim().slice(0, max);

/** Only same-site paths; anything else is stored as /agencies. */
export function cleanPage(raw: unknown): string {
  const p = cleanText(raw, 200).split(/[?#]/)[0] ?? "";
  return /^\/[A-Za-z0-9/_-]*$/.test(p) ? p : "/agencies";
}

export function newPulseRef(now = Date.now()): string {
  return `pc-${now.toString(36)}-${randomBytes(3).toString("hex")}`;
}

/** TEST brand/blurb, a qa+ address or the explicit flag skip the CRM (the team alert still goes out, tagged [TEST]). */
export function isPulseTest(email: string, blurb: string, flag: unknown): boolean {
  return flag === true || /^\s*TEST\b/.test(blurb) || /^qa\+/i.test(email);
}

/** One sheet row, in the sheet's column order. Timestamp is Toronto time. Cells are stored literally (parseInput false). */
export function sheetRowOf(r: PulseRow): Array<string> {
  const ts = r.createdAt.toLocaleString("sv-SE", { timeZone: "America/Toronto" }).replace("T", " ");
  return [ts, r.email, r.blurb, r.sourceSite, r.page, r.country, r.userAgent, r.status, r.ref];
}

export class MemoryPulseStore implements PulseStore {
  rows: PulseRow[] = [];
  private seq = 0;
  async insert(row: PulseInsert) {
    const r: PulseRow = { ...row, id: ++this.seq, createdAt: new Date(), syncedAt: null };
    this.rows.push(r);
    return r;
  }
  async recentForEmail(email: string, windowMs: number) {
    return this.rows.some((r) => r.email === email && Date.now() - r.createdAt.getTime() < windowMs);
  }
  async listUnsynced(limit: number) {
    return this.rows.filter((r) => !r.syncedAt).slice(0, limit);
  }
  async ack(refs: string[]) {
    let n = 0;
    for (const r of this.rows) if (refs.includes(r.ref) && !r.syncedAt) { r.syncedAt = new Date(); n++; }
    return n;
  }
  async update(ref: string, patch: Partial<Pick<PulseRow, "friday" | "alert">>) {
    const r = this.rows.find((x) => x.ref === ref);
    if (r) Object.assign(r, patch);
  }
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS rapid_pulse_checks (
  id bigserial PRIMARY KEY,
  ref text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  blurb text NOT NULL,
  source_site text NOT NULL DEFAULT '',
  page text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  is_test boolean NOT NULL DEFAULT false,
  friday text NOT NULL DEFAULT '',
  alert text NOT NULL DEFAULT '',
  synced_at timestamptz
)`,
  `CREATE INDEX IF NOT EXISTS rapid_pulse_checks_email_idx ON rapid_pulse_checks (email, created_at)`,
];

type Raw = Record<string, unknown>;
const toRow = (r: Raw): PulseRow => ({
  id: Number(r["id"]), ref: String(r["ref"]), createdAt: new Date(String(r["created_at"])), email: String(r["email"]), blurb: String(r["blurb"]),
  sourceSite: String(r["source_site"]), page: String(r["page"]), country: String(r["country"]), userAgent: String(r["user_agent"]), status: String(r["status"]),
  isTest: r["is_test"] === true, friday: String(r["friday"]), alert: String(r["alert"]), syncedAt: r["synced_at"] ? new Date(String(r["synced_at"])) : null,
});

export class PgPulseStore implements PulseStore {
  private ensured: Promise<void> | null = null;
  private async db() {
    const m = await import("@workspace/db");
    this.ensured ??= (async () => { for (const s of DDL) await m.pool.query(s); })().catch((e) => { this.ensured = null; throw e; });
    await this.ensured;
    return m.pool;
  }
  async insert(row: PulseInsert) {
    const pool = await this.db();
    const res = await pool.query(
      `INSERT INTO rapid_pulse_checks (ref, email, blurb, source_site, page, country, user_agent, status, is_test, friday, alert)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [row.ref, row.email, row.blurb, row.sourceSite, row.page, row.country, row.userAgent, row.status, row.isTest, row.friday, row.alert],
    );
    return toRow(res.rows[0] as Raw);
  }
  async recentForEmail(email: string, windowMs: number) {
    const pool = await this.db();
    const res = await pool.query(`SELECT 1 FROM rapid_pulse_checks WHERE email = $1 AND created_at > now() - ($2::bigint * interval '1 millisecond') LIMIT 1`, [email, Math.round(windowMs)]);
    return res.rows.length > 0;
  }
  async listUnsynced(limit: number) {
    const pool = await this.db();
    const res = await pool.query(`SELECT * FROM rapid_pulse_checks WHERE synced_at IS NULL ORDER BY id ASC LIMIT $1`, [limit]);
    return res.rows.map((r: unknown) => toRow(r as Raw));
  }
  async ack(refs: string[]) {
    if (!refs.length) return 0;
    const pool = await this.db();
    const res = await pool.query(`UPDATE rapid_pulse_checks SET synced_at = now() WHERE ref = ANY($1::text[]) AND synced_at IS NULL`, [refs]);
    return res.rowCount ?? 0;
  }
  async update(ref: string, patch: Partial<Pick<PulseRow, "friday" | "alert">>) {
    const pool = await this.db();
    await pool.query(`UPDATE rapid_pulse_checks SET friday = COALESCE($2, friday), alert = COALESCE($3, alert) WHERE ref = $1`, [ref, patch.friday ?? null, patch.alert ?? null]);
  }
}
