-- Change register item 2: standards and blanks keep their history. Editing a
-- line adds a new revision and retires the old one; removing a line retires
-- it. Nothing is deleted, so the values behind an earlier QA/QC decision can
-- still be read.
ALTER TABLE "qc_reference_values"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "supersedes_id" TEXT,
  ADD COLUMN "change_reason" TEXT,
  ADD COLUMN "retired_at" TIMESTAMP(3),
  ADD COLUMN "retired_by" TEXT,
  ADD COLUMN "retire_reason" TEXT;

-- Each revision is replaced at most once.
CREATE UNIQUE INDEX "qc_reference_values_supersedes_id_key"
  ON "qc_reference_values" ("supersedes_id");

ALTER TABLE "qc_reference_values"
  ADD CONSTRAINT "qc_reference_values_supersedes_id_fkey"
  FOREIGN KEY ("supersedes_id") REFERENCES "qc_reference_values" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- One CURRENT line per team, kind, name and element, ignoring case; retired
-- revisions sit beside it.
DROP INDEX "qc_reference_values_org_kind_ref_analyte_key";
CREATE UNIQUE INDEX "qc_reference_values_org_kind_ref_analyte_key"
  ON "qc_reference_values" ("organization_id", "kind", lower("reference"), lower("analyte"))
  WHERE "retired_at" IS NULL;

-- A resolved exception keeps the hole, summary and evidence it was resolved
-- on, including the certified value or limit used at the time.
ALTER TABLE "qaqc_exception_resolutions"
  ADD COLUMN "drillhole_id" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "evidence" TEXT;

-- A hole's accept, hold or reject decision keeps the reviewer's stage and the
-- exceptions open for that hole when it was made.
ALTER TABLE "qaqc_review_decisions"
  ADD COLUMN "stage" TEXT,
  ADD COLUMN "evidence" JSONB;
