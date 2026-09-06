-- Append-only guarantee for the two tables that exist to prove what happened
-- (DECISIONS.md D-015). The application layer already refuses to update or
-- delete these rows; this trigger makes a mistake or a manual edit fail too.

CREATE OR REPLACE FUNCTION postscript_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION postscript_block_mutation();
--> statement-breakpoint

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION postscript_block_mutation();
--> statement-breakpoint

CREATE TRIGGER role_changes_no_update
  BEFORE UPDATE ON "role_changes"
  FOR EACH ROW EXECUTE FUNCTION postscript_block_mutation();
--> statement-breakpoint

CREATE TRIGGER role_changes_no_delete
  BEFORE DELETE ON "role_changes"
  FOR EACH ROW EXECUTE FUNCTION postscript_block_mutation();
