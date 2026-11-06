// src/pages/student-management/components/AddStudentModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useToasts } from '../../../components/ui/Toasts';
import { confirmEnrollment, fetchFaculty, fetchCourses, fetchDistinctPrograms } from '../../../data/maisApiAdapter';
import { getCurrentSemester } from '../../../utils/semesterUtils';
import {
  createValidator,
  before,
  date as dateRule,
  email as emailRule,
  maxLength as maxLengthRule,
  minLength as minLengthRule,
  phone as phoneRule,
  required,
  useFormValidator,
} from '../../../utils/validation';

const STUDENT_DRAFT_KEY = 'mais:student-management:add-student-draft';

const asString = (v) =>
    typeof v === 'string' ? v : (v && typeof v === 'object' && 'value' in v ? String(v.value) : String(v ?? ''));

// Only fields that actually surface in Profile
const INITIAL_FORM = {
  // Basic & enrolment
  firstName: '',
  lastName: '',
  gradeKey: '',
  sectionKey: '',
  selectedSubjects: [], // Array of course codes for auto-enrollment
  faculty: '',
  program: '',

  // Identifiers (student.* in Profile)
  isicCardNumber: '',
  studentNumber: '',
  studyNumber: '',
  passportId: '',

  // Contacts (Profile top-level + Student Contacts)
  email: '',
  phone: '',
  phone2: '',
  altEmail: '',
  parentName: '',
  about: '',

  // Personal details (Student -> Personal Details)
  birthDate: '',
  birthPlace: '',
  nationality: '',
  familyStatus: '',
  healthStatus: '',
  address: '',

  // Consent & Status
  consentPersonalData: false,
  consentCompanyOffers: false,
  status: 'active',
};

const STEPS = [
  { id: 1, title: 'Basic & Enrolment', short: 'Basic', icon: 'User' },
  { id: 2, title: 'Student Identifiers', short: 'IDs', icon: 'BookOpen' },
  { id: 3, title: 'Contacts & Personal', short: 'Contacts', icon: 'Phone' },
];

const STUDENT_VALIDATION_SCHEMA = {
  firstName: [required('First name is required'), minLengthRule('Must be at least 2 characters', { length: 2 })],
  lastName: [required('Last name is required'), minLengthRule('Must be at least 2 characters', { length: 2 })],
  gradeKey: [], // Term feature not implemented yet - optional
  faculty: [], // Optional - student can enroll manually
  program: [], // Optional - student can enroll manually
  sectionKey: [],
  isicCardNumber: [maxLengthRule('Cannot exceed 32 characters', { length: 32 })],
  studentNumber: [maxLengthRule('Cannot exceed 32 characters', { length: 32 })],
  studyNumber: [maxLengthRule('Cannot exceed 32 characters', { length: 32 })],
  passportId: [maxLengthRule('Cannot exceed 32 characters', { length: 32 })],
  email: [required('Email is required'), emailRule('Enter a valid email address')],
  altEmail: [emailRule('Enter a valid alternate email')],
  phone: [phoneRule('Enter a valid phone number')],
  phone2: [phoneRule('Enter a valid secondary phone')],
  birthDate: [
    required('Birth date is required'),
    dateRule('Enter a valid date'),
    before('Birth date must be before today', { value: () => new Date(), label: 'today' }),
  ],
  address: [required('Permanent address is required'), minLengthRule('Address should include more detail', { length: 5 })],
  birthPlace: [maxLengthRule('Cannot exceed 120 characters', { length: 120 })],
  nationality: [maxLengthRule('Cannot exceed 120 characters', { length: 120 })],
  familyStatus: [maxLengthRule('Cannot exceed 160 characters', { length: 160 })],
  healthStatus: [maxLengthRule('Cannot exceed 160 characters', { length: 160 })],
  parentName: [maxLengthRule('Cannot exceed 160 characters', { length: 160 })],
  about: [maxLengthRule('Cannot exceed 500 characters', { length: 500 })],
};

const STEP_FIELDS = {
  1: ['firstName', 'lastName', 'gradeKey', 'sectionKey'],
  2: ['isicCardNumber', 'studentNumber', 'studyNumber', 'passportId'],
  3: [
    'email',
    'altEmail',
    'phone',
    'phone2',
    'birthDate',
    'address',
    'birthPlace',
    'nationality',
    'familyStatus',
    'healthStatus',
    'parentName',
    'about',
  ],
};

const makeStudentCode = ({ email = '', fullName = '', year = '' }) => {
  const base = (fullName || email.split('@')[0] || 'student')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const yearTag = String(year).replace(/\D+/g, '').slice(0, 4) || new Date().getFullYear();
  const salt = String(Date.now()).slice(-5);
  return `${base}-${yearTag}-${salt}`;
};

