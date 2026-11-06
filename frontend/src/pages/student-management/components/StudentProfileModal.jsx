// src/pages/student-management/components/StudentProfileModal.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import MultiSelect from '../../../components/ui/MultiSelect';
import Textarea from '../../../components/ui/Textarea';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useToasts } from '../../../components/ui/Toasts';
import {
  email as emailRule,
  minLength as minLengthRule,
  phone as phoneRule,
  required,
  date as dateRule,
  useFormValidator,
} from '../../../utils/validation';
import { getInitials } from '../../../utils/displayName';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchCourses, createEnrollmentForStudent, fetchStudentEnrollments, fetchClassGroups } from '../../../data/maisApiAdapter';
import { getUserActivities } from '../../../data/activitiesApi';
import { fetchFacultyOptions } from '../../../data/facultyOptionsApi';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { fetchPrograms } from '../../../data/programsApi';
import { fetchDepartments } from '../../../data/departmentsApi';

const PERSONAL_DATA_PDF = '/assets/docs/Osobny/SuhlasSoSpracovanimOsobnychUdajovAbsolventa.pdf';

const STUDENT_EDITABLE_FIELDS = new Set([
  'email',
  'phone',
  'phone2',
  'altEmail',
  'address',
  'consentPersonalData',
  'consentCompanyOffers',
]);

const SectionTitle = ({ children, right }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
      <h3 className="text-base font-semibold text-foreground">{children}</h3>
      {right}
    </div>
);

