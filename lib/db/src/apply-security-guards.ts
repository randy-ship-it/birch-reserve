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
} finally {
  await pool.end();
}