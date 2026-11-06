-- Migration: Add TitlesPrefixJson, TitlesSuffixJson to Students table
-- Date: 2025-11-24

-- Add new columns
ALTER TABLE "Students" ADD COLUMN IF NOT EXISTS "TitlesPrefixJson" TEXT;
ALTER TABLE "Students" ADD COLUMN IF NOT EXISTS "TitlesSuffixJson" TEXT;

-- Strip titles from FullName for existing student records
UPDATE "Students"
SET "FullName" = TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE("FullName", '^(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+', '', 'g'),
    ',\s*(PhD\.?|Ph\.D\.?|MBA|BSc|MSc|CSc|DrSc)$',
    '',
    'g'
))
WHERE "FullName" ~ '(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.|PhD\.?|Ph\.D\.?|MBA|BSc|MSc|CSc|DrSc)';
