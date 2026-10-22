-- Evidence rows that prove what was signed, licensed or published may no longer
-- be rewritten or removed by a mistake or a manual edit (D-349). The service
-- layer already keeps to these rules; the database now refuses too, as it has
-- for audit_log and role_changes since 0001. Columns a foreign key clears with
-- ON DELETE SET NULL, and the working columns the flows still update, stay free.

-- Countersigned copies uploaded before the column existed: their hash was put in
-- the audit entry at upload, so it is taken from there, never re-derived from the
-- file — the file is what the daily check has to be able to doubt
UPDATE "signed_contracts" AS sc
   SET "countersigned_sha256" = (
     SELECT al."after"->>'sha256'
       FROM "audit_log" AS al
      WHERE al."entity_id" = sc."id"
        AND al."action" = 'signed_contract.countersigned'
        AND al."after"->>'countersignedMediaId' = sc."countersigned_media_id"::text
      ORDER BY al."created_at" DESC
      LIMIT 1)
 WHERE sc."countersigned_media_id" IS NOT NULL
   AND sc."countersigned_sha256" IS NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_signed_contracts() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'signed_contracts rows are evidence; DELETE is not permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.agreement_version_id IS DISTINCT FROM OLD.agreement_version_id
     OR NEW.contributor_document_id IS DISTINCT FROM OLD.contributor_document_id
     OR NEW.file_media_id IS DISTINCT FROM OLD.file_media_id
     OR NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
     OR NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at THEN
    RAISE EXCEPTION 'signed_contracts: the uploaded file and whose it is cannot change'
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- A decision is final; only a pending upload is decided
  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'signed_contracts: a % upload cannot become %', OLD.status, NEW.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- The countersigned copy may be replaced, never left without its hash
  IF NEW.countersigned_media_id IS NOT NULL AND NEW.countersigned_sha256 IS NULL
     AND NEW.countersigned_media_id IS DISTINCT FROM OLD.countersigned_media_id THEN
    RAISE EXCEPTION 'signed_contracts: a countersigned copy needs its sha256'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER signed_contracts_guard
  BEFORE UPDATE OR DELETE ON "signed_contracts"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_signed_contracts();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_rights_grants() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'pending' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'rights_grants: a % grant is evidence; DELETE is not permitted', OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Revoked and declined are where a grant ends; signed only goes on to revoked
  IF OLD.status IN ('revoked', 'declined') AND NEW.status IS DISTINCT FROM OLD.status
     OR OLD.status = 'signed' AND NEW.status NOT IN ('signed', 'revoked') THEN
    RAISE EXCEPTION 'rights_grants: a % grant cannot become %', OLD.status, NEW.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Once signed, what was licensed, by whom and under which contract is fixed
  IF OLD.status <> 'pending' AND (
       NEW.article_id IS DISTINCT FROM OLD.article_id
    OR NEW.grantor_id IS DISTINCT FROM OLD.grantor_id
    OR NEW.agreement_version_id IS DISTINCT FROM OLD.agreement_version_id
    OR NEW.byline_choice IS DISTINCT FROM OLD.byline_choice
    OR NEW.grant_type IS DISTINCT FROM OLD.grant_type
    OR NEW.right_adaptation IS DISTINCT FROM OLD.right_adaptation
    OR NEW.right_reproduction IS DISTINCT FROM OLD.right_reproduction
    OR NEW.right_distribution IS DISTINCT FROM OLD.right_distribution
    OR NEW.right_communication_to_public IS DISTINCT FROM OLD.right_communication_to_public
    OR NEW.channels IS DISTINCT FROM OLD.channels
    OR NEW.exclusivity_months IS DISTINCT FROM OLD.exclusivity_months
    OR NEW.territory IS DISTINCT FROM OLD.territory
    OR NEW.consideration IS DISTINCT FROM OLD.consideration
    OR NEW.commercial_use_included IS DISTINCT FROM OLD.commercial_use_included
    OR NEW.form_text_hash IS DISTINCT FROM OLD.form_text_hash
    OR NEW.accepted_body_markdown IS DISTINCT FROM OLD.accepted_body_markdown
    OR NEW.accepted_version IS DISTINCT FROM OLD.accepted_version
    OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
    OR NEW.signed_ip IS DISTINCT FROM OLD.signed_ip
    OR NEW.signed_user_agent IS DISTINCT FROM OLD.signed_user_agent
    OR NEW.form_pdf_media_id IS DISTINCT FROM OLD.form_pdf_media_id AND NEW.form_pdf_media_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'rights_grants: the terms of a % grant cannot change', OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER rights_grants_guard
  BEFORE UPDATE OR DELETE ON "rights_grants"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_rights_grants();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_agreement_acceptances() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'agreement_acceptances rows are evidence; DELETE is not permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Marking an acceptance as belonging to an old text is the one change it takes
  IF (to_jsonb(NEW) - 'superseded_at' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'superseded_at' - 'updated_at')
     OR OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    RAISE EXCEPTION 'agreement_acceptances: only superseded_at may be set, once'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER agreement_acceptances_guard
  BEFORE UPDATE OR DELETE ON "agreement_acceptances"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_agreement_acceptances();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_contributor_documents() RETURNS trigger AS $$
BEGIN
  -- An unsent document is still a draft; a mailed one is what its owner holds (D-314)
  IF OLD.mailed_at IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'contributor_documents: a mailed document cannot be deleted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.mailed_at IS DISTINCT FROM OLD.mailed_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.agreement_version_id IS DISTINCT FROM OLD.agreement_version_id
     OR NEW.rendered_markdown IS DISTINCT FROM OLD.rendered_markdown
     OR NEW.text_hash IS DISTINCT FROM OLD.text_hash
     OR NEW.work_content_hash IS DISTINCT FROM OLD.work_content_hash
     OR NEW.template_version IS DISTINCT FROM OLD.template_version THEN
    RAISE EXCEPTION 'contributor_documents: the text of a mailed document cannot change'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER contributor_documents_guard
  BEFORE UPDATE OR DELETE ON "contributor_documents"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_contributor_documents();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_contributor_document_works() RETURNS trigger AS $$
DECLARE
  parent_mailed timestamptz;
BEGIN
  SELECT mailed_at INTO parent_mailed FROM contributor_documents WHERE id = OLD.document_id;
  IF parent_mailed IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'contributor_document_works: the works of a mailed document are fixed'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER contributor_document_works_guard
  BEFORE UPDATE OR DELETE ON "contributor_document_works"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_contributor_document_works();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_article_versions() RETURNS trigger AS $$
BEGIN
  -- 5187: the version history is kept until legal advice says otherwise
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'article_versions is append-only; DELETE is not permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Deleting a user clears changed_by (ON DELETE SET NULL); nothing else moves
  IF (to_jsonb(NEW) - 'changed_by' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'changed_by' - 'updated_at')
     OR NEW.changed_by IS NOT NULL AND NEW.changed_by IS DISTINCT FROM OLD.changed_by THEN
    RAISE EXCEPTION 'article_versions is append-only; UPDATE is not permitted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER article_versions_guard
  BEFORE UPDATE OR DELETE ON "article_versions"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_article_versions();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION postscript_guard_agreement_versions() RETURNS trigger AS $$
BEGIN
  -- A text someone has signed on paper is that text for good
  IF (NEW.body_markdown IS DISTINCT FROM OLD.body_markdown OR NEW.body_hash IS DISTINCT FROM OLD.body_hash)
     AND EXISTS (SELECT 1 FROM signed_contracts WHERE agreement_version_id = OLD.id) THEN
    RAISE EXCEPTION 'agreement_versions: a version with signed uploads cannot change its text'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER agreement_versions_guard
  BEFORE UPDATE ON "agreement_versions"
  FOR EACH ROW EXECUTE FUNCTION postscript_guard_agreement_versions();
