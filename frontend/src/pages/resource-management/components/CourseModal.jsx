// src/pages/resource-management/components/CourseModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import ModalBase from '../../../components/ui/ModalBase';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useToasts } from '../../../components/ui/Toasts';
import { createCourse, updateCourse } from '../../../data/maisApiAdapter';
import { extractApiErrorMessage } from '../../../utils/apiErrors';

// Auto-generate course code from name and faculty
const generateCourseCode = (name, faculty) => {
  if (!name || !name.trim()) return '';
  
  // Extract acronym from course name
  // Examples: "Introduction to Programming" -> "ITP", "Data Structures" -> "DS"
  const words = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-zA-Z\s]/g, '') // Remove non-letters
    .split(/\s+/)
    .filter(w => w.length > 0 && !['to', 'the', 'of', 'and', 'in', 'for', 'a', 'an'].includes(w.toLowerCase()));
  
  if (words.length === 0) return '';
  
  // Take first letter of each significant word, max 4 letters
  const acronym = words
    .slice(0, 4)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  
  // Combine with faculty prefix if available (e.g., "UINF/ITP")
  if (faculty && faculty !== 'FEI') {
    const facultyPrefix = faculty.substring(0, 4).toUpperCase();
    return `${facultyPrefix}/${acronym}`;
  }
  
  // Default format with UINF prefix for FEI
  return `UINF/${acronym}`;
};

const TYPE_OPTIONS = [
  { value: 'P+CL', label: 'P+CL - Lecture + Lab' },
  { value: 'S', label: 'S - Seminar' },
];

const COMPLETION_OPTIONS = [
  { value: 'Cr', label: 'Cr - Credit' },
  { value: 'CrEx', label: 'CrEx - Credit + Exam' },
];

const PROFILE_OPTIONS = [
  { value: 'PV', label: 'PV - Compulsory' },
  { value: 'PVP', label: 'PVP - Compulsory Elective (Profiling)' },
  { value: 'PV/PVP', label: 'PV/PVP - Compulsory / Compulsory Elective' },
  { value: 'PP', label: 'PP - Not Compulsory' },
];

