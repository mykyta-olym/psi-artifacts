// src/pages/class-schedule-management/components/ScheduleModal.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, MotionConfig } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useToasts } from '../../../components/ui/Toasts';
import { useAuth } from '../../../contexts/AuthContext';
import { createLogger } from '../../../utils/logger';
const logger = createLogger('ScheduleModal');

import {
  createValidator,
  custom as customRule,
  required,
  useFormValidator,
} from '../../../utils/validation';

const toLabel = (v) => (typeof v === 'string' ? v : v?.label || '');
const toValue = (v) => (typeof v === 'string' ? v : v?.value ?? '');
const pickVal = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v ?? '');
const ensureOptions = (arr = []) => (arr || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: toValue(o), label: toLabel(o) }));

const uniqBy = (items, key) => {
  const seen = new Set();
  const out = [];
  (items || []).forEach((it) => {
    const k = key(it);
    if (k == null || seen.has(k)) return;
    seen.add(k);
    out.push(it);
  });
  return out;
};

const KIND_OPTIONS = [
  { value: 'P', label: 'Lecture (P)' },
  { value: 'CL', label: 'Lab / Class (CL)' },
  { value: 'S', label: 'Seminar (S)' },
];

const kindToLabel = (k) => {
  const map = {
    P: 'Lecture',
    CL: 'Lab / Class',
    S: 'Seminar',
  };
  return map[String(k || '').toUpperCase()] || 'Class';
};

