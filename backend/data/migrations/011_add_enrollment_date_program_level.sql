-- Migration 011: Add EnrollmentDate and ProgramLevel to Students table
-- These fields are needed for accurate graduation eligibility calculation

-- Add EnrollmentDate column
ALTER TABLE "Students" ADD COLUMN "EnrollmentDate" TEXT;
COMMENT ON COLUMN "Students"."EnrollmentDate" IS 'ISO date when student started this program (used for graduation timing)';

-- Add ProgramLevel column (cached from Programs table for performance)
ALTER TABLE "Students" ADD COLUMN "ProgramLevel" TEXT;
COMMENT ON COLUMN "Students"."ProgramLevel" IS 'Bachelor, Master, or Doctoral - cached from Programs table';

-- Update existing students with default enrollment dates (3 years ago for Year 1, etc.)
-- This is a best-effort backfill; new students should always have EnrollmentDate set
UPDATE "Students" 
SET "EnrollmentDate" = date('now', '-' || (CAST("StudyYear" AS INTEGER) || ' years'))
WHERE "EnrollmentDate" IS NULL AND "StudyYear" > 0;

-- Update ProgramLevel from Programs table where possible
UPDATE "Students" 
SET "ProgramLevel" = (
    SELECT "Level" 
    FROM "Programs" 
    WHERE "Programs"."Name" = "Students"."Program" 
    LIMIT 1
)
WHERE "ProgramLevel" IS NULL;

-- Set default to Bachelor if still NULL
UPDATE "Students" 
SET "ProgramLevel" = 'Bachelor'
WHERE "ProgramLevel" IS NULL;