const AddStudentModal = ({
                           isOpen,
                           onClose = () => {},
                           onSave = (_student) => {},
                           onImport = (_list, _strategy) => {},
                           classGroupOptions = [],
                           allCourses = [],
                           allScheduleEvents = [],
                         }) => {
  const [mode, setMode] = useState('single');
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const { errors, validateFields, validateAll, resetErrors } = useFormValidator(STUDENT_VALIDATION_SCHEMA, {
    validateOnChange: false,
    validateOnBlur: true,
  });
  const [rawJson, setRawJson] = useState('');
  const [parsed, setParsed] = useState([]);
  const [parseError, setParseError] = useState('');
  const [importStrategy, setImportStrategy] = useState('skip');
  const [defaultTerm, setDefaultTerm] = useState('');
  const [defaultClass, setDefaultClass] = useState('');
  const fileInputRef = useRef(null);
  const [autoAssignIds, setAutoAssignIds] = useState(true);
  const [autoGenerateCodes, setAutoGenerateCodes] = useState(true);
  const [autoFillNamesFromEmail, setAutoFillNamesFromEmail] = useState(true);
  const [preferRowTermClass, setPreferRowTermClass] = useState(true);
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]); // All programs from API
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draftSaveTimerRef = useRef(null);
  const { notify } = useToasts();
  const toastLocks = useRef({});
  const guardedNotify = useCallback((key, type, message, opts = {}) => {
    if (key) {
      const now = Date.now();
      const lock = opts.lockMs ?? 2800;
      const prev = toastLocks.current[key] ?? 0;
      if (now - prev < lock) return;
      toastLocks.current[key] = now;
    }
    notify(type, message, opts);
  }, [notify]);

  const NONE_CLASS_VALUE = '__none__';
  const termOptions = []; // Term feature is not implemented yet
  const validator = useMemo(() => createValidator(STUDENT_VALIDATION_SCHEMA), []);

  // Draft management functions
  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(STUDENT_DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.updatedAt) {
        return parsed;
      }
    } catch {
      // Invalid draft, ignore
    }
    return null;
  }, []);

  const saveDraft = useCallback((formData, stepNum) => {
    try {
      const draft = {
        form: formData,
        step: stepNum,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STUDENT_DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
    } catch {
      // localStorage full or unavailable
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STUDENT_DRAFT_KEY);
    } catch {
      // Ignore
    }
    setHasDraft(false);
  }, []);

  const handleSaveDraft = useCallback(() => {
    saveDraft(formData, currentStep);
    guardedNotify('student-draft-save', 'success', 'Draft saved', { title: 'Student draft' });
  }, [formData, currentStep, saveDraft, guardedNotify]);

  const handleRestoreDraft = useCallback((draft) => {
    if (!draft?.form) return;
    setFormData({ ...INITIAL_FORM, ...draft.form });
    if (draft.step && draft.step >= 1 && draft.step <= STEPS.length) {
      setCurrentStep(draft.step);
    }
    setDirty(true);
    guardedNotify('student-draft-restore', 'info', 'Draft restored', { title: 'Student draft' });
  }, [guardedNotify]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    guardedNotify('student-draft-discard', 'info', 'Draft discarded', { title: 'Student draft' });
  }, [clearDraft, guardedNotify]);

  // Auto-save draft on form changes (debounced)
  useEffect(() => {
    if (!isOpen || mode !== 'single') return;
    if (!dirty) return;
    
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      saveDraft(formData, currentStep);
    }, 2000); // Auto-save after 2 seconds of inactivity
    
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [isOpen, mode, dirty, formData, currentStep, saveDraft]);

  useEffect(() => {
    if (!isOpen) return;
    
    // Check for existing draft
    const existingDraft = loadDraft();
    const hasValidDraft = !!existingDraft?.updatedAt;
    setHasDraft(hasValidDraft);
    
    setMode('single');
    // If there's a draft, restore it; otherwise use initial form
    if (hasValidDraft && existingDraft?.form) {
      setFormData({ ...INITIAL_FORM, ...existingDraft.form });
      if (existingDraft.step >= 1 && existingDraft.step <= STEPS.length) {
        setCurrentStep(existingDraft.step);
      } else {
        setCurrentStep(1);
      }
      setDirty(true);
    } else {
      setCurrentStep(1);
      setFormData(() => ({ ...INITIAL_FORM }));
      setDirty(false);
    }
    resetErrors();
    setRawJson('');
    setParsed([]);
    setParseError('');
    setImportStrategy('skip');
    setDefaultTerm('');
    setDefaultClass('');
    setAutoAssignIds(true);
    setAutoGenerateCodes(true);
    setAutoFillNamesFromEmail(true);
    setPreferRowTermClass(true);
  }, [isOpen, loadDraft, resetErrors]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setOptionsError(null);
    setOptionsLoading(true);
    console.log('[AddStudentModal] Starting to load programs...');
    (async () => {
      try {
        const programsList = await fetchDistinctPrograms().catch((err) => {
          console.error('[AddStudentModal] Failed to fetch programs:', err);
          return [];
        });
        console.log('[AddStudentModal] Programs received:', programsList);
        if (cancelled) return;
        
        setAllPrograms(programsList || []);
        
        // Extract unique faculties from programs
        const facMap = new Map();
        (programsList || []).forEach((prog) => {
          const fac = String(prog?.faculty || '').trim();
          console.log('[AddStudentModal] Processing program:', { name: prog?.name, faculty: fac });
          if (!fac) return;
          if (!facMap.has(fac)) {
            facMap.set(fac, { value: fac, label: fac });
          }
        });
        const faculties = Array.from(facMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        console.log('[AddStudentModal] Extracted faculties:', faculties);
        setFacultyOptions(faculties);
      } catch (err) {
        console.error('[AddStudentModal] Error loading programs:', err);
        if (!cancelled) setOptionsError(err instanceof Error ? err.message : 'Failed to load programs');
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Program options filtered by selected faculty
  const programOptions = useMemo(() => {
    const selectedFaculty = String(formData?.faculty || '').trim();
    if (!selectedFaculty) return [];
    
    const filtered = (allPrograms || []).filter((prog) => {
      const progFac = String(prog?.faculty || '').trim();
      return progFac === selectedFaculty;
    });
    
    return filtered.map((prog) => ({
      value: String(prog?.name || ''),
      label: `${prog?.name || ''} (${prog?.level || ''} - ${prog?.awardedDegree || ''})`
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allPrograms, formData?.faculty]);

  // Check if course has available groups with free capacity
  const checkCourseAvailability = useCallback((courseCode) => {
    if (!courseCode || !allScheduleEvents || allScheduleEvents.length === 0) {
      return { hasCapacity: false, reason: 'No schedule events' };
    }
    
    const code = courseCode.toUpperCase();
    const courseEvents = allScheduleEvents.filter((e) => {
      const eventCode = String(e.courseCode || '').toUpperCase();
      const type = String(e.type || '').toUpperCase();
      return eventCode === code && type === 'CL'; // Class events
    });
    
    if (courseEvents.length === 0) {
      return { hasCapacity: false, reason: 'No class groups' };
    }
    
    // Check if any event has available capacity
    const hasAvailable = courseEvents.some((event) => {
      const capacity = event.capacity || 0;
      const enrolled = event.enrolledCount || 0;
      return capacity > enrolled;
    });
    
    if (!hasAvailable) {
      return { hasCapacity: false, reason: 'All groups full' };
    }
    
    return { hasCapacity: true, reason: 'Available' };
  }, [allScheduleEvents]);

  // Subject options from courses that have schedule events, filtered by selected Faculty and Program
  const subjectOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    
    const selectedFaculty = String(formData?.faculty || '').trim();
    const selectedProgram = String(formData?.program || '').trim();
    
    // Only show subjects if both faculty and program are selected
    if (!selectedFaculty || !selectedProgram) {
      return out;
    }
    
    // Get unique course codes from schedule events (only courses that have been created)
    const courseCodesWithEvents = new Set();
    (allScheduleEvents || []).forEach((event) => {
      const code = String(event.courseCode || '').toUpperCase();
      if (code) courseCodesWithEvents.add(code);
    });
    
    console.log('[AddStudentModal] Filtering courses:', {
      selectedFaculty,
      selectedProgram,
      totalCourses: allCourses?.length,
      coursesWithEvents: courseCodesWithEvents.size,
      sampleCourse: allCourses?.[0]
    });
    
    (allCourses || []).forEach((course) => {
      const code = String(course?.code || '').toUpperCase();
      if (!code || seen.has(code)) return;
      
      // CRITICAL: Only show courses that have schedule events with available groups
      if (!courseCodesWithEvents.has(code)) return;
      
      const courseFaculty = String(course?.faculty || '').trim();
      const courseProgram = String(course?.program || '').trim();
      
      // If Faculty is selected, course MUST have matching Faculty
      if (selectedFaculty) {
        if (!courseFaculty || courseFaculty.toUpperCase() !== selectedFaculty.toUpperCase()) {
          return; // Skip courses without faculty or with different faculty
        }
      }
      
      // If Program is selected, course MUST have matching Program
      if (selectedProgram) {
        if (!courseProgram || courseProgram.toUpperCase() !== selectedProgram.toUpperCase()) {
          return; // Skip courses without program or with different program
        }
      }
      
      // Only show courses that have both Faculty and Program if both are selected
      if (selectedFaculty && selectedProgram) {
        if (!courseFaculty || !courseProgram) {
          return; // Skip courses that don't have both Faculty and Program
        }
      }
      
      seen.add(code);
      const name = course?.nameEn || course?.nameSk || course?.name || code;
      
      // Check if there are available groups with free capacity
      const availability = checkCourseAvailability(code);
      const label = availability.hasCapacity 
        ? `${name} (${code})` 
        : `${name} (${code}) ⚠️ No free spots`;
      
      out.push({ 
        value: code, 
        label,
        disabled: !availability.hasCapacity,
        availability 
      });
    });
    return out;
  }, [allCourses, allScheduleEvents, formData?.faculty, formData?.program, checkCourseAvailability]);

  // Find available class group and schedule event for selected subject
  const findAvailableClassGroup = useCallback((courseCode) => {
    if (!courseCode || !allScheduleEvents || allScheduleEvents.length === 0) return { group: null, eventId: null };
    
    // Find CL (Class) events for this course with groups and available capacity
    const courseEvents = allScheduleEvents.filter((e) => {
      const code = String(e.courseCode || '').toUpperCase();
      const type = String(e.type || '').toUpperCase();
      return code === courseCode.toUpperCase() && type === 'CL';
    });
    
    // Find event with available capacity and class groups
    for (const event of courseEvents) {
      const classGroups = event.classGroupKeys || (Array.isArray(event.classGroupKeysJson) ? event.classGroupKeysJson : []);
      if (classGroups && classGroups.length > 0) {
        const capacity = event.capacity || 0;
        const enrollmentsCount = event.enrollmentsCount || 0;
        if (capacity === 0 || enrollmentsCount < capacity) {
          // Return first available group and event ID
          return { group: classGroups[0], eventId: event.id };
        }
      }
    }
    
    return { group: null, eventId: null };
  }, [allScheduleEvents]);

  // Find available groups for all selected subjects
  const findAvailableGroupsForSubjects = useCallback((courseCodes) => {
    if (!Array.isArray(courseCodes) || courseCodes.length === 0) return [];
    
    return courseCodes.map((code) => {
      const result = findAvailableClassGroup(code);
      return {
        courseCode: code,
        ...result,
      };
    }).filter((item) => item.group && item.eventId); // Only include subjects with available groups
  }, [findAvailableClassGroup]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (errors?.[field]) {
        validateFields([field], next);
      }
      return next;
    });
    setDirty(true);
  };

  const handleFieldBlur = useCallback(
    (field) => () => {
      validateFields([field], formData);
    },
    [formData, validateFields],
  );

  const validateStep = useCallback(
    (step, values = formData, { write = true } = {}) => {
      const fields = STEP_FIELDS[step] || [];
      if (!fields.length) return true;
      if (write) return validateFields(fields, values);
      const messages = validator.validateMany(fields, values);
      return Object.keys(messages).length === 0;
    },
    [formData, validateFields, validator],
  );

  const jumpTo = (sid) => {
    if (sid < currentStep || validateStep(currentStep)) {
      setCurrentStep(Math.min(Math.max(1, sid), STEPS.length));
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep((p) => Math.min(p + 1, STEPS.length));
  };

  const handlePrevious = () => setCurrentStep((p) => Math.max(p - 1, 1));

  const buildStudentObjectFromForm = () => {
  const fullName = `${formData?.firstName} ${formData?.lastName}`.trim();

    const termOpt = Array.isArray(termOptions)
        ? termOptions.find((o) => String(o.value) === String(formData?.gradeKey))
        : null;
    const classOpt = Array.isArray(classGroupOptions)
        ? classGroupOptions.find((o) => String(o.value) === String(formData?.sectionKey))
        : null;

    return {
      id: Date.now(),
      name: fullName,
      firstName: formData?.firstName || '',
      lastName: formData?.lastName || '',
  // No manual studentId: server will generate the unique Id

      // Enrolment
      grade: termOpt ? termOpt.label : '',
      gradeKey: formData?.gradeKey || '',
      section: classOpt ? classOpt.label : '',
      sectionKey: formData?.sectionKey || '',
      faculty: formData?.faculty || '',
      program: formData?.program || '',

      // Contacts (top-level present in Profile)
      email: formData?.email || '',
      phone: formData?.phone || '',
      phone2: formData?.phone2 || '',
      altEmail: formData?.altEmail || '',

      // For Student Profile (nested)
      student: {
        className: classOpt ? classOpt.label : '',
        isicCardNumber: formData?.isicCardNumber || '',
        studentNumber: formData?.studentNumber || '',
        studyNumber: formData?.studyNumber || '',
        passportId: formData?.passportId || '',
        birthDate: formData?.birthDate || '',
        birthPlace: formData?.birthPlace || '',
        nationality: formData?.nationality || '',
        familyStatus: formData?.familyStatus || '',
        healthStatus: formData?.healthStatus || '',
        address: formData?.address || '',
        parentName: formData?.parentName || '',
        consentPersonalData: formData?.consentPersonalData || false,
        consentCompanyOffers: formData?.consentCompanyOffers || false,
      },

      // Also keep some flattened fields commonly shown in lists
      address: formData?.address || '',
      dateOfBirth: formData?.birthDate || '',

      status: formData?.status || 'active',
      enrollmentDate: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      recentGrades: [],
      recentActivity: [],
    };
  };

  const handleSubmit = async () => {
    if (mode !== 'single') return;
    if (!validateStep(currentStep)) return;
    const orderedSteps = STEPS.map((step) => step.id);
    for (const step of orderedSteps) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }
    if (!validateAll(formData)) {
      guardedNotify('student-add-validation-error', 'error', 'Please fix validation errors', { title: 'Validation failed' });
      return;
    }
    const studentData = buildStudentObjectFromForm();
    
    // Add enrollment info if subjects are selected
    if (formData?.selectedSubjects && Array.isArray(formData.selectedSubjects) && formData.selectedSubjects.length > 0) {
      const enrollments = findAvailableGroupsForSubjects(formData.selectedSubjects);
      if (enrollments.length > 0) {
        studentData._autoEnroll = enrollments.map((item) => ({
          courseCode: item.courseCode,
          scheduleEventId: item.eventId,
          classGroup: item.group,
        }));
        // Use first group for className
        if (enrollments[0]?.group) {
          studentData._autoEnrollClassGroup = enrollments[0].group;
        }
      }
    }
    
    onSave(studentData);
    // Clear draft after successful save
    clearDraft();
    onClose();
    setTimeout(() => {
        guardedNotify('student-add-success', 'success', 'Student added successfully', { title: 'Success' });
    }, 100);
    setCurrentStep(1);
    setFormData(() => ({ ...INITIAL_FORM }));
    setDirty(false);
    resetErrors();
  };

  const lc = (s) => String(s || '').toLowerCase().trim();

  // Aliases we accept during import (only things that surface in Profile)
  const keyAliases = {
    firstName: ['firstname', 'first_name', 'first', 'givenname', 'given_name', 'fname'],
    lastName: ['lastname', 'last_name', 'surname', 'familyname', 'family_name', 'lname'],
    name: ['fullname', 'full_name', 'displayname', 'display_name', 'name'],

    email: ['email', 'emailaddress', 'email_address', 'mail'],
    phone: ['phone', 'phonenumber', 'phone_number', 'mobile', 'tel'],
    phone2: ['phone2', 'secondary_phone', 'alt_phone'],
    altEmail: ['altemail', 'alternate_email', 'personal_email'],

    studentId: ['studentid', 'student_id', 'sid', 'code', 'student_code', 'index', 'recordid'],

    gradeKey: ['gradekey', 'grade_key', 'grade', 'semester', 'yearterm', 'academic_year'],
    sectionKey: ['sectionkey', 'section_key', 'class', 'group', 'classgroup', 'class_group'],
    faculty: ['faculty', 'faculty_name', 'school'],
    program: ['program', 'programme', 'study_program', 'study_programme'],

    // identifiers
    isicCardNumber: ['isic', 'isic_card', 'isic_card_number'],
    studentNumber: ['studentnumber', 'student_number'],
    studyNumber: ['studynumber', 'study_number'],
    passportId: ['passport', 'passport_id', 'idcard', 'id_card'],

    // personal
    birthDate: ['birthdate', 'dateofbirth', 'date_of_birth', 'dob'],
    birthPlace: ['birthplace', 'birth_place'],
    nationality: ['nation', 'citizenship'],
    familyStatus: ['familystatus', 'family_status'],
    healthStatus: ['health', 'health_status'],
    address: ['address', 'permanent_address'],

    // contacts student-only
    parentName: ['parent', 'parentname', 'guardian', 'guardianname', 'guardian_name'],

    // consent & status
    consentPersonalData: ['consent_personal_data', 'consent_personal', 'consent_data', 'personal_consent'],
    consentCompanyOffers: ['consent_company_offers', 'consent_offers', 'company_consent', 'offers_consent'],
    status: ['status', 'state', 'student_status'],
  };

  const aliasToCanonical = (key) => {
    const l = lc(key);
    for (const can in keyAliases) {
      if (l === can) return can;
      if (keyAliases[can].includes(l)) return can;
    }
    return '';
  };

  const pick = (obj, paths = []) => {
    for (const p of paths) {
      const v = obj?.[p];
      if (v != null && v !== '') return v;
    }
    return undefined;
  };

  const smartSplitName = (fullName) => {
    const s = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!s) return { firstName: '', lastName: '' };
    const parts = s.split(' ');
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts.slice(-1)[0] };
  };

  const normalizeRow = (row) => {
    if (!row || typeof row !== 'object') return { error: 'Row is not an object' };

    const flat = {};
    Object.keys(row).forEach((k) => {
      const v = row[k];
      const c = aliasToCanonical(k) || k;
      if (typeof v === 'object' && v && !Array.isArray(v)) {
        Object.keys(v).forEach((kk) => {
          const cc = aliasToCanonical(kk) || kk;
          if (flat[cc] == null) flat[cc] = v[kk];
        });
      } else {
        if (flat[c] == null) flat[c] = v;
      }
    });

    let firstName = String(pick(flat, ['firstName']) ?? '').trim();
    let lastName = String(pick(flat, ['lastName']) ?? '').trim();
    const nameFromField = String(pick(flat, ['name']) ?? '').trim();

    if ((!firstName || !lastName) && nameFromField) {
      const s = smartSplitName(nameFromField);
      if (!firstName) firstName = s.firstName;
      if (!lastName) lastName = s.lastName;
    }

    const email = String(pick(flat, ['email']) ?? '').trim();
    if ((!firstName || !lastName) && autoFillNamesFromEmail && email) {
      const base = email.split('@')[0] || '';
      const cleaned = base.replace(/[._-]+/g, ' ').trim();
      const s = smartSplitName(cleaned);
      if (!firstName) firstName = s.firstName ? s.firstName[0].toUpperCase() + s.firstName.slice(1) : '';
      if (!lastName) lastName = s.lastName ? s.lastName[0].toUpperCase() + s.lastName.slice(1) : '';
    }

    const phone = String(pick(flat, ['phone']) ?? '').trim();
    const phone2 = String(pick(flat, ['phone2']) ?? '').trim();
    const altEmail = String(pick(flat, ['altEmail']) ?? '').trim();

  const studentIdRaw = String(pick(flat, ['studentId']) ?? '').trim();

    let gradeKey = String(pick(flat, ['gradeKey', 'academicYear', 'academic_year']) ?? '').trim();
    let sectionKey = String(pick(flat, ['sectionKey', 'class']) ?? '').trim();

    if (!gradeKey || !preferRowTermClass) gradeKey = defaultTerm || gradeKey;
    if (!sectionKey || !preferRowTermClass) sectionKey = defaultClass || sectionKey;

    const address = String(pick(flat, ['address']) ?? '').trim();

    const isicCardNumber = String(pick(flat, ['isicCardNumber']) ?? '').trim();
    const studentNumber = String(pick(flat, ['studentNumber']) ?? '').trim();
    const studyNumber = String(pick(flat, ['studyNumber']) ?? '').trim();
    const passportId = String(pick(flat, ['passportId']) ?? '').trim();

    const birthDate = String(pick(flat, ['birthDate']) ?? '').slice(0, 10);
    const birthPlace = String(pick(flat, ['birthPlace']) ?? '').trim();
    const nationality = String(pick(flat, ['nationality']) ?? '').trim();
    const familyStatus = String(pick(flat, ['familyStatus']) ?? '').trim();
    const healthStatus = String(pick(flat, ['healthStatus']) ?? '').trim();

    const parentName = String(pick(flat, ['parentName', 'guardian']) ?? '').trim();
    const about = String(pick(flat, ['about']) ?? '').trim();

    const faculty = String(pick(flat, ['faculty']) ?? '').trim();
    const program = String(pick(flat, ['program']) ?? '').trim();

    const consentPersonalData = typeof pick(flat, ['consentPersonalData']) === 'boolean' 
      ? pick(flat, ['consentPersonalData'])
      : (String(pick(flat, ['consentPersonalData']) ?? '').toLowerCase() === 'true');
    const consentCompanyOffers = typeof pick(flat, ['consentCompanyOffers']) === 'boolean'
      ? pick(flat, ['consentCompanyOffers'])
      : (String(pick(flat, ['consentCompanyOffers']) ?? '').toLowerCase() === 'true');
    const statusRaw = String(pick(flat, ['status']) ?? '').trim().toLowerCase();
    const status = ['active', 'inactive', 'suspended', 'graduated'].includes(statusRaw) ? statusRaw : 'active';

    const termOpt = Array.isArray(termOptions) ? termOptions.find((o) => String(o.value) === String(gradeKey)) : null;
    const classOpt = Array.isArray(classGroupOptions) ? classGroupOptions.find((o) => String(o.value) === String(sectionKey)) : null;

    const fullName = `${firstName} ${lastName}`.trim() || nameFromField || (email ? email.split('@')[0] : '').trim();

    let studentId = studentIdRaw; // accepted from imports only; server will still generate its own Id

    const id = autoAssignIds ? Date.now() + Math.floor(Math.random() * 1000000) : Date.now();

    const missing = [];
  if (!email) missing.push('email');
    if (!fullName) missing.push('name');
    if (!gradeKey) missing.push('term selection');

    if (missing.length) {
      return { error: `Missing ${missing.join(', ')}` };
    }

    return {
      id,
      name: fullName,
      firstName: firstName || '',
      lastName: lastName || '',
  // Keep optional studentId only for import preview; backend ignores it for Id generation
      email,
      phone,
      phone2,
      altEmail,

      grade: termOpt ? termOpt.label : '',
      gradeKey: gradeKey || '',
      section: classOpt ? classOpt.label : '',
      sectionKey: sectionKey || '',
      faculty: faculty || '',
      program: program || '',

      student: {
        className: classOpt ? classOpt.label : '',
        isicCardNumber,
        studentNumber,
        studyNumber,
        passportId,
        birthDate,
        birthPlace,
        nationality,
        familyStatus,
        healthStatus,
        address,
        parentName,
        about,
        consentPersonalData,
        consentCompanyOffers,
      },

      address,
      dateOfBirth: birthDate,

      status,
      enrollmentDate: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      recentGrades: [],
      recentActivity: [],
    };
  };

  const explodeContainerLike = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === 'object') {
      for (const k of ['students', 'data', 'items', 'rows', 'list', 'result', 'payload']) {
        if (Array.isArray(obj[k])) return obj[k];
      }
    }
    return [];
  };

  const handleFilePick = (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setRawJson(text);
    };
    reader.onerror = () => {
      const msg = 'Failed to read file';
      setParseError(msg);
      guardedNotify('student-import-read-error', 'error', msg, { title: 'File read error' });
    };
    reader.readAsText(f);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isOpen || mode !== 'import') return;
    if (!rawJson.trim()) {
      setParsed([]);
      setParseError('');
      return;
    }
    const tryParsers = [];
    tryParsers.push(() => {
      const obj = JSON.parse(rawJson);
      if (Array.isArray(obj)) return obj;
      const arr = explodeContainerLike(obj);
      if (arr.length) return arr;
      return [obj];
    });
    tryParsers.push(() => {
      const lines = rawJson.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const arr = [];
      for (const line of lines) {
        try {
          const o = JSON.parse(line);
          arr.push(o);
        } catch {
          return null;
        }
      }
      return arr.length ? arr : null;
    });
    let base = null;
    let lastErr = '';
    for (const fn of tryParsers) {
      try {
        const r = fn();
        if (r && Array.isArray(r)) {
          base = r;
          break;
        }
      } catch (e) {
        lastErr = String(e?.message || 'Unknown parse error');
      }
    }
    if (!base) {
      const msg = lastErr || 'Unable to parse JSON or NDJSON';
      setParseError(msg);
      guardedNotify('student-import-parse-error', 'error', msg, { title: 'Parse error' });
      setParsed([]);
      return;
    }
    const rows = base.map((row, idx) => {
      const normalized = normalizeRow(row);
      if (normalized && !normalized.error) {
        return { index: idx, selected: true, error: '', data: normalized, raw: row };
      }
      return { index: idx, selected: false, error: normalized?.error || 'Invalid row', data: null, raw: row };
    });
    setParsed(rows);
    setParseError('');
  }, [rawJson, mode, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const validRows = useMemo(() => parsed.filter((r) => r.data && !r.error), [parsed]);
  const validCount = useMemo(() => validRows.length, [validRows]);
  const invalidCount = useMemo(() => parsed.filter((r) => !r.data || r.error).length, [parsed]);
  const allValidSelected = useMemo(() => validRows.length > 0 && validRows.every((r) => r.selected), [validRows]);
  const someValidSelected = useMemo(
      () => validRows.some((r) => r.selected) && !allValidSelected,
      [validRows, allValidSelected]
  );

  const toggleSelectAll = (checked) => {
    setParsed((prev) => prev.map((r) => (r.data && !r.error ? { ...r, selected: checked } : r)));
  };

  const handleImport = () => {
    const chosen = parsed.filter((r) => r.selected && r.data && !r.error).map((r) => r.data);
    if (!chosen.length) {
      guardedNotify('student-import-empty', 'warning', 'No valid rows selected', { title: 'Import' });
      return;
    }
    onImport(chosen, importStrategy);
    setTimeout(() => {
        guardedNotify('student-import-success', 'success', `Imported ${chosen.length} student${chosen.length > 1 ? 's' : ''}`, { title: 'Import successful' });
    }, 100);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <Input
                    label="First Name"
                    required
                    value={formData?.firstName || ''}
                    onChange={(e) => handleInputChange('firstName', e?.target?.value)}
                    onBlur={handleFieldBlur('firstName')}
                    error={errors?.firstName}
                />
                <Input
                    label="Last Name"
                    required
                    value={formData?.lastName || ''}
                    onChange={(e) => handleInputChange('lastName', e?.target?.value)}
                    onBlur={handleFieldBlur('lastName')}
                    error={errors?.lastName}
                />
        {/* Removed Student ID input: server generates Id automatically */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Term (MAIS)
                  </label>
                  <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm text-muted-foreground italic">
                      This feature is not implemented
                    </p>
                  </div>
                </div>
                <Select
                    label="Faculty"
                    options={[{ value: '', label: '— Select faculty —' }, ...facultyOptions]}
                    value={formData?.faculty || ''}
                    onChange={(v) => {
                      handleInputChange('faculty', asString(v));
                      handleInputChange('program', ''); // Clear program when faculty changes
                      handleInputChange('selectedSubjects', []);
                    }}
                    onBlur={handleFieldBlur('faculty')}
                    error={errors?.faculty || optionsError}
                    disabled={optionsLoading}
                    clearable={false}
                />
                <Select
                    label="Program"
                    options={[{ value: '', label: '— Select program —' }, ...programOptions]}
                    value={formData?.program || ''}
                    onChange={(v) => {
                      handleInputChange('program', asString(v));
                      handleInputChange('selectedSubjects', []);
                    }}
                    onBlur={handleFieldBlur('program')}
                    error={errors?.program || optionsError}
                    disabled={optionsLoading || !formData?.faculty}
                    placeholder={!formData?.faculty ? "Select Faculty first" : "Select program"}
                    clearable={false}
                />
                {!formData?.faculty || !formData?.program ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Subject (Auto-enrollment)
                    </label>
                    <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm text-muted-foreground italic">
                        Select Faculty and Program first
                      </p>
                    </div>
                  </div>
                ) : subjectOptions.length === 0 ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Subject (Auto-enrollment)
                    </label>
                    <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm text-muted-foreground italic">
                        No subjects available for selected Faculty and Program
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 To enable enrollment: Create a Class Group, then add Schedule Events for courses
                      </p>
                    </div>
                  </div>
                ) : (
                  <Select
                      label="Subject (Auto-enrollment)"
                      multiple={true}
                      options={subjectOptions || []}
                      value={formData?.selectedSubjects || []}
                      onChange={(v) => {
                        const selectedCodes = Array.isArray(v) ? v.map(asString).filter(Boolean) : [];
                        handleInputChange('selectedSubjects', selectedCodes);
                        // Auto-find available class group for first selected subject (for className)
                        if (selectedCodes.length > 0) {
                          const firstCode = selectedCodes[0];
                          const { group } = findAvailableClassGroup(firstCode);
                          if (group) {
                            handleInputChange('sectionKey', group);
                          }
                        } else {
                          handleInputChange('sectionKey', '');
                        }
                      }}
                      onBlur={handleFieldBlur('selectedSubjects')}
                      error={errors?.selectedSubjects}
                      clearable={true}
                      placeholder="Select subjects to auto-enroll"
                  />
                )}
              </div>
            </div>
        );
      case 2:
        return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <Input
                    label="ISIC Card Number"
                    value={formData?.isicCardNumber || ''}
                    onChange={(e) => handleInputChange('isicCardNumber', e?.target?.value)}
                    onBlur={handleFieldBlur('isicCardNumber')}
                    error={errors?.isicCardNumber}
                />
                <Input
                    label="Student Number"
                    value={formData?.studentNumber || ''}
                    onChange={(e) => handleInputChange('studentNumber', e?.target?.value)}
                    onBlur={handleFieldBlur('studentNumber')}
                    error={errors?.studentNumber}
                />
                <Input
                    label="Study Number"
                    value={formData?.studyNumber || ''}
                    onChange={(e) => handleInputChange('studyNumber', e?.target?.value)}
                    onBlur={handleFieldBlur('studyNumber')}
                    error={errors?.studyNumber}
                />
                <Input
                    label="Passport / ID"
                    value={formData?.passportId || ''}
                    onChange={(e) => handleInputChange('passportId', e?.target?.value)}
                    onBlur={handleFieldBlur('passportId')}
                    error={errors?.passportId}
                />
              </div>
            </div>
        );
      case 3:
        return (
            <div className="space-y-8">
              <div>
                <h4 className="text-base md:text-lg font-medium text-foreground mb-3 md:mb-4">Contacts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <Input
                      label="Email Address"
                      type="email"
                      required
                      value={formData?.email || ''}
                      onChange={(e) => handleInputChange('email', e?.target?.value)}
                      onBlur={handleFieldBlur('email')}
                      error={errors?.email}
                  />
                  <Input
                      label="Phone Number"
                      type="tel"
                      value={formData?.phone || ''}
                      onChange={(e) => handleInputChange('phone', e?.target?.value)}
                      onBlur={handleFieldBlur('phone')}
                      error={errors?.phone}
                  />
                  <Input
                      label="Secondary Phone"
                      type="tel"
                      value={formData?.phone2 || ''}
                      onChange={(e) => handleInputChange('phone2', e?.target?.value)}
                      onBlur={handleFieldBlur('phone2')}
                      error={errors?.phone2}
                  />
                  <Input
                      label="Personal Email"
                      type="email"
                      value={formData?.altEmail || ''}
                      onChange={(e) => handleInputChange('altEmail', e?.target?.value)}
                      onBlur={handleFieldBlur('altEmail')}
                      error={errors?.altEmail}
                  />
                  <Input
                      label="Parent / Guardian"
                      value={formData?.parentName || ''}
                      onChange={(e) => handleInputChange('parentName', e?.target?.value)}
                      onBlur={handleFieldBlur('parentName')}
                      error={errors?.parentName}
                      className="sm:col-span-2"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-base md:text-lg font-medium text-foreground mb-3 md:mb-4">Personal Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <Input
                      label="Birth Date"
                      type="date"
                      required
                      value={formData?.birthDate || ''}
                      onChange={(e) => handleInputChange('birthDate', e?.target?.value)}
                      onBlur={handleFieldBlur('birthDate')}
                      error={errors?.birthDate}
                  />
                  <Input
                      label="Birth Place"
                      value={formData?.birthPlace || ''}
                      onChange={(e) => handleInputChange('birthPlace', e?.target?.value)}
                      onBlur={handleFieldBlur('birthPlace')}
                      error={errors?.birthPlace}
                  />
                  <Input
                      label="Nationality"
                      value={formData?.nationality || ''}
                      onChange={(e) => handleInputChange('nationality', e?.target?.value)}
                      onBlur={handleFieldBlur('nationality')}
                      error={errors?.nationality}
                  />
                  <Input
                      label="Family Status"
                      value={formData?.familyStatus || ''}
                      onChange={(e) => handleInputChange('familyStatus', e?.target?.value)}
                      onBlur={handleFieldBlur('familyStatus')}
                      error={errors?.familyStatus}
                  />
                  <Input
                      label="Health Status"
                      value={formData?.healthStatus || ''}
                      onChange={(e) => handleInputChange('healthStatus', e?.target?.value)}
                      onBlur={handleFieldBlur('healthStatus')}
                      error={errors?.healthStatus}
                  />
                  <Input
                      label="Permanent Address"
                      required
                      value={formData?.address || ''}
                      onChange={(e) => handleInputChange('address', e?.target?.value)}
                      onBlur={handleFieldBlur('address')}
                      error={errors?.address}
                      className="sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1">About</label>
                    <textarea
                        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
                        value={formData?.about || ''}
                        onChange={(e) => handleInputChange('about', e?.target?.value)}
                        onBlur={handleFieldBlur('about')}
                        placeholder="Brief description about the student..."
                    />
                    {errors?.about && (
                      <p className="text-sm text-destructive mt-1">{errors.about}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base md:text-lg font-medium text-foreground mb-3 md:mb-4">Consent & Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                        checked={formData?.consentPersonalData || false}
                        onChange={(e) => handleInputChange('consentPersonalData', e?.target?.checked)}
                        id="consent-personal"
                    />
                    <label htmlFor="consent-personal" className="text-sm text-foreground cursor-pointer">
                      Consent to personal data processing
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                        checked={formData?.consentCompanyOffers || false}
                        onChange={(e) => handleInputChange('consentCompanyOffers', e?.target?.checked)}
                        id="consent-offers"
                    />
                    <label htmlFor="consent-offers" className="text-sm text-foreground cursor-pointer">
                      Consent to company offers
                    </label>
                  </div>
                  <Select
                      label="Status"
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                        { value: 'suspended', label: 'Suspended' },
                        { value: 'graduated', label: 'Graduated' },
                      ]}
                      value={formData?.status || 'active'}
                      onChange={(v) => handleInputChange('status', asString(v))}
                      onBlur={handleFieldBlur('status')}
                      error={errors?.status}
                      clearable={false}
                  />
                </div>
              </div>
            </div>
        );
      default:
        return null;
    }
  };

  const ImportRowCard = ({ r, idx }) => {
    const ok = r.data && !r.error;
    return (
        <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-2">
          <div className="flex items-start gap-2">
          <span data-stop-row="1">
            <Checkbox
                checked={!!r.selected && ok}
                onChange={(e) => {
                  const checked = !!e?.target?.checked;
                  setParsed((prev) => prev.map((row, i) => (i === idx ? { ...row, selected: checked } : row)));
                }}
                disabled={!ok}
                aria-label="Select row"
            />
          </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{ok ? r.data.name : '—'}</div>
              <div className={`text-xs ${ok ? 'text-muted-foreground' : 'text-red-600'}`}>
                {ok ? (r.raw?.name || r.raw?.firstName || r.raw?.lastName ? 'Mapped' : 'Derived') : r.error}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Email</div>
              <div className="truncate">{ok ? r.data.email || '—' : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Student ID</div>
              <div className="truncate">{ok ? r.data.studentId || '—' : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Term</div>
              <div className="truncate">{ok ? r.data.grade || r.data.gradeKey || '—' : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Class</div>
              <div className="truncate">{ok ? r.data.section || r.data.sectionKey || '—' : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Faculty</div>
              <div className="truncate">{ok ? r.data.faculty || '—' : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Program</div>
              <div className="truncate">{ok ? r.data.program || '—' : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Birth Date</div>
              <div className="truncate">{ok ? (r.data.student?.birthDate || r.data.dateOfBirth || '—') : '—'}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Status</div>
              <div className="truncate">{ok ? (r.data.status || 'active') : '—'}</div>
            </div>
            <div className="col-span-2">
            <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${
                    ok
                        ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-700 border border-red-500/30'
                }`}
            >
              {ok ? 'Valid' : 'Invalid'}
            </span>
            </div>
          </div>
        </div>
    );
  };

  const classFallbackOptions = useMemo(() => {
    const NONE_CLASS_VALUE = 'none-class';
    const opts = classGroupOptions.filter(o => o.value !== '' && o.value !== NONE_CLASS_VALUE);
    return [{ value: NONE_CLASS_VALUE, label: 'No Class (None)' }, ...opts];
  }, [classGroupOptions]);

  const renderImportContent = () => {
    return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Paste JSON array, object with a students list, or NDJSON. Supported keys: firstName/lastName/name, email,
                  phone/phone2, altEmail, studentId, birthDate, gradeKey/academicYear, sectionKey/class, faculty, program, address, isicCardNumber, studentNumber,
                  studyNumber, passportId, birthPlace, nationality, familyStatus, healthStatus, parentName, consentPersonalData, consentCompanyOffers, status.
                </div>
              </div>

              <Textarea
                  minRows={10}
                  resize="y"
                  textareaClassName="font-mono h-40 sm:h-48 md:h-56 thin-scrollbar"
                  placeholder='[{"firstName":"Olena","lastName":"Koval","email":"olena.koval@example.com","gradeKey":"1-rok-2025-2026-ws","birthDate":"2003-05-12","address":"Letná 5, Košice"}]'
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.ndjson,.txt,application/json,text/plain"
                    onChange={handleFilePick}
                    hidden
                />
                <Button variant="outline" iconName="Upload" onClick={() => fileInputRef.current?.click()}>
                  Upload file
                </Button>

                <label className="inline-flex items-center gap-2 text-sm" data-stop-row="1">
                  <Checkbox
                      checked={autoFillNamesFromEmail}
                      onChange={(e) => setAutoFillNamesFromEmail(!!e?.target?.checked)}
                      aria-label="Names from email if missing"
                  />
                  <span className="text-muted-foreground">Names from email if missing</span>
                </label>

                <label className="inline-flex items-center gap-2 text-sm" data-stop-row="1">
                  <Checkbox
                      checked={autoGenerateCodes}
                      onChange={(e) => setAutoGenerateCodes(!!e?.target?.checked)}
                      aria-label="Auto-generate Student ID"
                  />
                  <span className="text-muted-foreground">Auto-generate Student ID</span>
                </label>

                <label className="inline-flex items-center gap-2 text-sm" data-stop-row="1">
                  <Checkbox
                      checked={autoAssignIds}
                      onChange={(e) => setAutoAssignIds(!!e?.target?.checked)}
                      aria-label="Auto-assign internal id"
                  />
                  <span className="text-muted-foreground">Auto-assign internal id</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <Select
                  label="Default Class (fallback)"
                  options={classFallbackOptions}
                  value={defaultClass ? defaultClass : NONE_CLASS_VALUE}
                  onChange={(v) => {
                    const s = asString(v);
                    setDefaultClass(s === NONE_CLASS_VALUE ? '' : s);
                  }}
              />

              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                    checked={preferRowTermClass}
                    onChange={(e) => setPreferRowTermClass(!!e?.target?.checked)}
                    aria-label="Prefer term/class from rows"
                    />
                <span className="text-muted-foreground">Prefer term/class from rows</span>
              </label>

              <div className="space-y-2">
                <label className="block text-sm font-medium">On conflict</label>
                <div className="w-full grid grid-cols-3 gap-2">
                  <Button
                      size="sm"
                      className="w-full"
                      variant={importStrategy === 'skip' ? 'default' : 'outline'}
                      onClick={() => setImportStrategy('skip')}
                  >
                    Skip
                  </Button>
                  <Button
                      size="sm"
                      className="w-full"
                      variant={importStrategy === 'update' ? 'default' : 'outline'}
                      onClick={() => setImportStrategy('update')}
                  >
                    Update
                  </Button>
                  <Button
                      size="sm"
                      className="w-full"
                      variant={importStrategy === 'duplicate' ? 'default' : 'outline'}
                      onClick={() => setImportStrategy('duplicate')}
                  >
                    Duplicate
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-border p-3 bg-muted/40">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    Parsed: <span className="font-medium">{parsed.length}</span>
                  </div>
                  <div className="text-green-600">
                    Valid: <span className="font-medium">{validCount}</span>
                  </div>
                  <div className="text-red-600 sm:col-span-1 col-span-2">
                    Invalid: <span className="font-medium">{invalidCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {parseError ? (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-700 px-3 py-2 text-sm">
                {parseError}
              </div>
          ) : null}

          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-3 py-2 gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2">
              <span data-stop-row="1">
                <Checkbox
                    checked={allValidSelected}
                    indeterminate={someValidSelected}
                    aria-checked={allValidSelected ? 'true' : someValidSelected ? 'mixed' : 'false'}
                    onChange={(e) => toggleSelectAll(!!e?.target?.checked)}
                    title={validCount === 0 ? 'No valid rows' : allValidSelected ? 'Deselect all valid' : 'Select all valid'}
                    disabled={validCount === 0}
                />
              </span>
                <span className="text-sm text-muted-foreground">Select all valid</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Selected: {validRows.filter((r) => r.selected).length} / {validCount}
              </div>
            </div>

            <div className="hidden md:block max-h-72 overflow-y-auto thin-scrollbar">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur z-10">
                  <tr className="text-left">
                    <th className="w-12 px-3 py-2">Sel</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Student ID</th>
                    <th className="px-3 py-2">Term</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Faculty</th>
                    <th className="px-3 py-2">Program</th>
                    <th className="px-3 py-2">Birth Date</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                  </thead>
                  <tbody>
                  {parsed.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                          No data
                        </td>
                      </tr>
                  ) : (
                      parsed.map((r, i) => {
                        const ok = r.data && !r.error;
                        return (
                            <tr key={`${r.index}-${i}`} className="border-t border-border/60">
                              <td className="px-3 py-2 align-top">
                            <span data-stop-row="1">
                              <Checkbox
                                  checked={!!r.selected && ok}
                                  onChange={(e) => {
                                    const checked = !!e?.target?.checked;
                                    setParsed((prev) =>
                                        prev.map((row, idx) => (idx === i ? { ...row, selected: checked } : row))
                                    );
                                  }}
                                  disabled={!ok}
                                  aria-label="Select row"
                              />
                            </span>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="font-medium truncate max-w-[240px]">{ok ? r.data.name : '—'}</div>
                                <div className={`text-xs ${ok ? 'text-muted-foreground' : 'text-red-600'}`}>
                                  {ok ? (r.raw?.name || r.raw?.firstName || r.raw?.lastName ? 'Mapped' : 'Derived') : r.error}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[240px]">{ok ? r.data.email || '—' : '—'}</div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[200px]">{ok ? r.data.studentId || '—' : '—'}</div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[200px]">{ok ? r.data.grade || r.data.gradeKey || '—' : '—'}</div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[160px]">
                                  {ok ? r.data.section || r.data.sectionKey || '—' : '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[160px]">
                                  {ok ? r.data.faculty || '—' : '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[160px]">
                                  {ok ? r.data.program || '—' : '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[160px]">
                                  {ok ? r.data.student?.birthDate || r.data.dateOfBirth || '—' : '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="truncate max-w-[120px]">
                                  {ok ? (r.data.status || 'active') : '—'}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top">
                            <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                                    ok
                                        ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                                        : 'bg-red-500/10 text-red-700 border border-red-500/30'
                                }`}
                            >
                              {ok ? 'Valid' : 'Invalid'}
                            </span>
                              </td>
                            </tr>
                        );
                      })
                  )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden max-h-80 overflow-y-auto p-2 space-y-2 thin-scrollbar">
              {parsed.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">No data</div>
              ) : (
                  parsed.map((r, i) => <ImportRowCard key={`${r.index}-${i}`} r={r} idx={i} />)
              )}
            </div>
          </div>
        </div>
    );
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-110 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-6 pb-24 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <div className="inline-block w-full max-w-[100vw] sm:max-w-5xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-b border-border sticky top-0 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">Add New Student</h3>
              <div className="flex items-center justify-between gap-2">
                <div
                    className="inline-flex rounded-md border border-border p-0.5 bg-muted/40 w-full sm:w-auto"
                    role="tablist"
                    aria-label="Mode"
                >
                  <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'single' ? 'true' : 'false'}
                      className={`px-3 py-1.5 text-sm rounded w-full sm:w-auto ${
                          mode === 'single' ? 'bg-card shadow-inner text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setMode('single')}
                      title="Single entry"
                  >
                    Single
                  </button>
                  <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'import' ? 'true' : 'false'}
                      className={`px-3 py-1.5 text-sm rounded w-full sm:w-auto ${
                          mode === 'import' ? 'bg-card shadow-inner text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setMode('import')}
                      title="Import JSON"
                  >
                    Import JSON
                  </button>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="shrink-0">
                  <Icon name="X" size={22} />
                </Button>
              </div>
            </div>

            {mode === 'single' ? (
                <>
                  <div className="px-4 sm:px-5 md:px-6 pt-3 pb-2 border-b border-border sticky top-[52px] sm:top-[64px] md:top-[72px] z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                    <div className="relative -mx-4 sm:mx-0">
                      <div className="overflow-x-auto px-4 sm:px-0" role="tablist" aria-label="Add student steps">
                        <div className="flex flex-nowrap sm:flex-wrap items-stretch gap-2.5 sm:gap-3 md:gap-4 min-w-max sm:min-w-0">
                          {STEPS.map((s, i) => {
                            const active = currentStep === s.id;
                            const done = currentStep > s.id;
                            const clickable = s.id <= currentStep || validateStep(currentStep, formData, { write: false });
                            return (
                                <div key={s.id} className="flex-none sm:flex-1 min-w-[160px] sm:min-w-0 flex items-center">
                                  <button
                                      type="button"
                                      onClick={() => clickable && jumpTo(s.id)}
                                      disabled={!clickable}
                                      className={`group w-full inline-flex items-center justify-center gap-2.5 md:gap-3 py-2 sm:py-2.5 md:py-3 ${
                                          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                      } ${!clickable ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      title={s.title}
                                      aria-current={active ? 'step' : undefined}
                                  >
                              <span
                                  className={`flex-shrink-0 w-8 h-8 rounded-full grid place-items-center border ${
                                      done || active
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : 'bg-muted text-muted-foreground border-border'
                                  }`}
                              >
                                {done ? <Icon name="Check" size={16} /> : <Icon name={s.icon} size={16} />}
                              </span>
                                    <span className="truncate text-sm md:text-base font-medium min-w-0">
                                <span className="sm:hidden">{s.short}</span>
                                <span className="hidden sm:inline">{s.title}</span>
                              </span>
                                  </button>
                                  {i < STEPS.length - 1 && (
                                      <div className="hidden md:block h-px bg-border w-10 mx-1 flex-shrink-0" aria-hidden="true" />
                                  )}
                                </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="pointer-events-none sm:hidden absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-card to-transparent" />
                      <div className="pointer-events-none sm:hidden absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-card to-transparent" />
                    </div>
                    <div className="h-1 md:h-1.5 bg-muted mt-3 rounded">
                      <div
                          className="h-full bg-primary rounded transition-all"
                          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 md:px-8 py-5 md:py-8 max-h-[68vh] sm:max-h-[66vh] overflow-y-auto thin-scrollbar">
                    {renderStepContent()}
                  </div>

                  <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                          Step {currentStep} of {STEPS.length}
                        </div>
                        {hasDraft && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30 text-xs">
                            <Icon name="Save" size={12} />
                            Draft saved
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:ml-auto md:pl-6 w-full sm:w-auto">
                        {hasDraft && (
                          <Button variant="ghost" size="sm" onClick={handleDiscardDraft} className="w-full sm:w-auto" title="Discard draft">
                            <Icon name="Trash2" size={14} className="mr-1" />
                            Discard
                          </Button>
                        )}
                        <Button variant="outline" onClick={handleSaveDraft} className="w-full sm:w-auto">
                          <Icon name="Save" size={14} className="mr-1" />
                          Save Draft
                        </Button>
                        {currentStep > 1 && (
                            <Button variant="outline" onClick={handlePrevious} className="w-full sm:w-auto">
                              Previous
                            </Button>
                        )}
                        {currentStep < STEPS.length ? (
                            <Button variant="default" onClick={handleNext} className="w-full sm:w-auto">
                              Next
                            </Button>
                        ) : (
                            <Button variant="default" onClick={handleSubmit} className="w-full sm:w-auto">
                              Add Student
                            </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
            ) : (
                <>
                  <div className="px-4 sm:px-6 md:px-8 py-5 md:py-8 max-h-[74vh] overflow-y-auto thin-scrollbar">
                    {renderImportContent()}
                  </div>
                  <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:items-center md:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {validRows.filter((r) => r.selected).length > 0
                            ? `Ready to import ${validRows.filter((r) => r.selected).length} student(s)`
                            : 'No valid rows selected'}
                        {invalidCount > 0 ? ` • Skipping ${invalidCount} invalid row(s)` : ''}
                      </div>
                      <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                          Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleImport}
                            disabled={validRows.filter((r) => r.selected).length === 0}
                            className="w-full sm:w-auto"
                        >
                          Import Selected
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
            )}
          </div>
        </div>
      </div>
  );
};

export default AddStudentModal;