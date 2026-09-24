/**
 * Runtime safety net for the 6:50pm additive columns. Runs an
 * `ALTER TABLE IF EXISTS t ADD COLUMN IF NOT EXISTS c ...` statement only when the
 * column is actually missing, so a warm boot never takes an ALTER lock.
 */
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const STMT = /^ALTER TABLE IF EXISTS (\w+) ADD COLUMN IF NOT EXISTS (\w+) /i;

export function parseAdditiveColumn(stmt: string): { table: string; column: string } | null {
  const m = STMT.exec(stmt.trim());
  return m ? { table: m[1]!, column: m[2]! } : null;
}

export async function applyAdditiveColumns(pool: Queryable, stmts: readonly string[]): Promise<number> {
  const byTable = new Map<string, Array<{ column: string; stmt: string }>>();
  for (const stmt of stmts) {
    const p = parseAdditiveColumn(stmt);
    if (!p) throw new Error("applyAdditiveColumns only runs ADD COLUMN IF NOT EXISTS statements");
    byTable.set(p.table, [...(byTable.get(p.table) ?? []), { column: p.column, stmt }]);
  }
  let applied = 0;
  for (const [table, cols] of byTable) {
    const res = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
      [table],
    );
    const have = new Set((res.rows as Array<{ column_name: string }>).map((r) => r.column_name));
    if (have.size === 0) continue; // table not there (yet): nothing to add to
    for (const c of cols) {
      if (have.has(c.column)) continue;
      await pool.query(c.stmt);
      applied += 1;
    }
  }
  return applied;
}

export const SPLASH_HYGIENE_DDL = [
  "ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false",
] as const;
