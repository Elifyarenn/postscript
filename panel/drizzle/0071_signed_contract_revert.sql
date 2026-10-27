-- An admin may take a verification back to review (D-378): approved may become
-- pending again, and only together with clearing who reviewed it and when, so
-- a stray status write is still refused. Every other decision stays final
-- (D-349); the original verification and its revert stay in audit_log.
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
  -- A decision is final, but a verification may go back to review with its reviewer cleared
  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'approved' AND NEW.status = 'pending'
              AND NEW.reviewed_at IS NULL AND NEW.reviewed_by IS NULL) THEN
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
