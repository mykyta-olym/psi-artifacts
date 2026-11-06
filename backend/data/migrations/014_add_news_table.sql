-- Migration: 014_add_news_table.sql
-- Description: Create news table for managing university news and announcements

CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    content_html TEXT,
    published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    author_email VARCHAR(255),
    author_name VARCHAR(255),
    is_published BOOLEAN NOT NULL DEFAULT true,
    attachments TEXT, -- JSON array
    category VARCHAR(100),
    tags TEXT, -- JSON array or comma-separated
    cover_image_url VARCHAR(1000),
    priority INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
CREATE INDEX IF NOT EXISTS idx_news_author ON news(author_email);
CREATE INDEX IF NOT EXISTS idx_news_priority ON news(priority DESC);
CREATE INDEX IF NOT EXISTS idx_news_expires_at ON news(expires_at);

-- Insert sample news
INSERT INTO news (title, content, content_html, published_at, author_email, author_name, is_published, category, priority)
VALUES 
(
    'Print the Accommodation Contract',
    'To be accommodated, you must present the accommodation contract. Sign in to the MAIS Student interface and select Print Reports. The contract must be printed double-sided. Foreign students should print the contract in English.',
    '<p>To be accommodated, you must present the accommodation contract.</p><p>Sign in to the MAIS Student interface: <a href="https://student.tuke.sk">https://student.tuke.sk</a>.</p><p>Select Print Reports.</p><p>The contract must be printed double-sided.</p><p>Foreign students should print the contract in English.</p>',
    '2025-09-10',
    'admin@university.edu',
    'Administration',
    true,
    'accommodation',
    10
),
(
    'Registration round for foreign language timetables in WS 2025/26',
    'The registration round for foreign language timetables in the winter semester 2025/26 is open from 10 September 2025.',
    '<p>The registration round for foreign language timetables in the winter semester 2025/26 is open from 10 September 2025.</p><p>It is open from 10 September 2025 for all students except FEI.</p><p>During 2025/2026, FEI students in the course FEI – Language 1 will not register into timetables.</p>',
    '2025-09-10',
    'admin@university.edu',
    'Administration',
    true,
    'academic',
    8
),
(
    'Fees during studies and adding a bank account',
    'You can find information about fees assigned to you during your studies in My Study → Study Funding. You can set up a bank account to which payments will be sent in the Student interface under Profile → Bank Connections.',
    '<p>You can find information about fees assigned to you during your studies in My Study → Study Funding.</p><p>You can set up a bank account to which payments will be sent in the Student interface under Profile → Bank Connections.</p>',
    '2020-08-28',
    'admin@university.edu',
    'Administration',
    true,
    'financial',
    5
),
(
    'General Data Protection Regulation (GDPR)',
    'Information about GDPR compliance at TUKE.',
    '<p>Please review the GDPR documentation for information about how we handle your personal data.</p>',
    '2024-09-06',
    'admin@university.edu',
    'Administration',
    true,
    'legal',
    3
);
