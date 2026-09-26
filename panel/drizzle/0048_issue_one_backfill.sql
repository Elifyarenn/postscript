-- D-261: every article belongs to an issue. The articles written before issues
-- had topic and delivery windows carry no issue; they all belong to the first
-- one. Runs before the next migration makes articles.issue_id NOT NULL.
--
-- Idempotent and non-destructive: issue 1 is created only when articles need
-- it and it does not exist yet (the live database already has it), and only
-- articles without an issue are touched. Status, content, author, dates and
-- updated_at stay as they were; soft-deleted articles are attached too, since
-- the column will not accept a gap.
INSERT INTO "issues" ("number", "title", "status")
SELECT 1, 'Sayı 1', 'planning'
WHERE EXISTS (SELECT 1 FROM "articles" WHERE "issue_id" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "issues" WHERE "number" = 1 AND "deleted_at" IS NULL);
--> statement-breakpoint
UPDATE "articles"
   SET "issue_id" = (
     SELECT "id" FROM "issues"
      WHERE "number" = 1 AND "deleted_at" IS NULL
      ORDER BY "created_at"
      LIMIT 1
   )
 WHERE "issue_id" IS NULL;
