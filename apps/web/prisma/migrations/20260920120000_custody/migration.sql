-- CreateEnum
CREATE TYPE "CustodyEventType" AS ENUM ('bagged', 'sealed', 'handed_over', 'dispatched', 'correction');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('open', 'dispatched');

-- CreateTable
CREATE TABLE "custody_events" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "sample_id" UUID NOT NULL,
    "event_type" "CustodyEventType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "handled_by" TEXT NOT NULL,
    "location" TEXT,
    "recipient" TEXT,
    "note" TEXT,
    "dispatch_id" UUID,
    "corrects_event_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "dispatch_number" TEXT NOT NULL,
    "laboratory" TEXT NOT NULL,
    "preparation_request" TEXT,
    "handover_at" DATE,
    "status" "DispatchStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_samples" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "sample_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "dispatch_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custody_events_project_id_idx" ON "custody_events"("project_id");

-- CreateIndex
CREATE INDEX "custody_events_sample_id_idx" ON "custody_events"("sample_id");

-- CreateIndex
CREATE INDEX "dispatches_project_id_idx" ON "dispatches"("project_id");

-- CreateIndex
CREATE INDEX "dispatch_samples_project_id_idx" ON "dispatch_samples"("project_id");

-- CreateIndex
CREATE INDEX "dispatch_samples_dispatch_id_idx" ON "dispatch_samples"("dispatch_id");

-- CreateIndex
CREATE INDEX "dispatch_samples_sample_id_idx" ON "dispatch_samples"("sample_id");

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_samples" ADD CONSTRAINT "dispatch_samples_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_samples" ADD CONSTRAINT "dispatch_samples_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_samples" ADD CONSTRAINT "dispatch_samples_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

