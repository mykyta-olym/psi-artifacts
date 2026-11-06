-- Migration 012: Add DurationYears and AwardedDegree to Programs table
-- These fields define how long each program level takes and what degree is awarded

-- Add DurationYears column (default 3 for Bachelor programs)
ALTER TABLE "Programs" ADD COLUMN "DurationYears" INTEGER DEFAULT 3;
COMMENT ON COLUMN "Programs"."DurationYears" IS 'Number of years required to complete this program level (Bachelor=3, Master=2, Doctoral=3-4)';

-- Add AwardedDegree column
ALTER TABLE "Programs" ADD COLUMN "AwardedDegree" TEXT;
COMMENT ON COLUMN "Programs"."AwardedDegree" IS 'Academic degree awarded upon completion (e.g., Bc., Ing., Mgr., PhD.)';

-- Update existing programs based on Level
UPDATE "Programs" SET "DurationYears" = 3, "AwardedDegree" = 'Bc.' WHERE "Level" = 'Bachelor';
UPDATE "Programs" SET "DurationYears" = 2, "AwardedDegree" = 'Ing.' WHERE "Level" = 'Master';
UPDATE "Programs" SET "DurationYears" = 2, "AwardedDegree" = 'Ing.' WHERE "Level" = 'Inžiniersky';
UPDATE "Programs" SET "DurationYears" = 2, "AwardedDegree" = 'Mgr.' WHERE "Level" = 'Magisterský';
UPDATE "Programs" SET "DurationYears" = 3, "AwardedDegree" = 'PhD.' WHERE "Level" = 'Doctoral' OR "Level" = 'Doktorandský';
