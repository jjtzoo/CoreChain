-- AlterTable
-- Whether the person wants to test CoreChain Field ("tester") or is
-- evaluating it for a team ("team"). Requests made before the landing page
-- asked were all pilot requests for a team.
ALTER TABLE "access_requests" ADD COLUMN     "interest" TEXT NOT NULL DEFAULT 'team';
