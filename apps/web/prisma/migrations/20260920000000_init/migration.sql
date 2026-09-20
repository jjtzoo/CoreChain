-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CollarSource" AS ENUM ('gps', 'manual');

-- CreateEnum
CREATE TYPE "DrillholeStatus" AS ENUM ('planned', 'drilling', 'complete', 'logged');

-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('primary', 'standard', 'blank', 'duplicate');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('created', 'bagged', 'dispatched');

-- CreateEnum
CREATE TYPE "ControlType" AS ENUM ('standard', 'blank', 'duplicate');

-- CreateEnum
CREATE TYPE "PhotoSubjectType" AS ENUM ('box', 'interval');

-- CreateEnum
CREATE TYPE "CodeCategory" AS ENUM ('lithology', 'alteration_type', 'alteration_intensity', 'mineral', 'mineral_style', 'weathering', 'structure_type');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commodity" TEXT,
    "location" TEXT,
    "coordinate_system" TEXT NOT NULL,
    "sample_prefix" TEXT NOT NULL,
    "next_sample_number" INTEGER NOT NULL,
    "qc_standard_every_n" INTEGER NOT NULL,
    "qc_blank_every_n" INTEGER NOT NULL,
    "qc_duplicate_every_n" INTEGER NOT NULL,
    "photo_max_mb" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drillholes" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "hole_id" TEXT NOT NULL,
    "collar_source" "CollarSource",
    "collar_latitude" DOUBLE PRECISION,
    "collar_longitude" DOUBLE PRECISION,
    "collar_accuracy_m" DOUBLE PRECISION,
    "collar_captured_at" TIMESTAMPTZ(3),
    "planned_azimuth_deg" DOUBLE PRECISION,
    "planned_inclination_deg" DOUBLE PRECISION,
    "planned_depth_m" DOUBLE PRECISION NOT NULL,
    "actual_final_depth_m" DOUBLE PRECISION,
    "started_at" TEXT,
    "completed_at" TEXT,
    "status" "DrillholeStatus" NOT NULL,
    "contractor" TEXT,
    "drill_type" TEXT,
    "diameter" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "drillholes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drillhole_status_history" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "status" "DrillholeStatus" NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "drillhole_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_boxes" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "box_number" INTEGER NOT NULL,
    "from_m" DOUBLE PRECISION NOT NULL,
    "to_m" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "core_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_runs" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "from_m" DOUBLE PRECISION NOT NULL,
    "to_m" DOUBLE PRECISION NOT NULL,
    "recovered_m" DOUBLE PRECISION NOT NULL,
    "rqd_pieces_m" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "core_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_library" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "category" "CodeCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "code_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_intervals" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "from_m" DOUBLE PRECISION NOT NULL,
    "to_m" DOUBLE PRECISION NOT NULL,
    "lithology" TEXT,
    "alteration_type" TEXT,
    "alteration_intensity" TEXT,
    "mineral" TEXT,
    "mineral_style" TEXT,
    "mineral_percent" DOUBLE PRECISION,
    "weathering" TEXT,
    "structure_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "log_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "sample_number" TEXT NOT NULL,
    "sample_type" "SampleType" NOT NULL,
    "from_m" DOUBLE PRECISION,
    "to_m" DOUBLE PRECISION,
    "standard_ref" TEXT,
    "parent_sample_id" UUID,
    "note" TEXT,
    "status" "SampleStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_dismissals" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "control_type" "ControlType" NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "qc_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "subject_type" "PhotoSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "hole_id" TEXT NOT NULL,
    "box_number" INTEGER,
    "from_m" DOUBLE PRECISION NOT NULL,
    "to_m" DOUBLE PRECISION NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT,
    "width_px" INTEGER NOT NULL,
    "height_px" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_number_blocks" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "start_number" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sample_number_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" UUID,
    "actor_user_id" TEXT NOT NULL,
    "device_id" UUID,
    "entity_table" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "from_version" INTEGER,
    "to_version" INTEGER,
    "changes" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE INDEX "drillholes_project_id_idx" ON "drillholes"("project_id");

