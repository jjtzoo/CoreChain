-- CreateTable
CREATE TABLE "hole_assignments" (
    "id" TEXT NOT NULL,
    "drillhole_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hole_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hole_assignments_drillhole_id_key" ON "hole_assignments"("drillhole_id");

-- CreateIndex
CREATE INDEX "hole_assignments_user_id_idx" ON "hole_assignments"("user_id");

-- AddForeignKey
ALTER TABLE "hole_assignments" ADD CONSTRAINT "hole_assignments_drillhole_id_fkey" FOREIGN KEY ("drillhole_id") REFERENCES "drillholes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hole_assignments" ADD CONSTRAINT "hole_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
