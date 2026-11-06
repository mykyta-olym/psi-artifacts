-- Migration 013: Add RequiredYear to Courses and TimetableEntries
-- This field controls which year of students can see/access courses and schedule entries

-- Add RequiredYear to Courses table
ALTER TABLE "Courses" ADD COLUMN "RequiredYear" INTEGER;
COMMENT ON COLUMN "Courses"."RequiredYear" IS 'Minimum study year required to access this course (1-5). NULL means available for all years.';

-- Add RequiredYear to TimetableEntries table  
ALTER TABLE "TimetableEntries" ADD COLUMN "RequiredYear" INTEGER;
COMMENT ON COLUMN "TimetableEntries"."RequiredYear" IS 'Minimum study year required to see this schedule entry (1-5). NULL means visible to all years.';

-- Default: make existing courses available to all years (NULL = no restriction)
-- Teachers can set specific year requirements later through the UI
