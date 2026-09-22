-- AlterEnum
ALTER TYPE "CustodyEventType" ADD VALUE 'received';

-- AlterTable
ALTER TABLE "dispatches" ADD COLUMN     "results_returned_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "assay_results" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "sample_id" UUID NOT NULL,
    "analyte" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "below_detection" BOOLEAN NOT NULL DEFAULT false,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assay_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assay_results_dispatch_id_idx" ON "assay_results"("dispatch_id");

-- CreateIndex
CREATE INDEX "assay_results_sample_id_idx" ON "assay_results"("sample_id");

-- AddForeignKey
ALTER TABLE "assay_results" ADD CONSTRAINT "assay_results_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assay_results" ADD CONSTRAINT "assay_results_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;
