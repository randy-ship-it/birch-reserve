import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to apply database security guards.");
}

const pool = new pg.Pool({ connectionString });

try {
  await pool.query(`
    CREATE OR REPLACE FUNCTION prevent_advertiser_intake_review_event_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'advertiser intake review events are immutable'
        USING ERRCODE = '55000';
    END;
    $$;

    DROP TRIGGER IF EXISTS advertiser_intake_review_events_immutable
      ON advertiser_intake_review_events;

    CREATE TRIGGER advertiser_intake_review_events_immutable
      BEFORE UPDATE OR DELETE ON advertiser_intake_review_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_advertiser_intake_review_event_mutation();

    CREATE OR REPLACE FUNCTION prevent_sales_staff_access_event_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'sales staff access events are immutable'
        USING ERRCODE = '55000';
    END;
    $$;

    DROP TRIGGER IF EXISTS sales_staff_access_events_immutable
      ON sales_staff_access_events;

    CREATE TRIGGER sales_staff_access_events_immutable
      BEFORE UPDATE OR DELETE ON sales_staff_access_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_sales_staff_access_event_mutation();

    CREATE OR REPLACE FUNCTION prevent_editorial_audit_event_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'editorial audit events are immutable' USING ERRCODE = '55000';
    END; $$;
    DROP TRIGGER IF EXISTS editorial_audit_events_immutable ON editorial_audit_events;
    CREATE TRIGGER editorial_audit_events_immutable BEFORE UPDATE OR DELETE
      ON editorial_audit_events FOR EACH ROW
      EXECUTE FUNCTION prevent_editorial_audit_event_mutation();
  `);

  // Published insights must not keep the legacy $899 hero. Idempotent: rows
  // that no longer match the WHERE clause are left untouched.
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.editorial_articles') IS NULL THEN
        RETURN;
      END IF;

      UPDATE editorial_articles
      SET
        body = replace(
          body,
          'The first Display Reserve is deliberately concrete: a fixed $899 USD reservation for eight seats, with a media credit and a final insertion order.',
          'Public offers are Hold $190 for a seven-day category look that does not consume one of the eight seats, or Reserve $490 for a named category seat in the eight-pool. Both amounts are media credit, and the insertion order names the surface before anything runs.'
        ),
        updated_at = now()
      WHERE status = 'published'
        AND body LIKE '%$899 USD reservation%';

      UPDATE editorial_articles
      SET
        body = replace(replace(replace(body, 'reserve-899', 'reserve-490'), '$899 USD', 'Hold $190 or Reserve $490'), '$899', 'Hold $190 or Reserve $490'),
        summary = replace(replace(replace(summary, 'reserve-899', 'reserve-490'), '$899 USD', 'Hold $190 or Reserve $490'), '$899', 'Hold $190 or Reserve $490'),
        updated_at = now()
      WHERE status = 'published'
        AND (
          body LIKE '%$899%'
          OR summary LIKE '%$899%'
          OR body LIKE '%reserve-899%'
          OR summary LIKE '%reserve-899%'
        );
    END $$;
  `);
} finally {
  await pool.end();
}