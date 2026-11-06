// src/pages/teacher-dashboard/components/ClassOverviewCard.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { maisId } from '../../../utils/ids';

const slugify = (s='') => {
    const normalized = String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .toLowerCase()
        .trim()
        .replace(/[\s_/]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
    return normalized;
};

const normalizeGroupKey = (raw) => {
  if (!raw && raw !== 0) return '';
  const m = String(raw).match(/(\d{1,2})/);
  if (!m) return '';
  return `${String(parseInt(m[1], 10)).padStart(2, '0')}-sk`;
};

const ClassOverviewCard = ({ classData }) => {
  const navigate = useNavigate();

  const classIdUpper = useMemo(
      () => classData?.id || null,
      [classData?.id]
  );

  const courseCode = classData?._code || classData?.courseCode || '';
  const sectionKey  = classData?.sectionKey || normalizeGroupKey(classData?.section) || '';

  const attendanceColor = (rate) =>
      rate >= 90 ? 'text-success' : rate >= 75 ? 'text-warning' : 'text-error';
  const pendingColor = (count) =>
      count === 0 ? 'text-success' : count <= 5 ? 'text-warning' : 'text-error';

  const studentCountDisplay = Number.isFinite(classData?.studentCount) && classData.studentCount > 0 ? classData.studentCount : '—';
  const gradeLabel = classData?.grade ? `Year ${classData.grade}` : '—';
  const type = (classData?._type || '').toUpperCase();
  const hasSection = classData?.section || classData?.sectionKey;
  // For CL (quiz) classes, show section if available, otherwise show "No groups"
  // For other types (P, S, etc.), show informative message if no section
  const sectionLabel = hasSection 
    ? (classData?.section || classData?.sectionKey)
    : (type === 'CL' ? 'No groups' : 'No groups for this class type');
  const attendanceIsNumber = Number.isFinite(classData?.attendanceRate);
  const pendingIsNumber = Number.isFinite(classData?.pendingGrades);
  const attendanceDisplay = attendanceIsNumber ? `${Math.round(classData.attendanceRate)}%` : '—';
  const pendingDisplay = pendingIsNumber ? Math.round(classData.pendingGrades) : '—';
  const attendanceClassName = attendanceIsNumber ? attendanceColor(classData?.attendanceRate) : 'text-muted-foreground';
  const pendingClassName = pendingIsNumber ? pendingColor(classData?.pendingGrades) : 'text-muted-foreground';

  const nextClassInfo = classData?.nextClass && (classData.nextClass.time || classData.nextClass.room)
    ? classData.nextClass
    : null;

  const handleTakeAttendance = () => {
    const params = new URLSearchParams();

    if (courseCode) {
      params.set('course', courseCode);
      params.set('classId', maisId('class', courseCode));
    } else if (classIdUpper) {
      params.set('classId', classIdUpper.startsWith('class-') ? classIdUpper : classIdUpper.replace(/^CLASS-/i, 'class-'));
    }

    if (sectionKey) params.set('class', sectionKey);

    params.set('action', 'take');

    navigate(`/attendance-tracking?${params.toString()}`);
  };

  const handleEnterGrades = () => {
    const params = new URLSearchParams();

    if (courseCode) {
      params.set('course', courseCode);
      if (classData?.subject) params.set('subject', `${classData.subject} (${courseCode})`);
    }

    if (sectionKey) params.set('class', sectionKey);

    params.set('action', 'entry');

    navigate(`/grade-management?${params.toString()}`);
  };

  const handleViewRoster = () => {
    const params = new URLSearchParams();
    if (classData?.subject) {
      // Create slug from subject name, keeping abbreviation if present
      // e.g., "Forénzna analýza (FA)" -> "forenzna-analyza-fa"
      // IMPORTANT: Do NOT include course code in the slug
      let subjectName = String(classData.subject || '').trim();
      
      // Remove any course code that might be appended (e.g., "Subject (FA) 26001198" -> "Subject (FA)")
      // Remove numeric course codes (8 digits) that might be at the end
      subjectName = subjectName.replace(/\s+\d{8}\s*$/, '').trim();
      
      // Extract abbreviation from parentheses if present
      const abbrevMatch = subjectName.match(/\(([^)]+)\)\s*$/);
      const abbrev = abbrevMatch ? abbrevMatch[1].trim() : '';
      
      // Remove parentheses and abbreviation from base name
      const baseName = subjectName.replace(/\s*\([^)]*\)\s*$/, '').trim();
      
      // Create slug: base name + abbreviation (if exists)
      // Make sure abbreviation is not a course code (8 digits)
      const baseSlug = slugify(baseName);
      let abbrevSlug = '';
      if (abbrev && !/^\d{8}$/.test(abbrev)) {
        abbrevSlug = slugify(abbrev);
      }
      const finalSlug = abbrevSlug ? `${baseSlug}-${abbrevSlug}` : baseSlug;
      
      // Final check: remove any course code that might have been included
      const cleanedSlug = finalSlug.replace(/-\d{8}$/, '');
      params.set('subject', cleanedSlug);
    }
    if (sectionKey) params.set('class', sectionKey);
    params.set('sort', 'name');
    params.set('dir', 'asc');
    navigate(`/student-management?${params.toString()}`);
  };

  return (
      <article
          className="w-full max-w-full bg-card rounded-lg border border-border p-4 md:p-5 overflow-hidden focus-within:ring-2 focus-within:ring-primary/40"
          role="group"
          aria-label={`${classData?.subject} class`}
      >
        <header className="flex items-start justify-between gap-3 mb-3 md:mb-4 min-w-0">
          <div className="min-w-0">
            <h3
                className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate"
                title={classData?.subject}
            >
              {classData?.subject}
            </h3>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
              {gradeLabel} • {sectionLabel}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
            <Icon name="Users" size={16} className="text-muted-foreground" />
            <span className="text-sm md:text-base font-medium text-foreground">
            {studentCountDisplay}
          </span>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
          <div className="text-center p-3 md:p-3 bg-muted rounded-md min-w-0">
            <div
                className={`text-2xl sm:text-2xl md:text-2xl lg:text-3xl font-bold leading-none ${attendanceClassName}`}
            >
              {attendanceDisplay}
            </div>
            <div className="mt-1 text-[11px] sm:text-[11px] md:text-xs lg:text-sm leading-tight text-muted-foreground break-words" style={{ hyphens: 'auto' }}>
              Attendance
            </div>
          </div>

          <div className="text-center p-3 md:p-3 bg-muted rounded-md min-w-0">
            <div
                className={`text-2xl sm:text-2xl md:text-2xl lg:text-3xl font-bold leading-none ${pendingClassName}`}
            >
              {pendingDisplay}
            </div>
            <div className="mt-1 text-[11px] sm:text-[11px] md:text-xs lg:text-sm leading-tight text-muted-foreground break-words" style={{ hyphens: 'auto' }}>
              Pending Grades
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap md:flex-wrap gap-2 md:gap-3">
          <Button
              variant="default"
              size="sm"
              iconName="CheckSquare"
              onClick={handleTakeAttendance}
              className="w-full sm:flex-1 md:w-auto"
          >
            Take Attendance
          </Button>
          <Button
              variant="outline"
              size="sm"
              iconName="BookOpen"
              onClick={handleEnterGrades}
              className="w-full sm:flex-1 md:w-auto"
          >
            Enter Grades
          </Button>
          <Button
              variant="ghost"
              size="sm"
              iconName="Users"
              onClick={handleViewRoster}
              className="w-full sm:flex-1 md:w-auto"
          >
            Roster
          </Button>
        </div>

        {nextClassInfo && (
            <footer className="mt-4 pt-3 md:pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground">
                <Icon name="Clock" size={14} />
                <span>
              Next: {nextClassInfo.time || '—'}
              {nextClassInfo.room ? ` — ${nextClassInfo.room}` : ''}
            </span>
              </div>
            </footer>
        )}
      </article>
  );
};

export default ClassOverviewCard;