const ScheduleModal = ({
                         isOpen,
                         onClose,
                         onSave,
                         onDelete,
                         scheduleData = null,
                         mode = 'create',
                         userRole = 'teacher',
                         currentTeacherName = '',
                         currentTeacherEmail = '',
                         timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
                         weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                         dynamic = null,
                         existingSchedules = []
                       }) => {
  const rawCourseOptions = useMemo(() => 
    dynamic?.subjectOptions?.length ? dynamic.subjectOptions : [], 
    [dynamic?.subjectOptions]
  );
  const teacherCourseMap = dynamic?.teacherCourseMap;

  const teacherOptionsRaw = useMemo(() => 
    ensureOptions(dynamic?.teacherOptions || []), 
    [dynamic?.teacherOptions]
  );
  const teacherOptions = useMemo(() => 
    uniqBy(teacherOptionsRaw, (o) => String(o.value).toLowerCase()), 
    [teacherOptionsRaw]
  );
  const roomOptions = useMemo(() => 
    ensureOptions(dynamic?.roomOptions || []), 
    [dynamic?.roomOptions]
  );
  const dayOptions = useMemo(() => 
    ensureOptions(weekDays), 
    [weekDays]
  );
  const timeOptionsAll = useMemo(() => 
    ensureOptions(timeSlots), 
    [timeSlots]
  );
  
  // Prepare raw class group options from API only (no fallback to static options)
  const rawClassGroupOptions = useMemo(() => {
    const dynamicClassGroups = dynamic?.classGroups || [];
    return dynamicClassGroups.map(group => ({
      value: group.id,
      label: group.name,
      faculty: group.faculty,
      program: group.program
    }));
  }, [dynamic?.classGroups]);

  // Use faculties and programs from API (passed via dynamic prop)
  const facultyOptions = useMemo(() => 
    ensureOptions(dynamic?.facultyOptions || []), 
    [dynamic?.facultyOptions]
  );
  const programOptions = useMemo(() => 
    ensureOptions(dynamic?.programOptions || []), 
    [dynamic?.programOptions]
  );
  
  const { userProfile } = useAuth();

  // Get current teacher's program and faculty for default values
  // First try to find in facultyList, then fallback to userProfile
  const currentTeacher = useMemo(() => {
    if (!currentTeacherEmail) {
      return null;
    }
    
    // First try to find in facultyList
    if (dynamic?.facultyList && Array.isArray(dynamic.facultyList) && dynamic.facultyList.length > 0) {
      const found = dynamic.facultyList.find((f) => 
        String(f.email || '').toLowerCase() === String(currentTeacherEmail || '').toLowerCase()
      );
      if (found) {
        return found;
      }
    }
    
    // Fallback to userProfile if not found in facultyList
    if (userProfile && String(userProfile.email || '').toLowerCase() === String(currentTeacherEmail || '').toLowerCase()) {
      const fallback = {
        email: userProfile.email || currentTeacherEmail,
        faculty: userProfile.faculty || '',
        program: userProfile.program || ''
      };
      return fallback;
    }
    
    return null;
  }, [dynamic?.facultyList, currentTeacherEmail, userProfile]);

  // Helper to get default program value that matches options
  const getDefaultProgram = useMemo(() => {
    if (scheduleData?.program) {
      const scheduleProgram = String(scheduleData.program).trim();
      const programOption = programOptions.find(opt => String(opt.value).trim() === scheduleProgram);
      return programOption ? programOption.value : scheduleProgram;
    }
    if (currentTeacher?.program) {
      const teacherProgram = String(currentTeacher.program).trim();
      const programOption = programOptions.find(opt => String(opt.value).trim() === teacherProgram);
      if (programOption) {
        return programOption.value;
      }
    }
    return '';
  }, [scheduleData?.program, currentTeacher?.program, programOptions]);

  const initial = {
    subjectCode: '',
    teacherEmail: userRole === 'teacher' ? currentTeacherEmail || '' : '',
    room: '',
    day: scheduleData?.day || '',
    startTime: scheduleData?.time || '',
    endTime: scheduleData?.endTime || '',
    kind: scheduleData?.kind || 'CL',
    classGroupKeys: scheduleData?.classGroupKeys || [],
    notes: ''
  };

  const [form, setForm] = useState(initial);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const scheduleId = scheduleData?.id || null;
  
  // Get selected course data
  const selectedCourse = useMemo(() => {
    if (!form.subjectCode) return null;
    const course = rawCourseOptions.find(opt => opt.value === form.subjectCode || opt.code === form.subjectCode);
    // Extract faculty and program from _meta if available
    if (course?._meta) {
      return {
        ...course,
        faculty: course._meta.faculty,
        program: course._meta.program
      };
    }
    return course;
  }, [form.subjectCode, rawCourseOptions]);

  // Get faculty and program from selected course
  const courseFaculty = selectedCourse?.faculty || scheduleData?.faculty || '';
  const courseProgram = selectedCourse?.program || scheduleData?.program || '';
  
  // Filter class groups based on course faculty and program
  const classGroupOptions = useMemo(() => {
    if (!courseFaculty && !courseProgram) {
      return rawClassGroupOptions;
    }
    
    const filtered = rawClassGroupOptions.filter(opt => {
      // For static options (no faculty/program), show all
      if (!opt.faculty && !opt.program) {
        return true;
      }
      
      const matchesFaculty = !courseFaculty || opt.faculty === courseFaculty;
      const matchesProgram = !courseProgram || opt.program === courseProgram;
      return matchesFaculty && matchesProgram;
    });
    
    // Only log when courseFaculty or courseProgram changes, not on every render
    if (process.env.NODE_ENV === 'development' && (courseFaculty || courseProgram)) {
      logger.debug('[ScheduleModal] Filtered class groups:', { 
        filteredCount: filtered.length, 
        courseFaculty,
        courseProgram
      });
    }
    
    return filtered;
  }, [courseFaculty, courseProgram, rawClassGroupOptions]);
  
  const validationSchema = useMemo(() => {
    const teacherRequired = userRole !== 'teacher';
    return {
      subjectCode: [required('Course is required')],
      classGroupKeys: [
        customRule('At least one class group is required for CL type', {
          validate: (value, values) => {
            if (values?.kind !== 'CL') return true;
            return Array.isArray(value) && value.length > 0;
          },
        }),
      ],
      teacherEmail: teacherRequired ? [required('Teacher is required')] : [],
      room: [required('Room is required')],
      day: [required('Day is required')],
      startTime: [
        required('Start time is required'),
        customRule('Select a valid start time', {
          validate: (value) => !value || timeSlots.includes(value),
        }),
        customRule('End time must be after start time', {
          validate: (value, values) => {
            if (!value || !values?.endTime) return true;
            const si = timeSlots.indexOf(value);
            const ei = timeSlots.indexOf(values.endTime);
            if (si < 0 || ei < 0) return false;
            return ei > si;
          },
        }),
        customRule('Selected time is already occupied for the room or teacher', {
          validate: (value, values) => {
            if (!value || !values?.day) return true;
            const day = String(values.day);
            const room = String(values.room || '').toLowerCase();
            const teacherCandidate =
              userRole === 'teacher'
                ? String(currentTeacherEmail || '').toLowerCase()
                : String(values.teacherEmail || '').toLowerCase();

            const hasClash = (existingSchedules || []).some((ev) => {
              if (!ev) return false;
              if (scheduleId && ev.id === scheduleId) return false;
              if (String(ev.day) !== day) return false;
              if (String(ev.time) !== String(value)) return false;
              const evRoom = String(ev.room || '').toLowerCase();
              const evTeacher = String(ev.teacherEmail || '').toLowerCase();
              const roomClash = room && evRoom && evRoom === room;
              const teacherClash = teacherCandidate && evTeacher && evTeacher === teacherCandidate;
              return roomClash || teacherClash;
            });

            return !hasClash;
          },
        }),
      ],
      endTime: [
        required('End time is required'),
        customRule('Select a valid end time', {
          validate: (value) => !value || timeSlots.includes(value),
        }),
        customRule('End time must be after start time', {
          validate: (value, values) => {
            if (!value || !values?.startTime) return true;
            const si = timeSlots.indexOf(values.startTime);
            const ei = timeSlots.indexOf(value);
            if (si < 0 || ei < 0) return false;
            return ei > si;
          },
        }),
      ],
    };
  }, [currentTeacherEmail, existingSchedules, scheduleId, timeSlots, userRole]);
  const { errors, validateFields, validateAll, resetErrors } = useFormValidator(validationSchema, {
    validateOnChange: false,
    validateOnBlur: true,
  });
  const derivedValidator = useMemo(() => createValidator(validationSchema), [validationSchema]);
  const aggregatedErrors = useMemo(
    () => derivedValidator.validateMany(Object.keys(validationSchema), form),
    [derivedValidator, form, validationSchema],
  );
  const disabled = Object.keys(aggregatedErrors).length > 0;
  const firstError = showAllErrors
    ? Object.values(errors)[0] || Object.values(aggregatedErrors)[0] || null
    : null;

  const setField = useCallback(
    (field, value) => {
      setForm((prev) => {
        const incoming = pickVal(value);
        if (prev[field] === incoming) return prev;
        const next = { ...prev, [field]: incoming };
        const touched = new Set([field]);
        if (['startTime', 'endTime', 'day', 'room', 'teacherEmail'].includes(field)) {
          touched.add('startTime');
          touched.add('endTime');
        }
        const toValidate = Array.from(touched).filter((name) => validationSchema[name]);
        if (toValidate.length) validateFields(toValidate, next);
        return next;
      });
    },
    [validateFields, validationSchema],
  );

  const handleFieldBlur = useCallback(
    (field) => () => {
      if (!validationSchema[field]) return;
      validateFields([field], form);
    },
    [form, validateFields, validationSchema],
  );

  const footerRef = useRef(null);
  const modalRef = useRef(null);
  const [footerH, setFooterH] = useState(64);

  const effectiveTeacherEmail = useMemo(() => {
    const raw = userRole === 'teacher' ? currentTeacherEmail : form.teacherEmail;
    return String(raw || '').toLowerCase();
  }, [form.teacherEmail, userRole, currentTeacherEmail]);

  const allowedCoursesSet = useMemo(() => {
    if (!teacherCourseMap || typeof teacherCourseMap.get !== 'function') return null;
    const set = teacherCourseMap.get(effectiveTeacherEmail);
    return set instanceof Set ? set : null;
  }, [teacherCourseMap, effectiveTeacherEmail]);

  const courses = useMemo(() => {
    const mapped = rawCourseOptions.map((o) => ({ value: toValue(o), label: toLabel(o), _meta: o?._meta || null }));
    if (!allowedCoursesSet || allowedCoursesSet.size === 0) return mapped;
    return mapped.filter((c) => allowedCoursesSet.has(String(c.value)));
  }, [rawCourseOptions, allowedCoursesSet]);

  useEffect(() => {
    if (!allowedCoursesSet || !form.subjectCode) return;
    if (!allowedCoursesSet.has(form.subjectCode)) {
      setField('subjectCode', '');
    }
  }, [allowedCoursesSet, form.subjectCode, setField]);

  useEffect(() => {
    if (!isOpen) return;
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height || el.offsetHeight || 64;
      setFooterH(h);
    });
    ro.observe(el);
    const onResize = () => setFooterH(el.offsetHeight || 64);
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen]);

  // Track if form has been initialized to avoid infinite loops
  const formInitializedRef = useRef(false);
  
  useEffect(() => {
    if (!isOpen) {
      formInitializedRef.current = false;
      return;
    }
    setShowAllErrors(false);
    resetErrors();

    if (scheduleData && mode !== 'create') {
      // For edit mode, use scheduleData values or fallback to currentTeacher
      let editProgram = scheduleData.program || '';
      if (!editProgram && currentTeacher?.program) {
        const teacherProgram = String(currentTeacher.program).trim();
        const programOption = programOptions.find(opt => String(opt.value).trim() === teacherProgram);
        if (programOption) {
          editProgram = programOption.value;
        }
      }
      
      setForm({
        subjectCode: scheduleData.courseCode || '',
        teacherEmail: scheduleData.teacherEmail || '',
        room: scheduleData.room || '',
        day: scheduleData.day || '',
        startTime: scheduleData.time || '',
        endTime: scheduleData.endTime || '',
        kind: scheduleData.kind || 'CL',
        classGroupKeys: Array.isArray(scheduleData.classGroupKeys) ? scheduleData.classGroupKeys : [],
        notes: scheduleData.notes || '',
        program: editProgram,
        faculty: scheduleData.faculty || currentTeacher?.faculty || ''
      });
      formInitializedRef.current = true;
      return;
    }
    
    // For create mode, only initialize once
    if (formInitializedRef.current && mode === 'create') return;
    
    // Use initial values directly instead of spreading initial object to avoid dependency issues
    // Set Faculty and Program from current teacher's profile as default values
    // Make sure to use currentTeacher values if available
    const defaultFaculty = scheduleData?.faculty || currentTeacher?.faculty || '';
    // For Program, make sure the value matches exactly one of the options
    let defaultProgram = scheduleData?.program || '';
    if (!defaultProgram && currentTeacher?.program) {
      const teacherProgram = String(currentTeacher.program).trim();
      // Check if teacher's program exists in options
      const programOption = programOptions.find(opt => String(opt.value).trim() === teacherProgram);
      if (programOption) {
        defaultProgram = programOption.value;
      }
    }
    
    setForm({
      subjectCode: '',
      teacherEmail: userRole === 'teacher' ? currentTeacherEmail || '' : '',
      room: '',
      day: scheduleData?.day || '',
      startTime: scheduleData?.time || '',
      endTime: scheduleData?.endTime || '',
      kind: scheduleData?.kind || 'CL',
      classGroupKeys: [],
      notes: '',
      program: defaultProgram,
      faculty: defaultFaculty
    });
    formInitializedRef.current = true;
  }, [isOpen, mode, resetErrors, scheduleData, userRole, currentTeacherEmail, currentTeacher, programOptions]);

  // Get available types from course TypeSk field (P+CL or S)
  const availableCourseTypes = useMemo(() => {
    if (!selectedCourse?._meta?.typeSk) {
      return []; // No types if no course selected
    }
    
    const typeSk = String(selectedCourse._meta.typeSk).trim();
    
    // P+CL allows both P and CL types
    if (typeSk === 'P+CL') {
      return ['P', 'CL'];
    }
    // S allows only S type
    if (typeSk === 'S') {
      return ['S'];
    }
    
    // Fallback: try to parse as individual types
    return typeSk.split('+').map(t => t.trim()).filter(Boolean);
  }, [selectedCourse]);

  // Build KIND_OPTIONS dynamically based on available types
  const availableKindOptions = useMemo(() => {
    const allOptions = [
      { value: 'P', label: 'Lecture (P)' },
      { value: 'CL', label: 'Lab / Class (CL)' },
      { value: 'S', label: 'Seminar (S)' },
    ];
    
    if (availableCourseTypes.length === 0) {
      return [{ value: '', label: 'Select a course first', disabled: true }];
    }
    
    return allOptions.filter(opt => availableCourseTypes.includes(opt.value));
  }, [availableCourseTypes]);

  // Check if selected type is available
  const isTypeAvailable = availableCourseTypes.includes(form.kind);

  // Auto-select first available type when course changes
  const prevSubjectCodeRef = useRef(null);
  
  useEffect(() => {
    if (!isOpen || mode !== 'create') {
      prevSubjectCodeRef.current = null;
      return;
    }
    
    // Only update when course actually changes
    if (form.subjectCode !== prevSubjectCodeRef.current) {
      prevSubjectCodeRef.current = form.subjectCode;
      
      if (form.subjectCode && availableCourseTypes.length > 0) {
        // Auto-select first available type
        setField('kind', availableCourseTypes[0]);
      }
    }
  }, [form.subjectCode, availableCourseTypes, isOpen, mode, setField]);

  // Set default Faculty and Program from current teacher when currentTeacher becomes available after form init
  // Use ref to track if we've already updated to avoid infinite loops
  const hasUpdatedFromTeacherRef = useRef(false);
  
  useEffect(() => {
    if (!isOpen || mode !== 'create') {
      hasUpdatedFromTeacherRef.current = false;
      return;
    }
    if (!formInitializedRef.current || hasUpdatedFromTeacherRef.current) return;
    if (!currentTeacher) return;
    
    // Mark as updated immediately to prevent any re-runs
    hasUpdatedFromTeacherRef.current = true;
    
    // Only update if form values are empty and teacher has values
    // For teachers: always set faculty from profile (cannot be changed)
    setForm((prev) => {
      const updates = {};
      // Set faculty if empty and teacher has it, or if user is teacher (force update)
      if (userRole === 'teacher' && currentTeacher.faculty) {
        // For teachers: always use teacher's faculty, cannot be changed
        updates.faculty = currentTeacher.faculty;
      } else if (!prev.faculty && currentTeacher.faculty) {
        // Only set if empty
        updates.faculty = currentTeacher.faculty;
      }
      // Set program if empty and teacher has it - make sure value matches option exactly
      if (!prev.program && currentTeacher.program) {
        const programValue = String(currentTeacher.program).trim();
        const programOption = programOptions.find(opt => String(opt.value).trim() === programValue);
        if (programOption) {
          updates.program = programOption.value;
        }
      }
      // Only update if we have updates to apply
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [isOpen, mode, currentTeacher, programOptions, userRole]);

  const startIdx = useMemo(() => {
    const idx = timeSlots.indexOf(form.startTime);
    return idx >= 0 ? idx : -1;
  }, [form.startTime, timeSlots]);

  const allowedEndTimes = useMemo(() => {
    if (startIdx < 0 || startIdx >= timeSlots.length - 1) {
      // If no start time selected or start time is the last slot, return all except first
      return timeSlots.length > 1 ? timeSlots.slice(1) : [];
    }
    // Return all slots after the start time
    return timeSlots.slice(startIdx + 1);
  }, [startIdx, timeSlots]);

  // Memoize the first allowed end time to avoid unnecessary re-renders
  const firstAllowedEndTime = useMemo(() => allowedEndTimes[0] || '', [allowedEndTimes]);

  useEffect(() => {
    if (!form.startTime || startIdx < 0) {
      // If no valid start time, clear end time
      if (form.endTime) {
        setForm((prev) => (prev.endTime ? { ...prev, endTime: '' } : prev));
      }
      return;
    }
    const endIndex = timeSlots.indexOf(form.endTime);
    // If end time is invalid (not in allowed list or before/equal to start)
    if (endIndex < 0 || endIndex <= startIdx || !allowedEndTimes.includes(form.endTime)) {
      if (firstAllowedEndTime && form.endTime !== firstAllowedEndTime) {
        setForm((prev) => ({ ...prev, endTime: firstAllowedEndTime }));
      } else if (!firstAllowedEndTime && form.endTime) {
        // No valid end time available, clear it
        setForm((prev) => ({ ...prev, endTime: '' }));
      }
    }
  }, [firstAllowedEndTime, form.endTime, form.startTime, startIdx, timeSlots, allowedEndTimes]);

  const handleSave = async () => {
    setShowAllErrors(true);
    // Additional validation for CL type: must have at least one class group
    if (form.kind === 'CL' && (!Array.isArray(form.classGroupKeys) || form.classGroupKeys.length === 0)) {
      guardedNotify('schedule-modal-validation-cl', 'error', 'At least one class group is required for CL type', { title: 'Validation error' });
      return;
    }
    if (!validateAll(form)) {
      guardedNotify('schedule-modal-validation', 'error', 'Please fix validation errors', { title: 'Validation failed' });
      return;
    }
    const courseMeta = selectedCourse?._meta || null;
    const subjectName = courseMeta?.nameEn || courseMeta?.nameSk || form.subjectCode;

    const teacherEmailValue =
      userRole === 'teacher' ? currentTeacherEmail || '' : form.teacherEmail || '';
    const teacherLabel =
        teacherOptions.find((t) => String(t.value).toLowerCase() === String(teacherEmailValue || '').toLowerCase())?.label ||
        currentTeacherName ||
        '';

    const payload = {
      id: scheduleData?.id || String(Date.now()),
      subject: subjectName,
      courseCode: form.subjectCode || null,
      teacher: userRole === 'teacher' ? currentTeacherName || teacherLabel || '—' : teacherLabel || '—',
      teacherEmail: teacherEmailValue,
      room: form.room || '',
      day: form.day || '',
      time: form.startTime || '',
      endTime: form.endTime || '',
      kind: form.kind || 'CL',
      classGroupKeys: Array.isArray(form.classGroupKeys) ? form.classGroupKeys.filter(Boolean) : [],
      notes: '', // Notes removed from form - can be added later if needed
      hasConflict: false,
      // Get faculty and program from selected course
      program: courseProgram || undefined,
      faculty: courseFaculty || undefined
    };

    try {
      if (onSave && typeof onSave === 'function') {
        console.log('[ScheduleModal] Calling onSave with payload:', payload);
        const result = onSave(payload);
        if (result && typeof result.then === 'function') {
          await result;
        }
      }
      // Modal will be closed by handleScheduleSave after successful save
      // Only close here if onSave is not async or doesn't handle closing
      if (!onSave || typeof onSave !== 'function') {
        onClose?.();
      }
    } catch (error) {
      // Error handling is done in handleScheduleSave, but we can show a fallback here
      console.error('[ScheduleModal] Save error:', error);
      guardedNotify('schedule-modal-save-error', 'error', 'Failed to save class', { title: 'Save failed' });
    }
  };

  // All hooks must be called before any conditional returns
  const { notify } = useToasts();
  const toastLocks = useRef({});
  const guardedNotify = useCallback((key, type, message, opts = {}) => {
    if (key) {
      const now = Date.now();
      const lock = opts.lockMs ?? 2600;
      const prev = toastLocks.current[key] ?? 0;
      if (now - prev < lock) return;
      toastLocks.current[key] = now;
    }
    notify(type, message, opts);
  }, [notify]);

  if (!isOpen) return null;

  const modalTitle = mode === 'edit' ? 'Edit Class' : mode === 'view' ? 'Class Details' : 'Create New Class';
  const readOnly = mode === 'view' || userRole !== 'teacher';
  const canDelete = !!scheduleData?.id && userRole === 'teacher' && (scheduleData?.enrollmentsCount || 0) === 0;

  return createPortal(
      <MotionConfig transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
        <div className="fixed inset-0 z-110 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-6 pb-24 text-center sm:block sm:p-0">
            <motion.div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />
            <motion.div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={modalTitle}
                className="relative inline-block w-full max-w-[800px] my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border"
                style={{ maxHeight: 'min(92svh, 860px)' }}
                initial={{ opacity: 0, y: 40, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
            >
          <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 sm:py-4.5 border-b border-border sticky top-0 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">{modalTitle}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="rounded-lg">
              <Icon name="X" size={20} />
            </Button>
          </div>

          <div
              className="px-5 sm:px-7 py-4 overflow-y-auto"
              style={{ maxHeight: 'calc(min(92svh, 860px) - 140px)', paddingBottom: `calc(${footerH}px + env(safe-area-inset-bottom))` }}
          >
            {readOnly ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailRow icon="BookOpen" label="Subject" value={`${scheduleData?.subject || '—'} — ${kindToLabel(scheduleData?.kind)}${scheduleData?.kind ? ` (${String(scheduleData.kind).toUpperCase()})` : ''}`} />
                    <DetailRow icon="User" label="Teacher" value={scheduleData?.teacher} />
                    <DetailRow icon="GraduationCap" label="Grade" value={scheduleData?.grade} />
                    <DetailRow icon="Building" label="Room" value={scheduleData?.room} />
                    <DetailRow icon="Calendar" label="Day" value={scheduleData?.day} />
                    <DetailRow icon="Clock" label="Time" value={`${scheduleData?.time} — ${scheduleData?.endTime}`} />
                    <DetailRow icon="Tag" label="Type" value={`${kindToLabel(scheduleData?.kind)}${scheduleData?.kind ? ` (${String(scheduleData.kind).toUpperCase()})` : ''}`} />
                  </div>
                  {!!scheduleData?.classGroupText && (
                      <div className="mt-1">
                        <div className="text-sm font-medium text-foreground mb-1">Groups</div>
                        <div className="text-sm text-muted-foreground">{scheduleData.classGroupText}</div>
                      </div>
                  )}
                  {!!scheduleData?.notes && (
                      <div className="mt-1">
                        <div className="text-sm font-medium text-foreground mb-1">Notes</div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{scheduleData.notes}</div>
                      </div>
                  )}
                </div>
            ) : (
                <>
                  {firstError && (
                      <div className="mb-4 p-3 rounded-md border border-error/20 bg-error/10 text-error text-sm">{firstError}</div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                    <Select
                        label="Course"
                        options={courses.map((c) => ({ value: c.value, label: c.label }))}
                        value={form.subjectCode}
                        onChange={(v) => setField('subjectCode', v)}
                        onBlur={handleFieldBlur('subjectCode')}
                        searchable
                        required
                        error={errors.subjectCode}
                    />
                    <div>
                      <Select
                          label="Type"
                          options={availableKindOptions}
                          value={form.kind}
                          onChange={(v) => setField('kind', v)}
                          searchable={false}
                          disabled={!form.subjectCode || availableKindOptions.length === 0}
                          required
                      />
                      {form.subjectCode && availableCourseTypes.length > 0 && (
                        <div className="mt-2 flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <Icon name="Info" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-500">
                            Available types for this course: {availableCourseTypes.join(', ')}
                          </div>
                        </div>
                      )}
                      {form.subjectCode && availableCourseTypes.length === 0 && (
                        <div className="mt-2 flex items-start gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg">
                          <Icon name="AlertTriangle" size={14} className="text-warning mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-warning">
                            Course has no type defined. Please update course in Resource Management.
                          </div>
                        </div>
                      )}
                    </div>
                    <Select
                        label="Teacher"
                        options={teacherOptions}
                        value={form.teacherEmail}
                        onChange={(v) => setField('teacherEmail', v)}
                        onBlur={handleFieldBlur('teacherEmail')}
                        searchable
                        disabled={userRole === 'teacher'}
                        required={userRole !== 'teacher'}
                        error={errors.teacherEmail}
                    />
                    <Select
                        label="Room"
                        options={roomOptions}
                        value={form.room}
                        onChange={(v) => setField('room', v)}
                        onBlur={handleFieldBlur('room')}
                        searchable
                        required
                        error={errors.room}
                    />
                    <Select
                        label="Day"
                        options={dayOptions}
                        value={form.day}
                        onChange={(v) => setField('day', v)}
                        onBlur={handleFieldBlur('day')}
                        required
                        error={errors.day}
                    />
                    <Select
                        label="Start Time"
                        options={timeOptionsAll}
                        value={form.startTime}
                        onChange={(v) => setField('startTime', v)}
                        onBlur={handleFieldBlur('startTime')}
                        required
                        error={errors.startTime}
                    />
                    <Select
                        label="End Time"
                        options={ensureOptions(allowedEndTimes.length > 0 ? allowedEndTimes : timeSlots.slice(1))}
                        value={allowedEndTimes.includes(form.endTime) ? form.endTime : (allowedEndTimes[0] || '')}
                        onChange={(v) => setField('endTime', v)}
                        onBlur={handleFieldBlur('endTime')}
                        required
                        error={errors.endTime}
                        disabled={!form.startTime || allowedEndTimes.length === 0}
                    />
                    {form.kind === 'CL' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Class Groups <span className="text-muted-foreground">(required for CL)</span>
                        </label>
                        
                        {classGroupOptions.length === 0 ? (
                          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
                            <Icon name="Users" size={24} className="text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground mb-1">No class groups available</p>
                            <p className="text-xs text-muted-foreground">
                              Please create class groups in the "Class Groups" tab before scheduling CL classes.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {classGroupOptions.map((opt) => {
                                const isSelected = Array.isArray(form.classGroupKeys) && form.classGroupKeys.includes(opt.value);
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      const current = Array.isArray(form.classGroupKeys) ? form.classGroupKeys : [];
                                      const updated = isSelected
                                        ? current.filter((k) => k !== opt.value)
                                        : [...current, opt.value];
                                      setField('classGroupKeys', updated);
                                    }}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-card text-foreground border-border hover:bg-muted'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                            {Array.isArray(form.classGroupKeys) && form.classGroupKeys.length === 0 && form.kind === 'CL' && (
                              <p className="text-xs text-error mt-1">At least one class group is required for CL type</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
            )}
          </div>

          <div ref={footerRef} className="px-5 sm:px-7 py-4 sm:py-5 border-t border-border sticky bottom-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
            {readOnly ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {scheduleData?.enrollmentsCount > 0 && (
                      <span>Students enrolled: {scheduleData.enrollmentsCount}. Deletion disabled.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {canDelete && (
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          if (typeof onDelete === 'function') {
                            const result = onDelete(scheduleData);
                            if (result && typeof result.then === 'function') {
                              await result;
                            }
                            // Toast will be shown by handleScheduleDelete
                          }
                        }}
                        className="h-12 px-6 rounded-xl text-base sm:min-w-[140px]"
                        iconName="Trash2"
                      >
                        Delete
                      </Button>
                    )}
                    <Button variant="outline" onClick={onClose} className="h-12 px-6 rounded-xl text-base sm:min-w-[140px]">
                      Close
                    </Button>
                  </div>
                </div>
            ) : (
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="outline" onClick={onClose} className="w-full h-12 px-6 rounded-xl text-base sm:w-auto sm:min-w-[160px]">
                    Cancel
                  </Button>
                  <Button
                      variant="default"
                      onClick={handleSave}
                      iconName="Save"
                      disabled={disabled}
                      className="w-full h-12 px-6 rounded-xl text-base sm:w-auto sm:min-w-[180px]"
                  >
                    {mode === 'create' ? 'Create Class' : 'Save Changes'}
                  </Button>
                </div>
            )}
          </div>
          </motion.div>
          </div>
        </div>
      </MotionConfig>,
      document.body
  );
};

const DetailRow = ({ icon, label, value }) => (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={14} className="mt-0.5 text-muted-foreground" />
      <div className="text-sm leading-5">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground">{value || '—'}</span>
      </div>
    </div>
);

export default ScheduleModal;