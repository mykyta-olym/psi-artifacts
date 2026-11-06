-- Migration: 016_add_payments_table
-- Adds payments table for tracking student financial transactions

CREATE TABLE IF NOT EXISTS "Payments" (
    "Id" SERIAL PRIMARY KEY,
    "StudentId" VARCHAR(100) NOT NULL,
    "Type" VARCHAR(50) NOT NULL DEFAULT 'tuition',
    "Description" VARCHAR(500),
    "Amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "Status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "VariableSymbol" VARCHAR(50),
    "SpecificSymbol" VARCHAR(50),
    "AcademicYear" VARCHAR(20),
    "Semester" VARCHAR(10),
    "DueDate" DATE,
    "PostedDate" DATE,
    "ExternalRef" VARCHAR(200),
    "Notes" VARCHAR(1000),
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IX_Payments_StudentId" ON "Payments" ("StudentId");
CREATE INDEX IF NOT EXISTS "IX_Payments_Status" ON "Payments" ("Status");
CREATE INDEX IF NOT EXISTS "IX_Payments_AcademicYear" ON "Payments" ("AcademicYear");
CREATE INDEX IF NOT EXISTS "IX_Payments_Type" ON "Payments" ("Type");

-- Insert sample payment data for existing students
INSERT INTO "Payments" ("StudentId", "Type", "Description", "Amount", "Currency", "Status", "VariableSymbol", "SpecificSymbol", "AcademicYear", "Semester", "DueDate", "PostedDate")
SELECT 
    s."Id",
    'tuition',
    'Tuition fee - Winter semester 2025/2026',
    500.00,
    'EUR',
    'posted',
    LPAD(CAST(ABS(('x' || SUBSTR(MD5(s."Id"), 1, 8))::bit(32)::int % 100000000) AS VARCHAR), 10, '0'),
    LPAD(CAST(ABS(('x' || SUBSTR(MD5(s."Email"), 1, 8))::bit(32)::int % 1000000) AS VARCHAR), 6, '0'),
    '2025/2026',
    'WS',
    '2025-09-30',
    '2025-09-15'
FROM "Students" s
WHERE NOT EXISTS (SELECT 1 FROM "Payments" p WHERE p."StudentId" = s."Id" AND p."Type" = 'tuition' AND p."AcademicYear" = '2025/2026' AND p."Semester" = 'WS')
LIMIT 50;

-- Add variable symbols for students who don't have them
INSERT INTO "VariableSymbols" ("Id", "StudentId", "Symbol", "Purpose", "Description", "IsActive", "CreatedAt")
SELECT 
    'vs-' || s."Id" || '-tuition',
    s."Id",
    LPAD(CAST(ABS(('x' || SUBSTR(MD5(s."Id"), 1, 8))::bit(32)::int % 100000000) AS VARCHAR), 10, '0'),
    'tuition',
    'Variable symbol for tuition payments',
    TRUE,
    NOW()::text
FROM "Students" s
WHERE NOT EXISTS (SELECT 1 FROM "VariableSymbols" v WHERE v."StudentId" = s."Id" AND v."Purpose" = 'tuition')
LIMIT 50;
