-- CreateEnum
CREATE TYPE "QaqcStage" AS ENUM ('core_logging', 'sampling_custody', 'laboratory_assays');

-- CreateEnum
CREATE TYPE "QaqcDecisionType" AS ENUM ('accept', 'hold', 'reject');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "qaqc_stage" "QaqcStage";

-- CreateTable
CREATE TABLE "qaqc_exception_resolutions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "exception_key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved_by" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qaqc_exception_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qaqc_review_decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "decision" "QaqcDecisionType" NOT NULL,
    "note" TEXT,
    "decided_by" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qaqc_review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qaqc_exception_resolutions_organization_id_exception_key_key" ON "qaqc_exception_resolutions"("organization_id", "exception_key");

-- CreateIndex
CREATE INDEX "qaqc_review_decisions_drillhole_id_idx" ON "qaqc_review_decisions"("drillhole_id");

-- AddForeignKey
ALTER TABLE "qaqc_review_decisions" ADD CONSTRAINT "qaqc_review_decisions_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
