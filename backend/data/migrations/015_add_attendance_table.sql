-- Migration: Create attendance table for tracking student attendance
-- Date: 2024

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(50) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    student_email VARCHAR(255),
    teacher_email VARCHAR(255) NOT NULL,
    session_date DATE NOT NULL,
    time_slot VARCHAR(50),
    room VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'present',
    notes TEXT,
    class_group_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_attendance_course_code ON attendance(course_code);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher_email ON attendance(teacher_email);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date ON attendance(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_course_date ON attendance(course_code, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_course ON attendance(student_id, course_code);

-- Add constraint for valid status values
ALTER TABLE attendance 
ADD CONSTRAINT chk_attendance_status 
CHECK (status IN ('present', 'absent', 'late', 'excused'));
