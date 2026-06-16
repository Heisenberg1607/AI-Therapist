-- AlterTable
-- IF NOT EXISTS guards against this project's existing schema drift: the column
-- may already have been added via `prisma db push`. This keeps `migrate deploy`
-- on Render from failing with "column already exists".
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "moodEnd" TEXT;
