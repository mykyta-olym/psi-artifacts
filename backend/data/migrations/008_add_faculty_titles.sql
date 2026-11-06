-- Migration: Add GivenName, FamilyName, TitlesPrefixJson, TitlesSuffixJson to Faculty table
-- Date: 2025-11-24

-- Add new columns
ALTER TABLE "Faculty" ADD COLUMN IF NOT EXISTS "GivenName" TEXT;
ALTER TABLE "Faculty" ADD COLUMN IF NOT EXISTS "FamilyName" TEXT;
ALTER TABLE "Faculty" ADD COLUMN IF NOT EXISTS "TitlesPrefixJson" TEXT;
ALTER TABLE "Faculty" ADD COLUMN IF NOT EXISTS "TitlesSuffixJson" TEXT;

-- Migrate existing data: strip titles from FullName and populate GivenName/FamilyName
UPDATE "Faculty"
SET 
    "GivenName" = SPLIT_PART(
        REGEXP_REPLACE("FullName", '^(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+', '', 'g'),
        ' ',
        1
    ),
    "FamilyName" = SUBSTRING(
        REGEXP_REPLACE("FullName", '^(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+', '', 'g')
        FROM POSITION(' ' IN REGEXP_REPLACE("FullName", '^(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+', '', 'g')) + 1
    )
WHERE "GivenName" IS NULL OR "FamilyName" IS NULL;

-- Strip titles from FullName for existing records
UPDATE "Faculty"
SET "FullName" = TRIM(REGEXP_REPLACE(
    REGEXP_REPLACE("FullName", '^(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+', '', 'g'),
    ',\s*(PhD\.?|Ph\.D\.?|MBA|BSc|MSc|CSc|DrSc)$',
    '',
    'g'
))
WHERE "FullName" ~ '(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.|PhD\.?|Ph\.D\.?|MBA|BSc|MSc|CSc|DrSc)';

-- Update specific problematic record
UPDATE "Faculty"
SET 
    "FullName" = 'Mykyta Olym',
    "GivenName" = 'Mykyta',
    "FamilyName" = 'Olym',
    "TitlesPrefixJson" = '["Bc."]',
    "TitlesSuffixJson" = '["PhD."]'
WHERE "Email" = 'mykyta.olym.work@gmail.com';

-- Update departments for consistency
UPDATE "Faculty"
SET "Department" = 'Katedra počítačov a informatiky (FEI)',
    "DepartmentsJson" = '["Katedra počítačov a informatiky (FEI)"]'
WHERE "Email" = 'mykyta.olym.work@gmail.com' AND ("Department" = 'FEI-KPI' OR "Department" IS NULL);
