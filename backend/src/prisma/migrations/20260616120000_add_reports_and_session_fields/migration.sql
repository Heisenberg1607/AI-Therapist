-- ReportType enum + Report table (clinical report PDFs)
DO $$ BEGIN
  CREATE TYPE "ReportType" AS ENUM ('GENERATED', 'UPLOADED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "mostCommonIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Report_userId_idx" ON "Report"("userId");

DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- User profile / onboarding fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingData" JSONB;
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Session metadata + ratings
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "mood" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "topic" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "durationSec" INTEGER;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ratingScores" JSONB;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ratingOverall" DOUBLE PRECISION;