-- CreateIndex
CREATE INDEX "drillholes_organization_id_idx" ON "drillholes"("organization_id");

-- CreateIndex
CREATE INDEX "drillhole_status_history_drillhole_id_idx" ON "drillhole_status_history"("drillhole_id");

-- CreateIndex
CREATE INDEX "core_boxes_drillhole_id_idx" ON "core_boxes"("drillhole_id");

-- CreateIndex
CREATE INDEX "core_boxes_project_id_idx" ON "core_boxes"("project_id");

-- CreateIndex
CREATE INDEX "core_runs_drillhole_id_idx" ON "core_runs"("drillhole_id");

-- CreateIndex
CREATE INDEX "core_runs_project_id_idx" ON "core_runs"("project_id");

-- CreateIndex
CREATE INDEX "code_library_project_id_idx" ON "code_library"("project_id");

-- CreateIndex
CREATE INDEX "log_intervals_drillhole_id_idx" ON "log_intervals"("drillhole_id");

-- CreateIndex
CREATE INDEX "log_intervals_project_id_idx" ON "log_intervals"("project_id");

-- CreateIndex
CREATE INDEX "samples_drillhole_id_idx" ON "samples"("drillhole_id");

-- CreateIndex
CREATE INDEX "samples_project_id_idx" ON "samples"("project_id");

-- CreateIndex
CREATE INDEX "qc_dismissals_project_id_idx" ON "qc_dismissals"("project_id");

-- CreateIndex
CREATE INDEX "photos_subject_type_subject_id_idx" ON "photos"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "photos_drillhole_id_idx" ON "photos"("drillhole_id");

-- CreateIndex
CREATE INDEX "photos_project_id_idx" ON "photos"("project_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "sample_number_blocks_device_id_idx" ON "sample_number_blocks"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "sample_number_blocks_project_id_start_number_key" ON "sample_number_blocks"("project_id", "start_number");

-- CreateIndex
CREATE INDEX "audit_events_project_id_occurred_at_idx" ON "audit_events"("project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_entity_table_entity_id_idx" ON "audit_events"("entity_table", "entity_id");

-- AddForeignKey
ALTER TABLE "drillholes" ADD CONSTRAINT "drillholes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drillhole_status_history" ADD CONSTRAINT "drillhole_status_history_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_boxes" ADD CONSTRAINT "core_boxes_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_runs" ADD CONSTRAINT "core_runs_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_library" ADD CONSTRAINT "code_library_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_intervals" ADD CONSTRAINT "log_intervals_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_parent_sample_id_fkey" FOREIGN KEY ("parent_sample_id") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_dismissals" ADD CONSTRAINT "qc_dismissals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_number_blocks" ADD CONSTRAINT "sample_number_blocks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_number_blocks" ADD CONSTRAINT "sample_number_blocks_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express (see the header of schema.prisma).
-- ---------------------------------------------------------------------------

-- Two devices can never hold overlapping sample-number blocks for a project,
-- even if two requests race. (btree_gist lets the constraint mix "same
-- project" with "ranges overlap".)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "sample_number_blocks"
  ADD CONSTRAINT "sample_number_blocks_start_positive" CHECK ("start_number" >= 1),
  ADD CONSTRAINT "sample_number_blocks_size_positive" CHECK ("size" >= 1),
  ADD CONSTRAINT "sample_number_blocks_no_overlap"
    EXCLUDE USING gist (
      "project_id" WITH =,
      int4range("start_number", "start_number" + "size") WITH &&
    );

-- A sample number is a physical tag: unique per project, ignoring case, and
-- still reserved after the sample is deleted, so deleted rows are included.
CREATE UNIQUE INDEX "samples_project_id_sample_number_lower_key"
  ON "samples" ("project_id", lower("sample_number"));