const Row = ({ children }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;

const ReadField = ({ label, value, mono = false }) => (
    <div className="min-w-0">
      <label className="block text-sm text-muted-foreground">{label}</label>
      <div className={`text-sm text-foreground truncate ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</div>
    </div>
);

// ———————————————————————————————————————————————————————————————
// Sync with Profile (ProfilePage/ProfileHeader)
// ———————————————————————————————————————————————————————————————

const PROFILE_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'phone2',
  'altEmail',
  'location',
  'role',
  'about',
  'department',
  'subjects',
  'yearsExperience',
  'faculty',
  'program',
];

const STUDENT_KEYS = [
  'className',
  'parentName',
  'isicCardNumber',
  'studentNumber',
  'studyNumber',
  'studyYear',
  'birthDate',
  'birthPlace',
  'nationality',
  'passportId',
  'familyStatus',
  'healthStatus',
  'address',
  'about',
  'awardedDegree',
  'enrollmentDate',
  'programLevel',
  'consentPersonalData',
  'consentCompanyOffers',
];

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k];
    } else if (obj) {
      // Try PascalCase version (API might return PascalCase)
      const pascalKey = k.charAt(0).toUpperCase() + k.slice(1);
      if (Object.prototype.hasOwnProperty.call(obj, pascalKey)) {
        out[k] = obj[pascalKey];
      }
    }
  });
  return out;
}

// Helper to convert camelCase to PascalCase (e.g., "isicCardNumber" -> "IsicCardNumber")
function toPascalCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper to get value from object with case-insensitive key matching
function getValue(obj, key) {
  if (!obj) return undefined;
  // Try exact match first (camelCase)
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  // Try PascalCase (e.g., "className" -> "ClassName", "isicCardNumber" -> "IsicCardNumber")
  const pascalKey = toPascalCase(key);
  if (Object.prototype.hasOwnProperty.call(obj, pascalKey)) return obj[pascalKey];
  // Try all keys case-insensitively
  const lowerKey = key.toLowerCase();
  for (const objKey in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, objKey) && objKey.toLowerCase() === lowerKey) {
      return obj[objKey];
    }
  }
  return undefined;
}

function normalizeProfileShape(p = {}) {
  // Map API fields to form fields (handle both camelCase and PascalCase)
  const mapped = {
    ...p,
    firstName: p.firstName || p.FirstName || p.givenName || p.GivenName || '',
    lastName: p.lastName || p.LastName || p.familyName || p.FamilyName || '',
    faculty: p.faculty || p.Faculty || '',
    program: p.program || p.Program || '',
    degree: p.degree || p.Degree || '',
    phone: p.phone || p.Phone || '',
    phone2: p.phone2 || p.Phone2 || '',
    altEmail: p.altEmail || p.AltEmail || '',
    address: p.address || p.Address || '',
    location: p.location || p.Location || p.address || p.Address || '',
  };
  
  // Extract student-specific fields from top level or nested student object
  const studentData = p.student || {};
  
  // Build student object with case-insensitive field matching
  // Priority: nested student object > top level p object
  const student = {};
  STUDENT_KEYS.forEach((key) => {
    const value = getValue(studentData, key) ?? getValue(p, key);
    if (value !== undefined && value !== null && value !== '') {
      student[key] = value;
    }
  });
  
  const top = pick(mapped, PROFILE_KEYS);
  return {
    ...top,
    subjects: Array.isArray(top.subjects) ? top.subjects : [],
    role: top.role || 'student',
    student,
  };
}

function mergeStudentIntoProfile(base = {}, incoming = {}) {
  // Map incoming API fields to form fields (handle both camelCase and PascalCase)
  const mappedIncoming = {
    ...incoming,
    firstName: incoming.firstName || incoming.FirstName || incoming.givenName || incoming.GivenName || base.firstName || '',
    lastName: incoming.lastName || incoming.LastName || incoming.familyName || incoming.FamilyName || base.lastName || '',
    phone: incoming.phone || incoming.Phone || base.phone || '',
    phone2: incoming.phone2 || incoming.Phone2 || base.phone2 || '',
    altEmail: incoming.altEmail || incoming.AltEmail || base.altEmail || '',
    address: incoming.address || incoming.Address || base.address || '',
  };
  
  // Pick only non-empty values from incoming to avoid overwriting base with empty strings
  const incomingPicked = pick(mappedIncoming, PROFILE_KEYS);
  const mergedTop = { ...base };
  
  // Only merge fields that have actual values (not empty strings)
  for (const key in incomingPicked) {
    if (incomingPicked[key] !== '' && incomingPicked[key] !== null && incomingPicked[key] !== undefined) {
      mergedTop[key] = incomingPicked[key];
    } else if (!(key in mergedTop)) {
      // If the key doesn't exist in base at all, set it to the incoming value (even if empty)
      mergedTop[key] = incomingPicked[key];
    }
  }
  
  // Extract student fields from both nested student object and top level with case-insensitive matching
  const incomingStudentData = incoming.student || {};
  const allIncomingStudent = {};
  STUDENT_KEYS.forEach((key) => {
    const value = getValue(incoming, key) ?? getValue(incomingStudentData, key);
    if (value !== undefined && value !== '' && value !== null) {
      allIncomingStudent[key] = value;
    }
  });
  
  const mergedStudent = { ...(base.student || {}), ...allIncomingStudent };
  return { ...mergedTop, student: mergedStudent };
}

function capitalize(s = '') {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
function deriveNameFromEmail(email = '') {
  const u = String(email).split('@')[0] || '';
  if (!u) return { firstName: '', lastName: '' };
  const parts = u.replace(/[._-]+/g, ' ').replace(/\+/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: capitalize(parts[0]), lastName: '' };
  return { firstName: capitalize(parts[0]), lastName: capitalize(parts.slice(1).join(' ')) };
}

// ——— pull the login display name (as-is, no capitalization) ———
function splitFullName(raw = '') {
  const parts = String(raw).trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
const normalizePlain = (s = '') =>
    String(s)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

function namesMismatchEmail(email = '', firstName = '', lastName = '') {
  const local = normalizePlain(email.split('@')[0] || '');
  const name = normalizePlain(`${firstName || ''} ${lastName || ''}`);
  if (!local || !name) return false;
  const tokens = name.split(' ').filter(Boolean);
  const hits = tokens.filter((t) => local.includes(t)).length;
  return hits < Math.ceil(tokens.length / 2);
}

function maybeFixNamesFromLoginFirst(next, loginFullName = '', shouldApplyFallback = true) {
  // Only apply loginFullName if we're viewing our own profile (shouldApplyFallback = true)
  // When teacher views student profile, shouldApplyFallback = false, so skip this logic
  const full = String(loginFullName || '').trim();
  if (full && shouldApplyFallback) {
    const pair = splitFullName(full); // keep exact casing from login
    if (!next.firstName && !next.lastName) return { ...next, ...pair };
    const current = `${next.firstName || ''} ${next.lastName || ''}`.trim();
    if (!current || normalizePlain(current) !== normalizePlain(full)) return { ...next, ...pair };
  }
  if (next?.email && ((!next.firstName && !next.lastName) || namesMismatchEmail(next.email, next.firstName, next.lastName))) {
    return { ...next, ...deriveNameFromEmail(next.email) };
  }
  return next;
}

const StudentProfileModal = ({
                               student,
                               isOpen,
                               onClose,
                               onSave,
                               canEdit = true,
                               viewerIsTeacher = false,
                               roleOptions = [
                                 { value: 'student', label: 'Student' },
                                 { value: 'teacher', label: 'Teacher' },
                               ],
                               privacy = false,
                               splitCSV = (s) => String(s || '').split(',').map((t) => t.trim()).filter(Boolean),
                             }) => {
  const { user, userProfile } = useAuth();

  const studentEmail = useMemo(() => {
    const raw =
        student?.email ||
        student?.userEmail ||
        student?.primaryEmail ||
        student?.personalEmail ||
        student?.student?.email ||
        '';
    return String(raw).toLowerCase();
  }, [student]);

  const activeEmail = (user?.email || '').toLowerCase();
  const shouldApplyLoginFallback = !student || !studentEmail || (activeEmail && studentEmail === activeEmail);

  const loginFullNameFallback = useMemo(
      () => (shouldApplyLoginFallback ? userProfile?.full_name || user?.full_name || '' : ''),
      [shouldApplyLoginFallback, user, userProfile],
  );
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [formData, setFormData] = useState(() => {
    const fromProp = normalizeProfileShape(student || {});
    const result = maybeFixNamesFromLoginFirst(fromProp, loginFullNameFallback, shouldApplyLoginFallback);
    return result;
  });
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [initialEnrolledCourses, setInitialEnrolledCourses] = useState([]); // Track originally enrolled courses
  const [enrolling, setEnrolling] = useState(false);
  const [activityData, setActivityData] = useState([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  
  // Use activities from NotificationsContext for general feed fallback
  const { activityFeed: globalActivityFeed = [] } = useNotifications() || {};
  
  const [faculties, setFaculties] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [classGroups, setClassGroups] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const { notify } = useToasts();

  const canEditField = useCallback(
      (key) => {
        if (!canEdit || !isEditing) return false;
        if (viewerIsTeacher) return true;
        return STUDENT_EDITABLE_FIELDS.has(key);
      },
      [canEdit, isEditing, viewerIsTeacher],
  );

  const PROFILE_VALIDATION_SCHEMA = useMemo(
      () => ({
        firstName: [required('First name is required'), minLengthRule('Must be at least 2 characters', { length: 2 })],
        lastName: [required('Last name is required'), minLengthRule('Must be at least 2 characters', { length: 2 })],
        email: [required('Email is required'), emailRule('Enter a valid email')],
        phone: [phoneRule('Enter a valid phone number')],
        phone2: [phoneRule('Enter a valid secondary phone')],
        altEmail: [emailRule('Enter a valid personal email')],
        'student.address': [
          required('Permanent address is required'),
          minLengthRule('Address should include more detail', { length: 5 }),
        ],
        'student.birthDate': [dateRule('Enter a valid birth date')],
      }),
      [],
  );

  const makeValidationValues = useCallback(
      (data) => ({
        firstName: data?.firstName ?? '',
        lastName: data?.lastName ?? '',
        email: data?.email ?? '',
        phone: data?.phone ?? '',
        phone2: data?.phone2 ?? '',
        altEmail: privacy ? '' : data?.altEmail ?? '',
        'student.address': data?.student?.address ?? data?.address ?? '',
        'student.birthDate': data?.student?.birthDate ?? '',
      }),
      [privacy],
  );

  const { errors, validateFields, resetErrors } = useFormValidator(PROFILE_VALIDATION_SCHEMA, {
    validateOnChange: false,
    validateOnBlur: true,
  });

  const collectFieldsForValidation = useCallback(() => {
    if (!isEditing) return [];
    const fields = [];
    if (canEditField('firstName')) fields.push('firstName');
    if (canEditField('lastName')) fields.push('lastName');
    if (canEditField('email') && !privacy) fields.push('email');
    if (canEditField('phone')) fields.push('phone');
    if (canEditField('phone2')) fields.push('phone2');
    if (canEditField('altEmail') && !privacy) fields.push('altEmail');
    if (canEditField('address')) fields.push('student.address');
    if (viewerIsTeacher) fields.push('student.birthDate');
    return fields;
  }, [canEditField, isEditing, privacy, viewerIsTeacher]);

  const firstError = useMemo(() => {
    if (!showAllErrors) return null;
    const fields = collectFieldsForValidation();
    for (const field of fields) {
      if (errors?.[field]) return errors[field];
    }
    return null;
  }, [collectFieldsForValidation, errors, showAllErrors]);

  useEffect(() => {
    const applySync = (payload) => {
      const fromEvent = normalizeProfileShape(payload || {});
      const fromProp = normalizeProfileShape(student || {});
      
      setFormData((prev) => {
        const base = Object.keys(prev || {}).length ? prev : fromProp;
        const next = mergeStudentIntoProfile(
            mergeStudentIntoProfile(base, fromProp),
            fromEvent
        );
        const result = maybeFixNamesFromLoginFirst(next, loginFullNameFallback, shouldApplyLoginFallback);
        console.log('[DEBUG] final formData:', result);
        console.log('[DEBUG] final formData.student:', result.student);
        return result;
      });
    };

    applySync(null);
    const onProfileUpdated = (e) => applySync(e?.detail || null);
    window.addEventListener('mais:profile-updated', onProfileUpdated);
    return () => window.removeEventListener('mais:profile-updated', onProfileUpdated);
  }, [isOpen, student, loginFullNameFallback, shouldApplyLoginFallback]);

  useEffect(() => {
    if (!isEditing) {
      const fromProp = normalizeProfileShape(student || {});
      setFormData(maybeFixNamesFromLoginFirst(fromProp, loginFullNameFallback, shouldApplyLoginFallback));
      resetErrors();
      setShowAllErrors(false);
    }
  }, [isEditing, resetErrors, student, loginFullNameFallback, shouldApplyLoginFallback]);

  // Load available courses filtered by student's Faculty and Program
  useEffect(() => {
    if (!isOpen || !viewerIsTeacher) return;
    let cancelled = false;
    
    (async () => {
      try {
        const [courses, classGroups] = await Promise.all([
          fetchCourses(),
          fetchClassGroups({ activeOnly: true }).catch(() => [])
        ]);
        if (cancelled) return;
        
        const studentFaculty = formData?.faculty || formData?.student?.faculty || '';
        const studentProgram = formData?.program || formData?.student?.program || '';
        
        console.log('[StudentProfileModal] Loading courses for faculty:', studentFaculty, 'program:', studentProgram);
        console.log('[StudentProfileModal] Total courses:', courses?.length, 'classGroups:', classGroups?.length);
        
        // Create a map of courseCode -> available groups with free slots
        const courseGroupsMap = new Map();
        (classGroups || []).forEach(group => {
          const courseCode = group.courseCode || group.CourseCode;
          const maxStudents = group.maxStudents || group.MaxStudents || 30; // Default to 30 if not set
          const currentStudents = group.currentStudents || group.CurrentStudents || 0;
          const hasSpace = currentStudents < maxStudents;
          
          if (!courseCode) return;
          
          if (!courseGroupsMap.has(courseCode)) {
            courseGroupsMap.set(courseCode, []);
          }
          if (hasSpace) {
            courseGroupsMap.get(courseCode).push({
              ...group,
              availableSlots: maxStudents - currentStudents
            });
          }
        });
        
        // Filter courses by student's Faculty/Program (less strict matching)
        const filtered = (courses || []).filter(course => {
          const courseFaculty = course?.faculty || course?.Faculty || '';
          const courseProgram = course?.program || course?.Program || '';
          
          // If student has a faculty set, match it (but allow courses without faculty set)
          if (studentFaculty && courseFaculty && courseFaculty.toLowerCase() !== studentFaculty.toLowerCase()) {
            return false;
          }
          // If student has a program set, match it (but allow courses without program set)
          if (studentProgram && courseProgram && courseProgram.toLowerCase() !== studentProgram.toLowerCase()) {
            return false;
          }
          
          return true;
        });
        
        console.log('[StudentProfileModal] Filtered courses:', filtered.length);
        
        setAvailableCourses(filtered.map(c => {
          const courseCode = c.code || c.Code;
          const courseName = c.name || c.Name || c.nameEn || c.NameEn || c.nameSk || c.NameSk || 'Untitled';
          const groups = courseGroupsMap.get(courseCode) || [];
          const totalSlots = groups.reduce((sum, g) => sum + g.availableSlots, 0);
          const slotsInfo = totalSlots > 0 ? ` (${totalSlots} slot${totalSlots > 1 ? 's' : ''})` : '';
          
          return {
            value: courseCode,
            label: `${courseName}${slotsInfo}`,
            courseName: courseName,
            faculty: c.faculty || c.Faculty,
            program: c.program || c.Program,
            groups: groups
          };
        }));
      } catch (err) {
        console.error('Failed to load courses:', err);
      }
    })();
    
    return () => { cancelled = true; };
  }, [isOpen, viewerIsTeacher, formData?.faculty, formData?.program, formData?.student?.faculty, formData?.student?.program]);

  const handleSave = () => {
    if (!canEdit) return;
    const fields = collectFieldsForValidation();
    const values = makeValidationValues(formData);
    if (fields.length && !validateFields(fields, values)) {
      setShowAllErrors(true);
      return;
    }
    setShowAllErrors(false);

    const next = {
      ...formData,
      student: {
        ...(formData.student || {}),
        consentPersonalData: !!formData?.student?.consentPersonalData,
        consentCompanyOffers: !!formData?.student?.consentCompanyOffers,
      },
    };
    onSave?.(next, { keepOpen: true });
    window.dispatchEvent(new CustomEvent('mais:profile-updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'profile' } }));
    resetErrors();
    setIsEditing(false);
  };

  const handleCancel = () => {
    const fromProp = normalizeProfileShape(student || {});
    setFormData(maybeFixNamesFromLoginFirst(fromProp, loginFullNameFallback, shouldApplyLoginFallback));
    resetErrors();
    setShowAllErrors(false);
    setIsEditing(false);
  };

  const handleEnrollToCourses = async () => {
    // Find new courses to enroll (not in initial enrollments)
    const newCourses = selectedCourses.filter(code => !initialEnrolledCourses.includes(code));
    
    if (!newCourses.length) {
      notify('info', 'No new courses to enroll');
      return;
    }

    const studentEmail = formData?.email;
    const studentId = student?.id || student?.studentId || studentEmail;
    if (!studentEmail || !studentId) {
      notify('error', 'Student email/ID is required for enrollment');
      return;
    }

    setEnrolling(true);
    try {
      let successCount = 0;
      let errorCount = 0;
      const errorMessages = [];

      for (const courseCode of newCourses) {
        try {
          // Find the course with groups info
          const courseWithGroups = availableCourses.find(c => c.value === courseCode);
          if (!courseWithGroups || !courseWithGroups.groups || courseWithGroups.groups.length === 0) {
            // Try to enroll without specific group
            await createEnrollmentForStudent({
              studentId: studentId,
              academicYear: new Date().getFullYear().toString(),
              semester: 'Winter',
              selections: [{
                courseCode: courseCode,
                scheduleEventId: null
              }]
            });
            successCount++;
            console.log(`[Enrollment] Student ${studentId} enrolled in ${courseCode} (no specific group)`);
            continue;
          }

          // Find the group with most available slots
          const bestGroup = courseWithGroups.groups.reduce((best, group) => {
            return (group.availableSlots || 0) > (best?.availableSlots || 0) ? group : best;
          }, courseWithGroups.groups[0]);

          // Enroll student with the group's scheduleEventId
          const scheduleEventId = bestGroup?.id || bestGroup?.Id || bestGroup?.scheduleEventId || null;
          await createEnrollmentForStudent({
            studentId: studentId,
            academicYear: new Date().getFullYear().toString(),
            semester: 'Winter',
            selections: [{
              courseCode: courseCode,
              scheduleEventId: scheduleEventId
            }]
          });
          
          successCount++;
          console.log(`[Enrollment] Student ${studentId} enrolled in ${courseCode}, group ${bestGroup?.groupName || bestGroup?.GroupName || scheduleEventId}`);
        } catch (err) {
          console.error(`Failed to enroll in ${courseCode}:`, err);
          errorMessages.push(`${courseCode}: ${err.message || 'Unknown error'}`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        notify('success', `Successfully enrolled in ${successCount} course${successCount > 1 ? 's' : ''}`);
        // Refresh enrollments
        const studentId = student?.id || student?.studentId || studentEmail;
        const enrollmentsData = await fetchStudentEnrollments(studentId);
        const newEnrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];
        setEnrollments(newEnrollments);
        // Update selected and initial courses
        const newEnrolledCodes = newEnrollments.map(e => e.courseCode || e.CourseCode).filter(Boolean);
        setSelectedCourses(newEnrolledCodes);
        setInitialEnrolledCourses(newEnrolledCodes);
        // Trigger data refresh
        window.dispatchEvent(new CustomEvent('mais:data-updated', { detail: { scope: 'enrollments' } }));
      }

      if (errorCount > 0) {
        const errorSummary = errorMessages.slice(0, 3).join('; ');
        notify('error', `Failed to enroll in ${errorCount} course${errorCount > 1 ? 's' : ''}: ${errorSummary}${errorMessages.length > 3 ? '...' : ''}`);
      }
    } catch (err) {
      notify('error', 'Failed to enroll student to courses');
      console.error(err);
    } finally {
      setEnrolling(false);
    }
  };

  const handleInputChange = useCallback(
      (field, value) => {
        setFormData((prev) => {
          const next = { ...prev, [field]: value };
          if (isEditing) {
            const fieldsToValidate = [];
            if (PROFILE_VALIDATION_SCHEMA[field]) fieldsToValidate.push(field);
            if (field === 'address' && PROFILE_VALIDATION_SCHEMA['student.address']) {
              fieldsToValidate.push('student.address');
            }
            if (fieldsToValidate.length) {
              validateFields(fieldsToValidate, makeValidationValues(next));
            }
          }
          return next;
        });
      },
      [PROFILE_VALIDATION_SCHEMA, isEditing, makeValidationValues, validateFields],
  );

  const setStudentField = useCallback(
      (patch) => {
        setFormData((prev) => {
          const nextStudent = { ...(prev.student || {}), ...patch };
          const next = { ...prev, student: nextStudent };
          if (isEditing) {
            const fieldsToValidate = Object.keys(patch)
                .map((key) => `student.${key}`)
                .filter((key) => PROFILE_VALIDATION_SCHEMA[key]);
            if (fieldsToValidate.length) {
              validateFields(fieldsToValidate, makeValidationValues(next));
            }
          }
          return next;
        });
      },
      [PROFILE_VALIDATION_SCHEMA, isEditing, makeValidationValues, validateFields],
  );

  const handleFieldBlur = useCallback(
      (field) => () => {
        if (PROFILE_VALIDATION_SCHEMA[field]) {
          validateFields([field], makeValidationValues(formData));
          return;
        }
        if (field === 'address' && PROFILE_VALIDATION_SCHEMA['student.address']) {
          validateFields(['student.address'], makeValidationValues(formData));
        }
      },
      [PROFILE_VALIDATION_SCHEMA, formData, makeValidationValues, validateFields],
  );

  const handleStudentFieldBlur = useCallback(
      (field) => () => {
        const key = `student.${field}`;
        if (PROFILE_VALIDATION_SCHEMA[key]) {
          validateFields([key], makeValidationValues(formData));
        }
      },
      [PROFILE_VALIDATION_SCHEMA, formData, makeValidationValues, validateFields],
  );

  const copyText = async (text) => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(String(text || ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } finally {
      setCopying(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const initials = useMemo(() => {
    return getInitials({
      firstName: formData?.firstName,
      lastName: formData?.lastName,
      name: formData?.name,
      email: formData?.email || student?.email
    });
  }, [formData?.firstName, formData?.lastName, formData?.name, formData?.email, student?.email]);

  // Load activities when modal opens
  useEffect(() => {
    // Allow loading activities for teachers viewing any student, or students viewing their own profile
    if (!isOpen || !studentEmail) {
      // Don't reset activityData when dependencies change - only reset when modal closes
      if (!isOpen) {
        setActivityData([]);
      }
      setIsActivityLoading(false);
      return;
    }
    let cancelled = false;
    setIsActivityLoading(true);
    (async () => {
      try {
        // Use the new getUserActivities API to get activities for this specific student
        const result = await getUserActivities(studentEmail, { 
          perPage: 20,
          sort: 'time',
          dir: 'desc'
        });
        if (!cancelled) {
          // Handle different response formats: direct array, items, data, or activities
          let items = [];
          if (Array.isArray(result)) {
            items = result;
          } else if (result?.items && Array.isArray(result.items)) {
            items = result.items;
          } else if (result?.data && Array.isArray(result.data)) {
            items = result.data;
          } else if (result?.activities && Array.isArray(result.activities)) {
            items = result.activities;
          }
          console.log('[StudentProfileModal] Activities loaded:', items.length, 'items for', studentEmail);
          
          // If API returned empty results, fall back to global feed
          if (items.length === 0 && globalActivityFeed.length > 0) {
            console.log('[StudentProfileModal] API returned empty, using global feed fallback');
            const filteredFeed = globalActivityFeed.filter(a => 
              a.studentEmail?.toLowerCase() === studentEmail.toLowerCase() ||
              a.userEmail?.toLowerCase() === studentEmail.toLowerCase()
            );
            setActivityData(filteredFeed.length > 0 ? filteredFeed : globalActivityFeed);
          } else {
            setActivityData(items);
          }
        }
      } catch (err) {
        // If error (e.g., permissions), fall back to global feed filtered by student email
        console.warn('[StudentProfileModal] Could not load user activities, using global feed:', err.message);
        if (!cancelled) {
          // Filter global feed to show only activities related to this student
          const filteredFeed = globalActivityFeed.filter(a => 
            a.studentEmail?.toLowerCase() === studentEmail.toLowerCase() ||
            a.userEmail?.toLowerCase() === studentEmail.toLowerCase()
          );
          setActivityData(filteredFeed.length > 0 ? filteredFeed : globalActivityFeed);
        }
      } finally {
        if (!cancelled) setIsActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, studentEmail, globalActivityFeed]);

  // Load faculties, programs, departments, and class groups
  useEffect(() => {
    if (!isOpen || !viewerIsTeacher) return;
    let cancelled = false;
    (async () => {
      try {
        const [facultiesData, departmentsData, classGroupsData] = await Promise.all([
          fetchFacultyOptions(),
          fetchDepartments(),
          fetchClassGroups({ activeOnly: true })
        ]);
        if (!cancelled) {
          setFaculties(Array.isArray(facultiesData) ? facultiesData : []);
          setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
          setClassGroups(Array.isArray(classGroupsData) ? classGroupsData : []);
        }
      } catch (err) {
        console.error('[StudentProfileModal] Failed to load faculties/departments/classGroups:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, viewerIsTeacher]);

  // Load programs when faculty or department changes
  useEffect(() => {
    if (!isOpen || !viewerIsTeacher) return;
    const studentFaculty = formData?.faculty || formData?.student?.faculty || '';
    const studentDepartment = formData?.departmentCode || formData?.student?.departmentCode || '';
    if (!studentFaculty && !studentDepartment) {
      setPrograms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const filters = {};
        if (studentFaculty) filters.faculty = studentFaculty;
        if (studentDepartment) filters.departmentId = studentDepartment;
        const programsData = await fetchPrograms(filters);
        if (!cancelled) {
          setPrograms(Array.isArray(programsData) ? programsData : []);
        }
      } catch (err) {
        console.error('[StudentProfileModal] Failed to load programs:', err);
        if (!cancelled) setPrograms([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, viewerIsTeacher, formData?.faculty, formData?.student?.faculty, formData?.departmentCode, formData?.student?.departmentCode]);

  // Load student enrollments (classes) and enrich with course names
  useEffect(() => {
    if (!isOpen || !studentEmail || !viewerIsTeacher) {
      setEnrollments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const studentId = student?.id || student?.studentId || studentEmail;
        const [enrollmentsData, coursesData] = await Promise.all([
          fetchStudentEnrollments(studentId),
          fetchCourses()
        ]);
        if (!cancelled) {
          // Create a map of courseCode -> course name for quick lookup
          const courseNameMap = new Map();
          (coursesData || []).forEach(c => {
            const code = c.code || c.Code;
            const name = c.name || c.Name || c.nameEn || c.NameEn || c.nameSk || c.NameSk;
            if (code && name) {
              courseNameMap.set(code, name);
              courseNameMap.set(code.toLowerCase(), name);
            }
          });
          
          // Enrich enrollments with course names
          const enrichedEnrollments = (Array.isArray(enrollmentsData) ? enrollmentsData : []).map(e => {
            const code = e.courseCode || e.CourseCode || '';
            const existingName = e.courseName || e.CourseName || e.name || e.Name;
            const lookupName = courseNameMap.get(code) || courseNameMap.get(code.toLowerCase());
            return {
              ...e,
              courseName: existingName || lookupName || ''
            };
          });
          
          console.log('[StudentProfileModal] Enrollments loaded:', enrichedEnrollments.length, 'classes');
          setEnrollments(enrichedEnrollments);
          
          // Pre-fill selectedCourses with current enrollments (deduplicated)
          const enrolledCourseCodes = [...new Set(
            enrichedEnrollments
              .map(e => e.courseCode || e.CourseCode)
              .filter(Boolean)
          )];
          setSelectedCourses(enrolledCourseCodes);
          setInitialEnrolledCourses(enrolledCourseCodes); // Store initial state for comparison
        }
      } catch (err) {
        console.error('[StudentProfileModal] Failed to load enrollments:', err);
        if (!cancelled) setEnrollments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, studentEmail, viewerIsTeacher, student?.id, student?.studentId]);

  const tabs = useMemo(() => {
    const base = [{ id: 'overview', label: 'Overview', icon: 'User' }];
    if ((formData?.role || 'student') === 'student')
      base.push({ id: 'student', label: 'Student', icon: 'BookOpen' });
    if ((formData?.role || 'student') === 'teacher')
      base.push({ id: 'teacher', label: 'Teacher', icon: 'Briefcase' });
    base.push({ id: 'activity', label: 'Activity', icon: 'Activity' });
    return base;
  }, [formData?.role]);

  if (!isOpen || !student) return null;

  return (
      <div className="fixed inset-0 z-110 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-6 pb-24 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={onClose} />

          <div className="relative inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
            <div className="absolute top-2 right-2 md:top-3 md:right-3 z-40">
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
                <Icon name="X" size={20} />
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-5 pr-14 md:pl-6 md:pr-16 py-4 md:py-5 border-b border-border sticky top-0 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-full grid place-items-center flex-shrink-0">
                  <span className="text-base font-bold text-primary-foreground">{initials || '•'}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-semibold text-foreground truncate">
                    {`${formData?.firstName || ''} ${formData?.lastName || ''}`.trim() || '—'}
                  </h3>

                  <div className="text-xs text-muted-foreground truncate">
                    {formData?.role === 'student'
                        ? (() => {
                            const parts = [];
                            const faculty = formData?.faculty || formData?.student?.faculty;
                            const program = formData?.program || formData?.student?.program;
                            const studyYear = formData?.student?.studyYear;
                            const degree = formData?.student?.awardedDegree || formData?.degree;
                            
                            if (faculty) parts.push(`Student at ${faculty}`);
                            if (program) parts.push(`Program: ${program}`);
                            if (studyYear) parts.push(`Year ${studyYear}`);
                            if (degree) parts.push(`Degree: ${degree}`);
                            
                            return parts.length > 0 ? parts.join(' • ') : 'Student';
                          })()
                        : (formData?.department || 'Teacher')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:ml-auto">
                {canEdit &&
                    (isEditing ? (
                        <>
                          <Button variant="outline" onClick={handleCancel}>
                            Cancel
                          </Button>
                          <Button variant="default" onClick={handleSave}>
                            Save Changes
                          </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            iconName="Edit"
                            onClick={() => {
                              resetErrors();
                              setShowAllErrors(false);
                              setIsEditing(true);
                            }}
                        >
                          Edit
                        </Button>
                    ))}
              </div>
            </div>

            {/* Tabs header — NOT sticky */}
            <div className="border-b border-border bg-card">
              <div className="relative">
                <div
                    className="overflow-x-auto md:overflow-x-visible overscroll-contain px-4"
                    role="tablist"
                    aria-label="Profile tabs"
                >
                  <div className="flex md:flex-wrap items-center gap-4 min-w-max md:min-w-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            role="tab"
                            aria-selected={activeTab === tab.id ? 'true' : 'false'}
                            className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                            }`}
                        >
                          <Icon name={tab.icon} size={16} />
                          <span>{tab.label}</span>
                        </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scroll area with styled scrollbar (from styles) */}
            <div className="px-5 md:px-6 py-5 md:py-6 max-h-[66vh] overflow-y-auto thin-scrollbar">
              {firstError && (
                  <div className="mb-4 p-3 rounded-md border border-error/20 bg-error/10 text-error text-sm">
                    {firstError}
                  </div>
              )}
              {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Row>
                          <div className="min-w-0 w-full">
                            {isEditing && canEditField('firstName') ? (
                                <Input
                                    label="First name"
                                    value={formData?.firstName || ''}
                                    onChange={(e) => handleInputChange('firstName', e?.target?.value)}
                                    onBlur={handleFieldBlur('firstName')}
                                    error={errors.firstName}
                                />
                            ) : (
                                <ReadField label="First name" value={formData?.firstName} />
                            )}
                          </div>
                          <div className="min-w-0 w-full">
                            {isEditing && canEditField('lastName') ? (
                                <Input
                                    label="Last name"
                                    value={formData?.lastName || ''}
                                    onChange={(e) => handleInputChange('lastName', e?.target?.value)}
                                    onBlur={handleFieldBlur('lastName')}
                                    error={errors.lastName}
                                />
                            ) : (
                                <ReadField label="Last name" value={formData?.lastName} />
                            )}
                          </div>
                        </Row>

                        <Row>
                          <div className="min-w-0 w-full">
                            {isEditing && canEditField('email') && !privacy ? (
                                <Input
                                    label="Email"
                                    type="email"
                                    value={formData?.email || ''}
                                    onChange={(e) => handleInputChange('email', e?.target?.value)}
                                    onBlur={handleFieldBlur('email')}
                                    error={errors.email}
                                    disabled={privacy}
                                />
                            ) : (
                                <ReadField label="Email" value={privacy ? '••••••••' : formData?.email} />
                            )}
                          </div>
                          <div className="min-w-0 w-full">
                            {isEditing && canEditField('phone') ? (
                                <Input
                                    label="Phone"
                                    value={formData?.phone || ''}
                                    onChange={(e) => handleInputChange('phone', e?.target?.value)}
                                    onBlur={handleFieldBlur('phone')}
                                    error={errors.phone}
                                />
                            ) : (
                                <ReadField label="Phone" value={formData?.phone} />
                            )}
                          </div>
                        </Row>

                        <div>
                          <label className="block text-sm font-medium text-foreground">Location</label>
                          {isEditing && canEditField('location') ? (
                              <Input
                                  value={formData?.location || ''}
                                  onChange={(e) => handleInputChange('location', e?.target?.value)}
                                  placeholder="Room 205 · Main Building"
                              />
                          ) : (
                              <div className="text-sm text-foreground">{formData?.location || '—'}</div>
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <Button
                                size="xs"
                                variant="ghost"
                                iconName="Copy"
                                onClick={() => copyText(formData?.location)}
                                disabled={copying}
                            >
                              {copied ? 'Copied' : 'Copy'}
                            </Button>
                            <a
                                className="text-xs underline text-muted-foreground hover:text-foreground"
                                href={`https://www.google.com/maps/search/${encodeURIComponent(formData?.location || '')}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                              Open map
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="min-w-0 w-full [&_select]:w-full">
                          <ReadField
                              label="Role"
                              value={(formData?.role || 'student') === 'teacher' ? 'Teacher' : 'Student'}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {viewerIsTeacher
                                ? 'Teacher role can modify all fields.'
                                : 'Students can edit phone, emails, address, and consents.'}
                          </p>
                        </div>

                        <div className="min-w-0 w-full">
                          {isEditing && canEditField('about') ? (
                              <Textarea
                                  label="About"
                                  minRows={4}
                                  value={formData?.about || ''}
                                  onChange={(e) => handleInputChange('about', e?.target?.value)}
                              />
                          ) : (
                              <>
                                <label className="block text-sm text-muted-foreground">About</label>
                              <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                                {formData?.about || '—'}
                              </div>
                              </>
                          )}
                        </div>

                        {formData?.role === 'teacher' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="min-w-0 w-full">
                                {isEditing ? (
                                    <Input
                                        label="Department"
                                        value={formData?.department || ''}
                                        onChange={(e) => handleInputChange('department', e?.target?.value)}
                                    />
                                ) : (
                                    <ReadField label="Department" value={formData?.department} />
                                )}
                              </div>
                              <div className="min-w-0 w-full">
                                {isEditing ? (
                                    <Input
                                        label="Subjects"
                                        value={(formData?.subjects || []).join(', ')}
                                        onChange={(e) => handleInputChange('subjects', splitCSV(e?.target?.value))}
                                    />
                                ) : (
                                    <ReadField label="Subjects" value={(formData?.subjects || []).join(', ')} />
                                )}
                              </div>
                              <div className="min-w-0 w-full sm:col-span-2">
                                {isEditing ? (
                                    <Input
                                        label="Years of experience"
                                        type="number"
                                        value={formData?.yearsExperience ?? ''}
                                        onChange={(e) =>
                                            handleInputChange('yearsExperience', parseInt(e?.target?.value || '0', 10))
                                        }
                                    />
                                ) : (
                                    <ReadField label="Years of experience" value={formData?.yearsExperience ?? '—'} />
                                )}
                              </div>
                            </div>
                        )}

                        <div className="min-w-0 w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Display email</span>
                            <span className="text-xs text-muted-foreground">
                          ({privacy ? 'hidden' : 'visible'})
                        </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last update: {new Date()?.toLocaleDateString()} at{' '}
                            {new Date()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              )}

              {activeTab === 'student' && (formData?.role || 'student') === 'student' && (
                  <div className="space-y-6">
                    {/* Academic Information Section */}
                    <SectionTitle>Academic Information</SectionTitle>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Select
                                label="Faculty"
                                options={faculties.map(f => ({ value: f.code || f.Code, label: f.nameEn || f.NameEn || f.code }))}
                                value={formData?.faculty || formData?.student?.faculty || ''}
                                onChange={(v) => {
                                  const val = typeof v === 'string' ? v : v?.value || '';
                                  handleInputChange('faculty', val);
                                  setStudentField({ faculty: val });
                                }}
                                clearable={true}
                                placeholder="Select faculty"
                            />
                        ) : (
                            <ReadField 
                              label="Faculty" 
                              value={formData?.faculty || formData?.student?.faculty} 
                            />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Select
                                label="Program"
                                options={programs.map(p => ({ value: p.name || p.Name, label: p.name || p.Name }))}
                                value={formData?.program || formData?.student?.program || ''}
                                onChange={(v) => {
                                  const val = typeof v === 'string' ? v : v?.value || '';
                                  handleInputChange('program', val);
                                  setStudentField({ program: val });
                                }}
                                clearable={true}
                                placeholder={!formData?.faculty ? "Select faculty first" : "Select program"}
                                disabled={!formData?.faculty && !formData?.student?.faculty}
                            />
                        ) : (
                            <ReadField 
                              label="Program" 
                              value={formData?.program || formData?.student?.program} 
                            />
                        )}
                      </div>
                    </Row>
                    
                    {/* Subjects (Courses) MultiSelect - Only for teachers */}
                    {viewerIsTeacher && (
                      <div className="space-y-2">
                        <MultiSelect
                            label="Enrolled Courses"
                            options={availableCourses}
                            value={selectedCourses}
                            onChange={(newValues) => {
                              setSelectedCourses(Array.isArray(newValues) ? newValues : []);
                            }}
                            placeholder={selectedCourses.length === 0 ? "No courses enrolled" : ""}
                            disabled={availableCourses.length === 0 && selectedCourses.length === 0}
                            searchable={true}
                        />
                        {(() => {
                          const uniqueSelected = [...new Set(selectedCourses)];
                          const uniqueInitial = [...new Set(initialEnrolledCourses)];
                          const newCoursesCount = uniqueSelected.filter(code => !uniqueInitial.includes(code)).length;
                          const removedCoursesCount = uniqueInitial.filter(code => !uniqueSelected.includes(code)).length;
                          return (
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                {uniqueSelected.length} course{uniqueSelected.length !== 1 ? 's' : ''} enrolled
                                {newCoursesCount > 0 && <span className="text-success ml-1">(+{newCoursesCount} new)</span>}
                                {removedCoursesCount > 0 && <span className="text-warning ml-1">(-{removedCoursesCount} to remove)</span>}
                              </p>
                              {newCoursesCount > 0 && (
                                <Button
                                  size="sm"
                                  onClick={handleEnrollToCourses}
                                  disabled={enrolling}
                                >
                                  <Icon name={enrolling ? "Loader" : "UserPlus"} className={enrolling ? "animate-spin mr-1" : "mr-1"} size={14} />
                                  {enrolling ? 'Enrolling...' : `Enroll to ${newCoursesCount} new course${newCoursesCount > 1 ? 's' : ''}`}
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <SectionTitle>Student Identifiers</SectionTitle>
                    
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Select
                                label="Class"
                                options={(() => {
                                  // Filter class groups by student's faculty and program
                                  const studentFaculty = formData?.faculty || formData?.student?.faculty || '';
                                  const studentProgram = formData?.program || formData?.student?.program || '';
                                  return classGroups
                                    .filter(cg => {
                                      if (studentFaculty && cg.faculty && cg.faculty !== studentFaculty) return false;
                                      if (studentProgram && cg.program && cg.program !== studentProgram) return false;
                                      return true;
                                    })
                                    .map(cg => ({
                                      value: cg.name || cg.Name || cg.id,
                                      label: cg.name || cg.Name || cg.id
                                    }));
                                })()}
                                value={formData?.student?.className || ''}
                                onChange={(v) => {
                                  const val = typeof v === 'string' ? v : v?.value || '';
                                  setStudentField({ className: val });
                                }}
                                placeholder="Select class"
                                clearable={true}
                            />
                        ) : (
                            <ReadField label="Class" value={formData?.student?.className} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="ISIC Card Number"
                                value={formData?.student?.isicCardNumber || ''}
                                onChange={(e) => setStudentField({ isicCardNumber: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="ISIC Card Number" value={formData?.student?.isicCardNumber} />
                        )}
                      </div>
                    </Row>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Student Number"
                                value={formData?.student?.studentNumber || ''}
                                onChange={(e) => setStudentField({ studentNumber: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Student Number" value={formData?.student?.studentNumber} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Study Number"
                                value={formData?.student?.studyNumber || ''}
                                onChange={(e) => setStudentField({ studyNumber: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Study Number" value={formData?.student?.studyNumber} />
                        )}
                      </div>
                    </Row>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Passport / ID"
                                value={formData?.student?.passportId || ''}
                                onChange={(e) => setStudentField({ passportId: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Passport / ID" value={formData?.student?.passportId} />
                        )}
                      </div>
                    </Row>

                    <SectionTitle>Personal Details</SectionTitle>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Birth Date"
                                type="date"
                                value={formData?.student?.birthDate || ''}
                                onChange={(e) => setStudentField({ birthDate: e?.target?.value })}
                                onBlur={handleStudentFieldBlur('birthDate')}
                                error={errors['student.birthDate']}
                            />
                        ) : (
                            <ReadField label="Birth Date" value={formatDate(formData?.student?.birthDate)} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Birth Place"
                                value={formData?.student?.birthPlace || ''}
                                onChange={(e) => setStudentField({ birthPlace: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Birth Place" value={formData?.student?.birthPlace} />
                        )}
                      </div>
                    </Row>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Nationality"
                                value={formData?.student?.nationality || ''}
                                onChange={(e) => setStudentField({ nationality: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Nationality" value={formData?.student?.nationality} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Family Status"
                                value={formData?.student?.familyStatus || ''}
                                onChange={(e) => setStudentField({ familyStatus: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Family Status" value={formData?.student?.familyStatus} />
                        )}
                      </div>
                    </Row>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Health Status"
                                value={formData?.student?.healthStatus || ''}
                                onChange={(e) => setStudentField({ healthStatus: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Health Status" value={formData?.student?.healthStatus} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && canEditField('address') ? (
                            <Input
                                label="Permanent Address"
                                value={formData?.student?.address || formData?.address || ''}
                                onChange={(e) => {
                                  setStudentField({ address: e?.target?.value });
                                  handleInputChange('address', e?.target?.value);
                                }}
                                onBlur={handleFieldBlur('address')}
                                error={errors['student.address']}
                            />
                        ) : (
                            <ReadField
                                label="Permanent Address"
                                value={formData?.student?.address || formData?.address}
                            />
                        )}
                      </div>
                    </Row>

                    <SectionTitle>Contacts</SectionTitle>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && canEditField('phone2') ? (
                            <Input
                                label="Secondary Phone"
                                value={formData?.phone2 || ''}
                                onChange={(e) => handleInputChange('phone2', e?.target?.value)}
                                onBlur={handleFieldBlur('phone2')}
                                error={errors.phone2}
                            />
                        ) : (
                            <ReadField label="Secondary Phone" value={formData?.phone2} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing && canEditField('altEmail') && !privacy ? (
                            <Input
                                label="Personal Email"
                                type="email"
                                value={privacy ? '' : formData?.altEmail || ''}
                                onChange={(e) => handleInputChange('altEmail', e?.target?.value)}
                                onBlur={handleFieldBlur('altEmail')}
                                error={errors.altEmail}
                                disabled={privacy}
                            />
                        ) : (
                            <ReadField label="Personal Email" value={privacy ? '••••••••' : formData?.altEmail} />
                        )}
                      </div>
                    </Row>
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing && viewerIsTeacher ? (
                            <Input
                                label="Parent"
                                value={formData?.student?.parentName || ''}
                                onChange={(e) => setStudentField({ parentName: e?.target?.value })}
                            />
                        ) : (
                            <ReadField label="Parent" value={formData?.student?.parentName} />
                        )}
                      </div>
                    </Row>
                    
                    <Row>
                      <div className="min-w-0 w-full">
                        {isEditing ? (
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-1">About</label>
                              <textarea
                                  className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
                                  value={formData?.student?.about || ''}
                                  onChange={(e) => setStudentField({ about: e?.target?.value })}
                                  placeholder="Brief description about the student..."
                              />
                            </div>
                        ) : (
                            <div className="min-w-0">
                              <label className="block text-sm text-muted-foreground">About</label>
                              <div className="text-sm text-foreground whitespace-pre-wrap break-words">{formData?.student?.about || '—'}</div>
                            </div>
                        )}
                      </div>
                    </Row>

                    <SectionTitle>Consents</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between gap-2">
                        {isEditing && canEditField('consentPersonalData') ? (
                            <label className="inline-flex items-center gap-2 text-sm">
                              <Checkbox
                                  checked={!!formData?.student?.consentPersonalData}
                                  onChange={(e) =>
                                      setStudentField({ consentPersonalData: !!e?.target?.checked })
                                  }
                              />
                              <a
                                  href={PERSONAL_DATA_PDF}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="underline text-muted-foreground hover:text-foreground"
                              >
                                Consent to the processing of graduate’s personal data
                              </a>
                            </label>
                        ) : (
                            <ReadField
                                label="Personal Data Consent"
                                value={formData?.student?.consentPersonalData ? 'Granted' : 'Not granted'}
                            />
                        )}
                      </div>

                      <div>
                        {isEditing && canEditField('consentCompanyOffers') ? (
                            <label className="inline-flex items-center gap-2 text-sm">
                              <Checkbox
                                  checked={!!formData?.student?.consentCompanyOffers}
                                  onChange={(e) =>
                                      setStudentField({ consentCompanyOffers: !!e?.target?.checked })
                                  }
                              />
                              <span>Consent to receiving company offers</span>
                            </label>
                        ) : (
                            <ReadField
                                label="Company Offers Consent"
                                value={formData?.student?.consentCompanyOffers ? 'Granted' : 'Not granted'}
                            />
                        )}
                      </div>
                    </div>
                  </div>
              )}

              {activeTab === 'teacher' && (formData?.role || 'student') === 'teacher' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="min-w-0 w-full">
                        {isEditing ? (
                            <Input
                                label="Department"
                                value={formData?.department || ''}
                                onChange={(e) => handleInputChange('department', e?.target?.value)}
                            />
                        ) : (
                            <ReadField label="Department" value={formData?.department} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing ? (
                            <Input
                                label="Subjects"
                                value={(formData?.subjects || []).join(', ')}
                                onChange={(e) => handleInputChange('subjects', splitCSV(e?.target?.value))}
                            />
                        ) : (
                            <ReadField label="Subjects" value={(formData?.subjects || []).join(', ')} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        {isEditing ? (
                            <Input
                                label="Years of experience"
                                type="number"
                                value={formData?.yearsExperience ?? ''}
                                onChange={(e) =>
                                    handleInputChange('yearsExperience', parseInt(e?.target?.value || '0', 10))
                                }
                            />
                        ) : (
                            <ReadField label="Years of experience" value={formData?.yearsExperience ?? '—'} />
                        )}
                      </div>
                    </div>
                  </div>
              )}

              {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-foreground">Recent Activity</h4>
                      {viewerIsTeacher && (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconName="RefreshCw"
                          onClick={async () => {
                            setIsActivityLoading(true);
                            try {
                              const result = await getUserActivities(studentEmail, { 
                                perPage: 20,
                                sort: 'time',
                                dir: 'desc'
                              });
                              // Handle different response formats
                              let items = [];
                              if (Array.isArray(result)) {
                                items = result;
                              } else if (result?.items && Array.isArray(result.items)) {
                                items = result.items;
                              } else if (result?.data && Array.isArray(result.data)) {
                                items = result.data;
                              } else if (result?.activities && Array.isArray(result.activities)) {
                                items = result.activities;
                              }
                              setActivityData(items);
                            } catch (err) {
                              console.error('Failed to load activities:', err);
                              setActivityData([]);
                            } finally {
                              setIsActivityLoading(false);
                            }
                          }}
                          loading={isActivityLoading}
                          disabled={isActivityLoading}
                        >
                          Refresh
                        </Button>
                      )}
                    </div>
                    {isActivityLoading ? (
                      <div className="text-sm text-muted-foreground py-4">Loading activities...</div>
                    ) : activityData.length === 0 ? (
                      <div className="text-center py-8">
                        <Icon name="Activity" size={48} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No recent activity</p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {activityData.map((a) => {
                          const iconMap = {
                            submissions: 'FileText',
                            communications: 'MessageCircle',
                            attendance: 'Users',
                            grades: 'Award',
                            announcement: 'Bell',
                            system: 'LogIn',
                            schedule: 'Calendar'
                          };
                          return (
                            <li key={a.id || a.timestamp} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="w-8 h-8 bg-primary rounded-full grid place-items-center flex-shrink-0">
                                <Icon name={iconMap[a.type] || 'Activity'} size={16} className="text-primary-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm text-foreground font-medium">{a.title || 'Activity'}</div>
                                {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(a.timestamp || a.createdAt).toLocaleString()}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

export default StudentProfileModal;