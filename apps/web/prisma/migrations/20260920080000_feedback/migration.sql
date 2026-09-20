-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "user_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "app_version" TEXT,
    "device" TEXT,
    "screen" TEXT,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_client_id_key" ON "feedback"("client_id");

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

