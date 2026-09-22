-- CreateEnum
CREATE TYPE "DrillholePriority" AS ENUM ('normal', 'urgent');

-- AlterTable
ALTER TABLE "drillholes" ADD COLUMN     "priority" "DrillholePriority" NOT NULL DEFAULT 'normal',
ADD COLUMN     "priority_note" TEXT;
