-- Undoes migrations 0064 (countersigned_sha256) and 0065 (evidence_guards), D-349/D-350.
-- Not a drizzle migration and never run automatically. Order matters:
--   1. deploy the code from before step 263 first (it reads countersigned_sha256),
--   2. take a Neon snapshot,
--   3. run this file in one transaction,
--   4. check that `select count(*) from drizzle.__drizzle_migrations` dropped by 2.
-- No row data is lost: the column only repeats hashes the audit log already holds.

BEGIN;

DROP TRIGGER IF EXISTS signed_contracts_guard ON "signed_contracts";
DROP TRIGGER IF EXISTS rights_grants_guard ON "rights_grants";
DROP TRIGGER IF EXISTS agreement_acceptances_guard ON "agreement_acceptances";
DROP TRIGGER IF EXISTS contributor_documents_guard ON "contributor_documents";
DROP TRIGGER IF EXISTS contributor_document_works_guard ON "contributor_document_works";
DROP TRIGGER IF EXISTS article_versions_guard ON "article_versions";
DROP TRIGGER IF EXISTS agreement_versions_guard ON "agreement_versions";

DROP FUNCTION IF EXISTS postscript_guard_signed_contracts();
DROP FUNCTION IF EXISTS postscript_guard_rights_grants();
DROP FUNCTION IF EXISTS postscript_guard_agreement_acceptances();
DROP FUNCTION IF EXISTS postscript_guard_contributor_documents();
DROP FUNCTION IF EXISTS postscript_guard_contributor_document_works();
DROP FUNCTION IF EXISTS postscript_guard_article_versions();
DROP FUNCTION IF EXISTS postscript_guard_agreement_versions();

ALTER TABLE "signed_contracts" DROP COLUMN IF EXISTS "countersigned_sha256";

-- Drizzle decides by the journal's `when` stamps; forgetting the two newest rows
-- lets a later `db:migrate` apply 0064 and 0065 again
DELETE FROM drizzle.__drizzle_migrations
 WHERE id IN (SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 2);

COMMIT;
