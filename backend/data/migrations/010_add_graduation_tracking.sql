-- 010_add_graduation_tracking.sql
-- Add graduation tracking fields to Students table

ALTER TABLE "Students" 
ADD COLUMN IF NOT EXISTS "ThesisApproved" boolean,
ADD COLUMN IF NOT EXISTS "ThesisApprovedDate" text,
ADD COLUMN IF NOT EXISTS "AllCreditsEarned" boolean,
ADD COLUMN IF NOT EXISTS "AllGradesSubmitted" boolean,
ADD COLUMN IF NOT EXISTS "GraduationEligible" boolean,
ADD COLUMN IF NOT EXISTS "GraduationDate" text,
ADD COLUMN IF NOT EXISTS "AwardedDegree" text;

-- Add comments
COMMENT ON COLUMN "Students"."ThesisApproved" IS 'Whether thesis/final work is officially approved';
COMMENT ON COLUMN "Students"."ThesisApprovedDate" IS 'Date when thesis was approved (ISO format)';
COMMENT ON COLUMN "Students"."AllCreditsEarned" IS 'Whether all required credits are earned';
COMMENT ON COLUMN "Students"."AllGradesSubmitted" IS 'Whether all grades are submitted';
COMMENT ON COLUMN "Students"."GraduationEligible" IS 'Whether student is eligible for graduation';
COMMENT ON COLUMN "Students"."GraduationDate" IS 'Date when degree was awarded (ISO format)';
COMMENT ON COLUMN "Students"."AwardedDegree" IS 'Awarded academic degree (Bc., Ing., Mgr., etc.)';