const CourseModal = ({ isOpen, onClose, course, onSaved, faculties = [], programs = [] }) => {
  const { notify } = useToasts();
  const [saving, setSaving] = useState(false);
  
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameSk, setNameSk] = useState('');
  const [credits, setCredits] = useState('');
  const [typeSk, setTypeSk] = useState('P+CL');
  const [completionSk, setCompletionSk] = useState('');
  const [faculty, setFaculty] = useState('');
  const [program, setProgram] = useState('');
  const [profile, setProfile] = useState('');
  const [hoursSk, setHoursSk] = useState('');
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);

  // Filter programs by selected faculty
  const availablePrograms = useMemo(() => {
    if (!faculty) return [];
    return programs.filter(p => p.faculty === faculty);
  }, [programs, faculty]);

  // Reset program when faculty changes
  const handleFacultyChange = (newFaculty) => {
    setFaculty(newFaculty);
    // Reset program if faculty changes and current program doesn't belong to new faculty
    if (program) {
      const programBelongsToFaculty = programs.some(p => p.name === program && p.faculty === newFaculty);
      if (!programBelongsToFaculty) {
        setProgram('');
      }
    }
  };

  // Auto-generate code when nameEn or faculty changes (only for new courses)
  useEffect(() => {
    if (!course && autoGenerateCode && nameEn && faculty) {
      const generatedCode = generateCourseCode(nameEn, faculty);
      setCode(generatedCode);
    }
  }, [nameEn, faculty, course, autoGenerateCode]);

  // Parse hoursSk (format: "2/2/0" = P hours / CL hours / S hours)
  // Determine available types based on hours
  // Note: P and CL always go together, only S can be separate
  const getAvailableTypes = (hoursStr) => {
    if (!hoursStr) return ['P+CL']; // Default to P+CL if no hours specified
    
    const parts = String(hoursStr).split('/').map(h => parseInt(h.trim()) || 0);
    const [pHours = 0, clHours = 0, sHours = 0] = parts;
    
    const available = [];
    // P and CL always go together - if either has hours, include P+CL
    if (pHours > 0 || clHours > 0) available.push('P+CL');
    // S (seminar) can be separate
    if (sHours > 0) available.push('S');
    
    return available.length > 0 ? available : ['P+CL']; // Default to P+CL if all zeros
  };

  const availableTypes = getAvailableTypes(hoursSk);

  useEffect(() => {
    if (course) {
      setCode(course.code || '');
      setNameEn(course.nameEn || '');
      setNameSk(course.nameSk || '');
      setCredits(course.credits?.toString() || '');
      
      // Normalize TypeSk - fix Profile values that were incorrectly stored as Type
      const oldType = course.typeSk || 'P+CL';
      const profileValues = ['PV', 'PP', 'PVP', 'PV/PVP'];
      
      let normalizedType;
      if (profileValues.includes(oldType)) {
        // If it's a Profile value, replace with default Type
        normalizedType = 'P+CL';
      } else if (oldType === 'P' || oldType === 'CL') {
        // Convert old format (P, CL) to new format (P+CL)
        normalizedType = 'P+CL';
      } else if (oldType === 'S') {
        // S is correct
        normalizedType = 'S';
      } else {
        // Default to P+CL
        normalizedType = 'P+CL';
      }
      
      setTypeSk(normalizedType);
      setCompletionSk(course.completionSk || '');
      setFaculty(course.faculty || '');
      setProgram(course.program || '');
      setProfile(course.profile || '');
      setHoursSk(course.hoursSk || '');
      setAutoGenerateCode(false); // Disable auto-generation when editing
    } else {
      setCode('');
      setNameEn('');
      setNameSk('');
      setCredits('');
      setTypeSk('P+CL');
      setCompletionSk('');
      setFaculty('');
      setProgram('');
      setProfile('');
      setHoursSk('');
      setAutoGenerateCode(true);
    }
  }, [course, isOpen]);

  // Auto-generate code when name or faculty changes (only for new courses)
  useEffect(() => {
    if (!course && autoGenerateCode && nameEn && faculty) {
      const generatedCode = generateCourseCode(nameEn, faculty);
      setCode(generatedCode);
    }
  }, [nameEn, faculty, course, autoGenerateCode]);

  const handleSave = async () => {
    // Validation
    if (!code.trim()) {
      notify('error', 'Course code is required');
      return;
    }

    if (!nameEn.trim()) {
      notify('error', 'Course name (English) is required');
      return;
    }

    if (!faculty) {
      notify('error', 'Faculty is required for course assignment');
      return;
    }

    if (!program) {
      notify('error', 'Program is required for student enrollment');
      return;
    }

    const creditsNum = credits ? parseInt(credits) : 0;
    if (creditsNum < 0 || creditsNum > 20) {
      notify('error', 'Credits must be between 0 and 20');
      return;
    }

    setSaving(true);
    try {
      const data = {
        code: code.trim().toUpperCase(),
        nameEn: nameEn.trim(),
        nameSk: nameSk?.trim() || null,
        credits: creditsNum,
        typeSk: typeSk || 'P+CL',
        completionSk: completionSk || 'Ex',
        faculty: faculty,
        program: program,
        profile: profile?.trim() || null,
        hoursSk: hoursSk?.trim() || null,
      };

      if (course) {
        await updateCourse(course.code, data);
        notify('success', 'Course updated successfully');
      } else {
        await createCourse(data);
        notify('success', 'Course created and ready for schedule assignment');
      }

      onSaved();
      onClose();
    } catch (error) {
      notify('error', extractApiErrorMessage(error, 'Failed to save course'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBase
      open={isOpen}
      onClose={onClose}
      title={course ? 'Edit Course' : 'Create Course'}
      subtitle={course ? 'Update course details' : 'Add a new course to the system'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} iconName="Save">
            {course ? 'Save Changes' : 'Create Course'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Course Names */}
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Course Name (English)"
            required
            placeholder="e.g., Introduction to Programming"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            description="Full name used in schedule and student enrollment"
            autoFocus
          />

          <Input
            label="Course Name (Alternative Language)"
            placeholder="e.g., Úvod do programovania"
            value={nameSk}
            onChange={(e) => setNameSk(e.target.value)}
            description="Alternative translation (optional)"
          />
        </div>

        {/* Course Code */}
        <Input
          label="Course Code"
          required
          placeholder="e.g., UINF/123"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setAutoGenerateCode(false); // Disable auto-generation if manually edited
          }}
          disabled={!!course}
          description={
            course 
              ? "Course code cannot be changed" 
              : autoGenerateCode 
                ? "Auto-generated from name and faculty (edit to customize)" 
                : "Unique identifier (will be auto-uppercased)"
          }
        />
        
        {!course && autoGenerateCode && code && (
          <p className="text-xs text-primary -mt-3">
            ✓ Auto-generating code from course name and faculty
          </p>
        )}

        {/* Credits, Type, Completion - Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Credits"
            required
            type="number"
            min="0"
            max="20"
            placeholder="e.g., 6"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            description="ECTS credits"
          />

          <Select
            label="Type"
            required
            options={TYPE_OPTIONS}
            value={typeSk}
            onChange={setTypeSk}
            description="Course type"
          />

          <Select
            label="Completion"
            required
            options={COMPLETION_OPTIONS}
            value={completionSk}
            onChange={setCompletionSk}
            placeholder="Select..."
            description="Assessment"
          />
        </div>

        {/* Faculty and Program - Required for Integration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Faculty"
            required
            options={faculties.map(f => ({
              value: f.code,
              label: `${f.code} - ${f.nameEn}`
            }))}
            value={faculty}
            onChange={handleFacultyChange}
            searchable
            placeholder={faculties.length === 0 ? "No faculties available - check data" : "Select faculty"}
            disabled={faculties.length === 0}
            description="Required for teacher assignment"
          />

          <Select
            label="Program"
            required
            options={availablePrograms.map(p => ({
              value: p.name,
              label: p.name
            }))}
            value={program}
            onChange={setProgram}
            searchable
            placeholder={
              !faculty 
                ? "Select faculty first" 
                : availablePrograms.length === 0 
                  ? "No programs available for this faculty" 
                  : "Select program"
            }
            disabled={!faculty || availablePrograms.length === 0}
            description="Required for student enrollment (filtered by faculty)"
          />
        </div>

        {/* Hours - Important for determining available types */}
        <div>
          <Input
            label="Hours per Week"
            placeholder="e.g., 2/2/0"
            value={hoursSk}
            onChange={(e) => setHoursSk(e.target.value)}
            description="Format: Lecture hours / Lab hours / Seminar hours"
          />
        </div>

        {/* Profile/Description */}
        <div>
          <Select
            label="Profile (Course Obligation)"
            options={PROFILE_OPTIONS}
            value={profile}
            onChange={setProfile}
            searchable={false}
            placeholder="Select profile..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            PV = Compulsory, PP = Not Compulsory, PVP = Compulsory Elective
          </p>
        </div>
      </div>
    </ModalBase>
  );
};

export default CourseModal;