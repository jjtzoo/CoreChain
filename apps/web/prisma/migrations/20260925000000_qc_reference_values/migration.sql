-- CreateEnum
CREATE TYPE "QcReferenceKind" AS ENUM ('standard', 'blank');

-- CreateTable
CREATE TABLE "qc_reference_values" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "QcReferenceKind" NOT NULL,
    "reference" TEXT NOT NULL,
    "analyte" TEXT NOT NULL,
    "unit" TEXT,
    "expected_value" DOUBLE PRECISION,
    "standard_deviation" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qc_reference_values_pkey" PRIMARY KEY ("id")
);

-- One line per team, kind, name and element, ignoring case.
CREATE UNIQUE INDEX "qc_reference_values_org_kind_ref_analyte_key"
  ON "qc_reference_values" ("organization_id", "kind", lower("reference"), lower("analyte"));
