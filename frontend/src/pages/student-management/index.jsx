// src/pages/student-management/StudentManagement.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import StudentTableHeader from './components/StudentTableHeader';
import StudentTable from './components/StudentTable';
import StudentProfileModal from './components/StudentProfileModal';
import GraduationStatusModal from './components/GraduationStatusModal';
import AddStudentModal from './components/AddStudentModal';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Pagination from '../../components/ui/Pagination';
import { motion } from 'framer-motion';
import Reveal from '../../components/motion/Reveal';
import { fetchStudents, fetchCourses, fetchTeacherTimetable, createStudent, fetchTeacherCourseRoster, updateStudentProfileByEmail, fetchScheduleEvents, createEnrollmentForStudent } from '../../data/maisApiAdapter';
import DataLoader from '../../components/ui/DataLoader';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import useDataUpdates from '../../hooks/useDataUpdates';
import useStudentsHub from '../../hooks/useStudentsHub';
import { displayNameFrom, baseNameFrom } from '../../utils/displayName';
import { getCurrentSemester } from '../../utils/semesterUtils';

// Deterministic hash function for consistent ID generation
const H = (s) => { let h=2166136261>>>0; const x=String(s); for (let i=0;i<x.length;i++){ h^=x.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
import { useAuth } from '../../contexts/AuthContext';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { formatLastLogin } from '../../utils/datetime';
import Icon from '../../components/AppIcon';
import useUserPreference from '../../hooks/useUserPreference';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';
import { createLogger } from '../../utils/logger';
import { ANIMATION_DELAYS } from '../../constants/animations';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
const logger = createLogger('index');

const slugify = (s) => {
    const normalized = String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .toLowerCase()
        .trim()
        .replace(/[\s._/]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
    return normalized;
};

const titleize = (slug) =>
    String(slug || '').split('-').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(' ');


// Removed TERM_LABELS - grade filter should be removed or use dynamic data
// Period constants are now loaded dynamically via usePeriodOptions hook
const TARGET_GROUP_SIZE = 24;
const stripSubjectCode = (s = '') => {
  const value = String(s || '').trim();
  if (!value) return '';
  const dash = value.indexOf(' - ');
  if (dash > -1 && dash <= 10) return value.slice(dash + 3).trim();
  const colon = value.indexOf(': ');
  if (colon > -1 && colon <= 10) return value.slice(colon + 2).trim();
  return value;
};

const applyAssignments = (list = [], assignments = {}) => {
  if (!assignments || typeof assignments !== 'object') return list || [];
  return (list || []).map((s) => {
    const key = assignments[s.id];
    if (!key) return s;
    if (s.sectionKey === key && s.section) return s;
    return {
      ...s,
      sectionKey: key,
      section: key ? groupLabel(key) : '',
    };
  });
};

// Map backend StudentEntity to UI row shape using real DB fields only
function toUiStudentFromDb(m) {
  const titledName = displayNameFrom(m);
  const plainName = baseNameFrom(m);
  // Prefer personId (base student id), fallback to student/student numbers
  const personId = (m.personId || m.studentNumber || m.studyNumber || m.id || '').toString();
  const studentId = personId;
  const className = m.className || '';
  const sectionKey = normalizeGroupKey(className);
  const normalizedStatus = String(m.status || '').toLowerCase() || 'active';
  const derivedArchived = typeof m.isArchived === 'boolean'
    ? !!m.isArchived
    : ['archiv', 'inactive', 'graduated', 'completed', 'finished'].some((token) => normalizedStatus.includes(token));
  const status = derivedArchived ? 'archived' : normalizedStatus;
  const lastActivity = m.lastActivity ? new Date(m.lastActivity).toISOString() : undefined;
  return {
    id: m.id,
    recordId: m.id,
    personId,
    name: titledName,
    baseName: plainName,
    email: m.email,
    studentId,
    faculty: m.faculty || '',
    program: m.program || '',
    // Grade/term info removed from UI - not stored in DB
    grade: '',
    gradeKey: '',
    section: sectionKey ? groupLabel(sectionKey) : (className || ''),
    sectionKey,
    status,
    parentName: m.parentName || '',
    parentPhone: m.phone || m.phone2 || '',
    lastActivity,
    isArchived: derivedArchived,
  };
}

function buildSubjectOptions(students = [], includeAll = false, teacherSchedule = [], courses = [], enrollments = [], isTeacher = false) {
  const map = new Map();
  const byCode = new Map();
  (courses || []).forEach((course) => {
    const codeKey = String(course?.code || '').toUpperCase();
    if (!codeKey) return;
    const pretty = stripSubjectCode(course.nameEn || course.nameSk || course.name || '') || codeKey;
    byCode.set(codeKey, pretty);
  });
  
  const register = (rawLabel, code) => {
    const codeKey = String(code || '').toUpperCase();
    let label = stripSubjectCode(rawLabel);
    if ((!label || label === codeKey || /^\d{4,}$/.test(label)) && codeKey) {
      label = byCode.get(codeKey) || label || codeKey;
    }
    if (!label) return;
    // Register slug with just the label (primary slug)
    const slug = slugify(label);
    if (!slug) return;
    // Only register if not already registered (avoid duplicates)
    if (!map.has(slug)) {
      map.set(slug, label);
    }
    // Also register slug with code appended (for compatibility with URLs that include code)
    // This allows URLs like "fornzna-analza-fa-26001198" to work
    if (codeKey) {
      const slugWithCode = `${slug}-${codeKey.toLowerCase()}`;
      // Only register if different from base slug and not already registered
      if (slugWithCode !== slug && !map.has(slugWithCode)) {
        map.set(slugWithCode, label);
      }
    }
  };
  
  // For teachers, show courses from teacherSchedule and courses
  if (isTeacher) {
    // Register courses from teacherSchedule
    (teacherSchedule || []).forEach((entry) => {
      const code = String(entry.courseCode || entry.code || '').toUpperCase();
      const name = entry.courseName || entry.subject || byCode.get(code) || '';
      if (code) {
        // Use course name if available, otherwise fall back to code lookup or the code itself
        register(name || code, code);
      }
    });
    // Also register from courses list
    (courses || []).forEach((course) => {
      const code = String(course?.code || '').toUpperCase();
      if (code) {
        register(course.nameEn || course.nameSk || course.name || course.code, course.code);
      }
    });
  } else {
    // For non-teachers (students viewing their data or teachers viewing all students), show all courses from enrollments
    const enrolledCourseCodes = new Set();
    (enrollments || []).forEach((e) => {
      const code = String(e.courseCode || e.code || '').trim().toUpperCase();
      if (code) enrolledCourseCodes.add(code);
    });
    
    // If we have enrollments, show only enrolled courses
    // Otherwise show all courses (for teachers)
    if (enrolledCourseCodes.size > 0) {
      (courses || []).forEach((course) => {
        const code = String(course?.code || '').toUpperCase();
        if (enrolledCourseCodes.has(code)) {
          register(course.nameEn || course.nameSk || course.name || course.code, course.code);
        }
      });
    } else {
      // No enrollments data - show all courses
      (courses || []).forEach((course) => {
        const code = String(course?.code || '').toUpperCase();
        if (code) {
          register(course.nameEn || course.nameSk || course.name || course.code, course.code);
        }
      });
    }
  }
  
  // Convert map to array and deduplicate by label (to avoid showing same subject twice)
  // But keep both slug variants (with and without code) if they exist
  const seenLabels = new Set();
  const base = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .filter((item) => {
        // Only include if we haven't seen this label before
        // This ensures we don't show duplicate labels, but we keep different slug variants
        if (seenLabels.has(item.label)) return false;
        seenLabels.add(item.label);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  
  // If we have a slug with code, also ensure the base slug (without code) is included
  // This helps with matching when URL contains slug with code
  const baseWithVariants = [...base];
  base.forEach((item) => {
    // Check if this slug ends with a course code (8 digits)
    const parts = item.value.split('-');
    if (parts.length > 1 && /^\d{8}$/.test(parts[parts.length - 1])) {
      const baseSlug = parts.slice(0, -1).join('-');
      // If base slug doesn't exist, add it (but with same label)
      if (!baseWithVariants.find((o) => o.value === baseSlug)) {
        baseWithVariants.push({ value: baseSlug, label: item.label });
      }
    }
  });
  
  return includeAll ? [{ value: 'all', label: 'All Subjects' }, ...baseWithVariants] : baseWithVariants;
}

function normalizeGroupKey(raw) {
  if (!raw && raw !== 0) return '';
  const s = String(raw).toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
  // Match formats like "01-sk", "sk-01", "01", or "01.sk(cybersecurity)"
  const m = s.match(/^(\d{1,2})[-.]?sk/) || s.match(/^sk[-.]?(\d{1,2})/) || s.match(/^(\d{1,2})-?sk$/) || s.match(/^(\d{1,2})$/);
  if (!m) return '';
  const n = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${n}-sk`;
}

export function groupLabel(k) {
  const m = String(k || '').match(/(\d{1,2})/);
  if (!m) return String(k || '');
  const n = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${n}. sk`;
}

const StudentManagementPage = () => {
  const { isBlocked } = useGlobalLoaderBlocking();
  // Get current academic year
  const currentAcademicYear = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const academicYearStart = currentMonth >= 9 ? currentYear : currentYear - 1;
    return `${academicYearStart}/${academicYearStart + 1}`;
  }, []);
  
  // Convert period to keys for compatibility
  const getPeriodKeys = () => {
    const academicYear = currentAcademicYear || '2025/2026';
    const yearSlug = academicYear.replace('/', '-');
    return {
      KEY_WS: `1-rok-${yearSlug}-ws`,
      KEY_SS: `1-rok-${yearSlug}-ss`,
      ACADEMIC_YEAR: academicYear,
    };
  };
  
  const { KEY_WS, KEY_SS, ACADEMIC_YEAR } = getPeriodKeys();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { notify } = useToasts();
  const toastGuard = useRef({});
  const guardedNotify = useCallback(
    (key, type, message, opts = {}) => {
      if (key && toastGuard.current[key]) return;
      notify(type, message, opts);
      if (key) {
        toastGuard.current[key] = true;
        const releaseMs = (opts?.lockMs ?? 2200) + 400;
        setTimeout(() => {
          delete toastGuard.current[key];
        }, releaseMs);
      }
    },
    [notify]
  );
  const [confirmState, setConfirmState] = useState({ open: false, message: '', payload: null, type: null });
  const isStudent = String(user?.role || '').toLowerCase() === 'student';
  const isTeacher = String(user?.role || '').toLowerCase() === 'teacher';
  const userEmail = String(user?.email || '').toLowerCase();
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const { value: selectedStudyValue, loading: selectedStudyLoading } = useSelectedStudyValue();
    const isArchivedStudyContext = !!selectedStudyValue && selectedStudyValue.ongoing === false;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const bootstrappedRef = useRef(false);
  const filtersInitializedRef = useRef(false); // Track if filters were initialized from URL
  const headerDisplayName = useProfileDisplayName(isTeacher ? 'Teacher' : 'Student');

  const [dbStudents, setDbStudents] = useState([]);
  const [students, setStudents] = useState([]);
  const [allScheduleEvents, setAllScheduleEvents] = useState([]);
  const assignmentsPreference = useUserPreference('studentManagement.assignments', {});
  const [rosterAssignments, setRosterAssignments] = useState({});
  const assignmentsHydratedRef = useRef(false);
  useEffect(() => {
    if (assignmentsHydratedRef.current) return;
    if (assignmentsPreference.loading) return;
    assignmentsHydratedRef.current = true;
    const value =
      assignmentsPreference.value && typeof assignmentsPreference.value === 'object'
        ? assignmentsPreference.value
        : {};
    setRosterAssignments(value);
  }, [assignmentsPreference.loading, assignmentsPreference.value]);
  useEffect(() => {
    if (!assignmentsHydratedRef.current) return;
    assignmentsPreference.setValue(rosterAssignments);
  }, [rosterAssignments, assignmentsPreference]);
  const [rosterStudentIds, setRosterStudentIds] = useState(null);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  // Store full student data from API (not just UI representation)
  const [fullStudentData, setFullStudentData] = useState(new Map());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGraduationModalOpen, setIsGraduationModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(''); // Removed grade filter
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [hasUserChosenClass, setHasUserChosenClass] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [allEnrollments, setAllEnrollments] = useState([]); // Store enrollments for all students

  const [advStudentId, setAdvStudentId] = useState('');
  const [advParentName, setAdvParentName] = useState('');
  const [advDob, setAdvDob] = useState('');
  const [advGender, setAdvGender] = useState('all');

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const currentTeacherEmail = useMemo(() => (isTeacher ? String(user?.email || '').toLowerCase() : ''), [user?.email, isTeacher]);

  const [teacherSchedule, setTeacherSchedule] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const teacherCourseCodes = useMemo(() => {
    const codes = new Set();
    (teacherSchedule || []).forEach((entry) => {
      const code = String(entry.courseCode || entry.code || '').toUpperCase();
      if (code) codes.add(code);
    });
    return codes;
  }, [teacherSchedule]);
  const teacherCourses = useMemo(() => {
    if (!isTeacher) return allCourses;
    if (!teacherCourseCodes.size) return [];
    return (allCourses || []).filter((course) => teacherCourseCodes.has(String(course?.code || '').toUpperCase()));
  }, [isTeacher, allCourses, teacherCourseCodes]);
  // Treat navigation with subject/course query as roster intent for teachers, even if 'roster=1' is missing
  const rosterMode = useMemo(() => {
    const hasRosterFlag = searchParams.get('roster') === '1';
    const hasSubject = !!searchParams.get('subject');
    const hasCourse = !!searchParams.get('course');
    return hasRosterFlag || (isTeacher && (hasSubject || hasCourse));
  }, [searchParams, isTeacher]);

  // Function to reload students data (can be called after enrollment)
  const reloadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const includeArchived = selectedStatus === 'archived';
      const statusParam = selectedStatus && selectedStatus !== 'all' ? selectedStatus : undefined;
      const requestParams = {
        page: 1,
        pageSize: 200,
        sort: 'fullName',
        order: 'asc',
      };
      if (statusParam && selectedStatus !== 'archived') {
        requestParams.status = statusParam;
      }
      if (includeArchived) {
        requestParams.includeArchived = true;
        requestParams.archivedOnly = true;
      }
      const studentList = await fetchStudents(requestParams);
      // Store full student data from API
      const fullDataMap = new Map();
      studentList.forEach((m) => {
        if (m?.id) fullDataMap.set(m.id, m);
      });
      setFullStudentData(fullDataMap);
      
      // Load enrollments for all students to filter subjects
      const enrollmentPromises = studentList.map(async (s) => {
        if (!s?.id) return [];
        try {
          const { fetchStudentEnrollments } = await import('../../data/maisApiAdapter');
          return await fetchStudentEnrollments(s.id);
        } catch {
          return [];
        }
      });
      const enrollmentResults = await Promise.all(enrollmentPromises);
      const allEnrollmentsFlat = enrollmentResults.flat();
      setAllEnrollments(allEnrollmentsFlat);
      
      const ui = (studentList || []).map((m) => toUiStudentFromDb(m));
      setDbStudents(ui);
      if (!(rosterMode && isTeacher)) {
        setStudents(applyAssignments(ui, rosterAssignments));
      } else {
        setRosterStudentIds(null);
      }
    } catch {
      setDbStudents([]);
      setStudents([]);
      setFullStudentData(new Map());
      setAllEnrollments([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [rosterMode, isTeacher, rosterAssignments, selectedStatus]);
  useEffect(() => {
    let mounted = true;
    setLoadingMeta(true);
    (async () => {
      try {
        const [crs, tt, se] = await Promise.all([
          fetchCourses(),
          currentTeacherEmail ? fetchTeacherTimetable(currentTeacherEmail) : Promise.resolve([]),
          fetchScheduleEvents(), // Load all schedule events to get all class groups
        ]);
        if (!mounted) return;
        setAllCourses(Array.isArray(crs) ? crs : []);
        setTeacherSchedule(Array.isArray(tt) ? tt : []);
        setAllScheduleEvents(Array.isArray(se) ? se : []);
      } catch {
        if (mounted) {
          setAllCourses([]);
          setTeacherSchedule([]);
          setAllScheduleEvents([]);
        }
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentTeacherEmail]);

  // Listen for data updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    if (!payload?.type) return;
    
    logger.debug('[student-management] Data update received', payload);
    
    // Reload students on student/enrollment updates
    if (payload.type === 'student.updated' || payload.type === 'enrollment.updated') {
      // Inline reload to avoid stale closure
      (async () => {
        setLoadingStudents(true);
        try {
          const requestParams = {
            page: 1,
            pageSize: 200,
            sort: 'fullName',
            order: 'asc',
          };
          const studentList = await fetchStudents(requestParams);
          const fullDataMap = new Map();
          studentList.forEach((m) => {
            if (m?.id) fullDataMap.set(m.id, m);
          });
          setFullStudentData(fullDataMap);
          
          const enrollmentPromises = studentList.map(async (s) => {
            if (!s?.id) return [];
            try {
              const { fetchStudentEnrollments } = await import('../../data/maisApiAdapter');
              return await fetchStudentEnrollments(s.id);
            } catch {
              return [];
            }
          });
          const enrollmentResults = await Promise.all(enrollmentPromises);
          const allEnrollmentsFlat = enrollmentResults.flat();
          setAllEnrollments(allEnrollmentsFlat);
          
          const ui = (studentList || []).map((m) => toUiStudentFromDb(m));
          setDbStudents(ui);
        } catch (error) {
          logger.error('[student-management] Failed to reload students', error);
        } finally {
          setLoadingStudents(false);
        }
      })();
    }
    
    // Reload meta (courses, schedule) on schedule/assignment updates
    if (payload.type === 'schedule.updated' || payload.type === 'assignment.updated') {
      // Reload courses and schedule
      (async () => {
        try {
          const teacherEmail = user?.email;
          const [crs, tt, se] = await Promise.all([
            fetchCourses(),
            teacherEmail ? fetchTeacherTimetable(teacherEmail) : Promise.resolve([]),
            fetchScheduleEvents(), // Reload all schedule events to get updated class groups
          ]);
          setAllCourses(Array.isArray(crs) ? crs : []);
          setTeacherSchedule(Array.isArray(tt) ? tt : []);
          setAllScheduleEvents(Array.isArray(se) ? se : []);
        } catch {
          // Ignore errors
        }
      })();
    }
  }, []); // Empty dependencies - all data fetched inline

  useDataUpdates(handleDataUpdate);

  // Use StudentsHub for real-time student updates
  useStudentsHub({
    onStudentAdded: useCallback((payload) => {
      console.log('[StudentManagement] Student added via StudentsHub:', payload);
      handleDataUpdate({ type: 'student.updated', action: 'added', ...payload });
    }, [handleDataUpdate]),
    onStudentUpdated: useCallback((payload) => {
      console.log('[StudentManagement] Student updated via StudentsHub:', payload);
      handleDataUpdate({ type: 'student.updated', action: 'updated', ...payload });
    }, [handleDataUpdate]),
    onStudentRemoved: useCallback((payload) => {
      console.log('[StudentManagement] Student removed via StudentsHub:', payload);
      handleDataUpdate({ type: 'student.updated', action: 'removed', ...payload });
    }, [handleDataUpdate]),
    onStudentEnrolled: useCallback((payload) => {
      console.log('[StudentManagement] Student enrolled via StudentsHub:', payload);
      handleDataUpdate({ type: 'enrollment.updated', action: 'enrolled', ...payload });
    }, [handleDataUpdate])
  });

  const groupsByCourseForTeacher = useMemo(() => {
    if (!isTeacher) return new Map();
    const map = new Map();
    const key = String(currentTeacherEmail || '').toLowerCase();
    (teacherSchedule || []).forEach((e) => {
      const set = map.get(e.courseCode) || new Set();
      (e.classGroupKeys || []).forEach((g) => {
        const nk = normalizeGroupKey(g);
        if (nk) set.add(nk);
      });
      if (set.size) map.set(e.courseCode, set);
    });
    return map;
  }, [teacherSchedule, currentTeacherEmail, isTeacher]);

  const scheduleGroups = useMemo(() => {
    if (!isTeacher) return [];
    const key = String(currentTeacherEmail || '').toLowerCase();
    const keys = new Set();
    (teacherSchedule || []).forEach((e) => {
      (e.classGroupKeys || []).forEach((g) => {
        const nk = normalizeGroupKey(g);
        if (nk) keys.add(nk);
      });
    });
    return Array.from(keys);
  }, [teacherSchedule, currentTeacherEmail, isTeacher]);

  // Get all class groups from database (schedule events with groups)
  const availableClassGroupsFromDb = useMemo(() => {
    const keys = new Set();
    // Get from all schedule events (only events that have classGroupKeys)
    (allScheduleEvents || []).forEach((e) => {
      const classGroups = e.classGroupKeys || (Array.isArray(e.classGroupKeysJson) ? e.classGroupKeysJson : []);
      if (classGroups && classGroups.length > 0) {
        classGroups.forEach((g) => {
          const nk = normalizeGroupKey(g);
          if (nk) keys.add(nk);
        });
      }
    });
    // Also get from students' className (existing classes in DB)
    (students || []).forEach((s) => {
      if (s.sectionKey) keys.add(s.sectionKey);
    });
    return Array.from(keys).sort().map((g) => ({ value: g, label: groupLabel(g) }));
  }, [allScheduleEvents, students]);

  const courseCodeFromSubjectSlug = useMemo(() => {
    // Priority 1: Use course code from URL if present
    const preset = searchParams.get('course');
    if (preset) return String(preset).toUpperCase();
    
    // Priority 2: Try to find course by subject slug
    if (!selectedSubject || selectedSubject === 'all') return '';
    
    // Check if selectedSubject contains a course code (format: "slug-code")
    const slugParts = selectedSubject.split('-');
    if (slugParts.length > 1) {
      const possibleCode = slugParts[slugParts.length - 1];
      // Check if last part looks like a course code (numeric, 8 digits)
      if (/^\d{8}$/.test(possibleCode)) {
        const catalog = isTeacher ? teacherCourses : allCourses;
        const foundByCode = (catalog || []).find((c) => String(c?.code || '').toUpperCase() === possibleCode.toUpperCase());
        if (foundByCode?.code) return String(foundByCode.code).toUpperCase();
      }
    }
    
    const catalog = isTeacher ? teacherCourses : allCourses;
    // Try to find course by matching slugified name (base slug without code)
    const baseSlug = slugParts.length > 1 && /^\d{8}$/.test(slugParts[slugParts.length - 1])
      ? slugParts.slice(0, -1).join('-') // Remove code part
      : selectedSubject;
    
    const foundCourse = (catalog || []).find((c) => {
      const nameEn = stripSubjectCode(c.nameEn || '');
      const nameSk = stripSubjectCode(c.nameSk || '');
      const name = stripSubjectCode(c.name || '');
      const slugEn = slugify(nameEn);
      const slugSk = slugify(nameSk);
      const slugName = slugify(name);
      return slugEn === baseSlug || slugSk === baseSlug || slugName === baseSlug ||
             slugEn === selectedSubject || slugSk === selectedSubject || slugName === selectedSubject;
    });
    if (foundCourse?.code) return String(foundCourse.code).toUpperCase();
    
    // Priority 3: Try to find from teacher schedule
    const fromSchedule = (teacherSchedule || []).find((row) => {
      const courseName = stripSubjectCode(row.courseName || '');
      const subject = stripSubjectCode(row.subject || '');
      const slugCourseName = slugify(courseName);
      const slugSubject = slugify(subject);
      return slugCourseName === baseSlug || slugSubject === baseSlug ||
             slugCourseName === selectedSubject || slugSubject === selectedSubject;
    });
    if (fromSchedule?.courseCode) return String(fromSchedule.courseCode).toUpperCase();
    
    return '';
  }, [selectedSubject, allCourses, teacherSchedule, teacherCourses, searchParams, isTeacher]);

  const allowedGroupsForSubject = useMemo(() => {
    if (!courseCodeFromSubjectSlug) return [];
    if (!isTeacher) return ['01-sk', '02-sk', '03-sk', '04-sk', '05-sk', '06-sk'];
    const set = groupsByCourseForTeacher.get(courseCodeFromSubjectSlug);
    const arr = set ? Array.from(set) : [];
    if (arr.length) return arr.sort();
    if (scheduleGroups.length) return scheduleGroups.sort();
    return ['01-sk', '02-sk', '03-sk', '04-sk', '05-sk', '06-sk'];
  }, [courseCodeFromSubjectSlug, groupsByCourseForTeacher, scheduleGroups, isTeacher]);

  const scheduleGroupsForCurrentCourse = useMemo(() => {
    if (!isTeacher) return [];
    if (!courseCodeFromSubjectSlug) return [];
    const set = groupsByCourseForTeacher.get(courseCodeFromSubjectSlug);
    return set ? Array.from(set).sort() : [];
  }, [isTeacher, courseCodeFromSubjectSlug, groupsByCourseForTeacher]);

  const decoratedDbStudents = useMemo(() => applyAssignments(dbStudents, rosterAssignments), [dbStudents, rosterAssignments]);

  useEffect(() => {
    let mounted = true;
    if (!rosterMode || !isTeacher || !currentTeacherEmail || !courseCodeFromSubjectSlug) {
      if (mounted) setLoadingRoster(false);
      return () => { mounted = false; };
    }
    // Only show loader if we don't have roster data yet
    if (!rosterStudentIds || rosterStudentIds.size === 0) {
      setLoadingRoster(true);
    }
    (async () => {
      try {
        const { roster } = await fetchTeacherCourseRoster(currentTeacherEmail, courseCodeFromSubjectSlug);
        const baseStudents = dbStudents;
        const byEmail = new Map(baseStudents.map((s) => [String(s.email || '').toLowerCase(), s]));
        const byId = new Map(baseStudents.map((s) => [String(s.studentId || s.id || '').toLowerCase(), s]));
        const nextAssignments = { ...rosterAssignments };
        const extras = [];
        const idSet = new Set();
        (roster || []).forEach((r) => {
          const sectionKey = normalizeGroupKey(r.groupKey);
          const emailKey = String(r.studentEmail || '').toLowerCase();
          const idKey = String(r.studentId || '').toLowerCase();
          const source = byEmail.get(emailKey) || byId.get(idKey);
          if (source) {
            const normalized = sectionKey || '';
            nextAssignments[source.id] = normalized;
            const rosterKey = String(source.id || source.studentId || source.email || '').toLowerCase();
            if (rosterKey) idSet.add(rosterKey);
          } else {
            extras.push({
              id: r.studentId,
              name: r.studentName || r.studentId,
              baseName: r.studentName || r.studentId,
              email: r.studentEmail || '',
              studentId: r.studentId,
              grade: '',
              gradeKey: '',
              sectionKey,
              section: sectionKey ? groupLabel(sectionKey) : '',
              status: 'active',
              recentGrades: [],
            });
            const rosterKey = String(r.studentId || r.studentEmail || '').toLowerCase();
            if (rosterKey) idSet.add(rosterKey);
          }
        });
        if (!mounted) return;
        let changed = false;
        const updatedBase = baseStudents.map((s) => {
          const assigned = nextAssignments[s.id];
          if (assigned === undefined) return s;
          const normalized = assigned || '';
          const label = normalized ? groupLabel(normalized) : '';
          if ((s.sectionKey || '') === normalized && (s.section || '') === label) return s;
          changed = true;
          return { ...s, sectionKey: normalized, section: label };
        });
        if (changed) setDbStudents(updatedBase);
        const decoratedBase = applyAssignments(changed ? updatedBase : baseStudents, nextAssignments);
        const assignedOnly = decoratedBase.filter((s) => Object.prototype.hasOwnProperty.call(nextAssignments, s.id));
        const merged = [...assignedOnly, ...extras];
        setRosterAssignments(nextAssignments);
        setRosterStudentIds(idSet);
        setStudents(merged);
        // When roster loads, only clear class filter if user hasn't chosen one and filters weren't initialized from URL
        // This ensures that if class was set from URL (e.g., from Roster button), it's preserved
        if (!hasUserChosenClass && !filtersInitializedRef.current) {
          // Only clear if class wasn't set and filters weren't initialized from URL
          setSelectedClass('');
        }
      } catch {
        if (mounted) setLoadingRoster(false);
      } finally {
        if (mounted) setLoadingRoster(false);
      }
    })();
    return () => { mounted = false; };
  }, [
    rosterMode,
    isTeacher,
    currentTeacherEmail,
    courseCodeFromSubjectSlug,
    dbStudents,
    selectedClass,
    hasUserChosenClass,
  ]);

  // Get students enrolled in the selected course from enrollments
  const studentsEnrolledInSelectedCourse = useMemo(() => {
    if (!courseCodeFromSubjectSlug) return new Set();
    const enrolled = new Set();
    (allEnrollments || []).forEach((e) => {
      const code = String(e.courseCode || e.code || '').trim().toUpperCase();
      if (code === courseCodeFromSubjectSlug.toUpperCase()) {
        // Find student by email or id
        const student = students.find((s) => 
          String(s.email || '').toLowerCase() === String(e.studentEmail || '').toLowerCase() ||
          String(s.id || '').toLowerCase() === String(e.studentId || '').toLowerCase()
        );
        if (student?.id) enrolled.add(student.id);
      }
    });
    return enrolled;
  }, [allEnrollments, courseCodeFromSubjectSlug, students]);

  const subjectAssignment = useMemo(() => {
    if (!courseCodeFromSubjectSlug) return { usedGroups: [], counts: new Map(), map: new Map() };
    const groups = [...allowedGroupsForSubject];
    // Filter students by enrollments for the selected course, not by recentGrades
    const eligible = students.filter((s) => studentsEnrolledInSelectedCourse.has(s.id));
    const shuffled = eligible
        .slice()
        .sort((a, b) => (H(`${courseCodeFromSubjectSlug}|${a.email || a.id}`) >>> 0) - (H(`${courseCodeFromSubjectSlug}|${b.email || b.id}`) >>> 0));
    const neededGroups = Math.max(1, Math.min(groups.length || 1, Math.ceil(shuffled.length / TARGET_GROUP_SIZE)));
    const used = groups.slice(0, Math.max(1, neededGroups));
    const map = new Map();
    const counts = new Map();
    used.forEach((g) => counts.set(g, 0));
    if (used.length === 0) return { usedGroups: [], counts, map };
    shuffled.forEach((s, i) => {
      const g = used[i % used.length];
      map.set(s.id, g);
      counts.set(g, (counts.get(g) || 0) + 1);
    });
    return { usedGroups: used, counts, map };
  }, [students, courseCodeFromSubjectSlug, allowedGroupsForSubject, studentsEnrolledInSelectedCourse]);

  const CLASS_GROUP_OPTIONS = useMemo(() => {
    // Get unique class keys from actual students (only show classes that exist)
    const existingClassKeys = Array.from(new Set((students || []).map((s) => s.sectionKey).filter(Boolean))).sort();
    
    if (rosterMode && isTeacher) {
      let keys = existingClassKeys;
      // Also include classes from rosterAssignments to ensure all classes are shown
      if (rosterAssignments && Object.keys(rosterAssignments).length > 0) {
        const rosterClassKeys = Array.from(new Set(Object.values(rosterAssignments).filter(Boolean))).sort();
        keys = Array.from(new Set([...keys, ...rosterClassKeys])).sort();
      }
      if (!keys.length && scheduleGroupsForCurrentCourse.length) {
        keys = scheduleGroupsForCurrentCourse;
      }
      const opts = keys.map((g) => ({ value: g, label: groupLabel(g) }));
      return [{ value: '', label: 'All Classes' }, ...opts];
    }
    if (!courseCodeFromSubjectSlug) {
      // Show only classes that exist in students
      if (existingClassKeys.length === 0) return [{ value: '', label: 'All Classes' }];
      const opts = existingClassKeys.map((g) => ({ value: g, label: groupLabel(g) }));
      return [{ value: '', label: 'All Classes' }, ...opts];
    }
    // Filter usedGroups to only include classes that exist in students
    const usedGroups = subjectAssignment.usedGroups.length ? subjectAssignment.usedGroups : scheduleGroupsForCurrentCourse;
    const filteredGroups = usedGroups.filter((g) => existingClassKeys.length === 0 || existingClassKeys.includes(g));
    const opts = filteredGroups.length > 0 ? filteredGroups : existingClassKeys;
    return [{ value: '', label: 'All Classes' }, ...opts.map((g) => ({ value: g, label: groupLabel(g) }))];
  }, [rosterMode, isTeacher, students, courseCodeFromSubjectSlug, subjectAssignment, scheduleGroupsForCurrentCourse, rosterAssignments]);

  // Class options filtered by selected subject (for main filter view)
  const classOptionsForSubject = useMemo(() => {
    // If no subject selected, return empty (Class filter should be disabled)
    if (!selectedSubject || selectedSubject === 'all') {
      return [{ value: '', label: 'All Classes' }];
    }

    // Get course code for the selected subject
    const courseCode = courseCodeFromSubjectSlug;
    if (!courseCode) {
      return [{ value: '', label: 'All Classes' }];
    }

    // Extract class groups from schedule events for this course
    const classKeys = new Set();
    (allScheduleEvents || []).forEach((event) => {
      const eventCode = String(event.courseCode || event.code || '').toUpperCase();
      if (eventCode === courseCode) {
        const classGroups = event.classGroupKeys || (Array.isArray(event.classGroupKeysJson) ? event.classGroupKeysJson : []);
        if (classGroups && classGroups.length > 0) {
          classGroups.forEach((g) => {
            const nk = normalizeGroupKey(g);
            if (nk) classKeys.add(nk);
          });
        }
      }
    });

    // If no classes found in schedule, return empty
    if (classKeys.size === 0) {
      return [{ value: '', label: 'All Classes' }];
    }

    const opts = Array.from(classKeys).sort().map((g) => ({ value: g, label: groupLabel(g) }));
    return [{ value: '', label: 'All Classes' }, ...opts];
  }, [selectedSubject, courseCodeFromSubjectSlug, allScheduleEvents]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    reloadStudents();
    const urlSearch = searchParams.get('search');
    if (urlSearch) setSearchQuery(String(urlSearch));
    const urlSubject = searchParams.get('subject');
    const urlClass = searchParams.get('class');
    
    // Initialize filters from URL only once, on first load
    if (!filtersInitializedRef.current && (urlSubject || urlClass)) {
      if (urlSubject) {
        const normalized = String(urlSubject).toLowerCase().trim();
        setSelectedSubject(normalized);
      }
      if (urlClass != null && urlClass !== '') {
        const normalizedClass = normalizeGroupKey(urlClass);
        if (normalizedClass) {
          setSelectedClass(normalizedClass);
          setHasUserChosenClass(true);
        } else {
          setSelectedClass(String(urlClass));
          setHasUserChosenClass(true);
        }
      }
      filtersInitializedRef.current = true; // Mark filters as initialized
    }
    const urlStatus = searchParams.get('status');
    if (urlStatus) setSelectedStatus(String(urlStatus));
    const urlSort = searchParams.get('sort');
    const urlDir = searchParams.get('dir');
    if (urlSort) setSortField(String(urlSort));
    if (urlDir === 'asc' || urlDir === 'desc') setSortDirection(urlDir);
    if (isTeacher && searchParams.get('action') === 'add') setIsAddModalOpen(true);
    bootstrappedRef.current = true;
  }, [searchParams, isTeacher, rosterMode]);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    reloadStudents();
  }, [selectedStatus]);

  // Update subject from URL only if filters weren't initialized yet (for navigation from other pages)
  useEffect(() => {
    if (filtersInitializedRef.current) return; // Don't update if already initialized
    const urlSubject = searchParams.get('subject');
    if (urlSubject) {
      const normalized = String(urlSubject).toLowerCase().trim();
      if (selectedSubject !== normalized) {
        setSelectedSubject(normalized);
        filtersInitializedRef.current = true;
      }
    }
  }, [searchParams, selectedSubject]);

  // Auto-select class when subject is selected - use the class that students are actually enrolled in
  useEffect(() => {
    if (!courseCodeFromSubjectSlug || selectedClass || filtersInitializedRef.current) return;
    // Wait for students to load
    if (students.length === 0) return;
    
    // Find classes from students who are enrolled in the selected course
    const enrolledStudentIds = new Set(studentsEnrolledInSelectedCourse);
    
    // First, try to get classes from students' sectionKey (from DB className)
    const classesFromStudents = students
      .filter((s) => enrolledStudentIds.has(s.id) && s.sectionKey)
      .map((s) => s.sectionKey)
      .filter(Boolean);
    
    // If no classes from students, try to get from enrollments via schedule events
    let classesFromEnrollments = [];
    if (classesFromStudents.length === 0 && allEnrollments.length > 0 && teacherSchedule.length > 0) {
      // Find enrollments for the selected course
      const courseEnrollments = allEnrollments.filter((e) => {
        const code = String(e.courseCode || e.code || '').trim().toUpperCase();
        return code === courseCodeFromSubjectSlug.toUpperCase();
      });
      
      // Get schedule events for this course
      const courseScheduleEvents = teacherSchedule.filter((e) => {
        const code = String(e.courseCode || e.code || '').trim().toUpperCase();
        return code === courseCodeFromSubjectSlug.toUpperCase();
      });
      
      // Create a map of scheduleEventId -> classGroupKeys
      const scheduleClassMap = new Map();
      courseScheduleEvents.forEach((event) => {
        const eventId = event.id || event.scheduleEventId || '';
        const classGroups = event.classGroupKeys || (Array.isArray(event.classGroupKeysJson) ? event.classGroupKeysJson : []);
        if (eventId && classGroups && classGroups.length > 0) {
          scheduleClassMap.set(eventId, classGroups[0]); // Use first class group
        }
      });
      
      // Find classes from enrollments that have scheduleEventId
      courseEnrollments.forEach((enrollment) => {
        const eventId = enrollment.scheduleEventId || '';
        if (eventId && scheduleClassMap.has(eventId)) {
          const classKey = scheduleClassMap.get(eventId);
          if (classKey) {
            const normalized = normalizeGroupKey(classKey);
            if (normalized) classesFromEnrollments.push(normalized);
          }
        }
      });
    }
    
    // Combine both sources
    const allClasses = [...classesFromStudents, ...classesFromEnrollments];
    
    if (allClasses.length > 0) {
      // Count frequency of each class
      const classCounts = new Map();
      allClasses.forEach((cls) => {
        classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
      });
      
      // Find the most common class (or first if tie)
      let mostCommonClass = '';
      let maxCount = 0;
      classCounts.forEach((count, cls) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonClass = cls;
        }
      });
      
      if (mostCommonClass) {
        setSelectedClass(mostCommonClass);
        setHasUserChosenClass(false); // Mark as auto-selected, not user-chosen
      }
    }
  }, [courseCodeFromSubjectSlug, selectedClass, students, studentsEnrolledInSelectedCourse, allEnrollments, teacherSchedule, filtersInitializedRef.current]);

  useEffect(() => {
    if (isTeacher && rosterMode) return;
    setStudents(decoratedDbStudents);
  }, [isTeacher, rosterMode, decoratedDbStudents]);

  useEffect(() => {
    if (!rosterMode || !isTeacher) {
      setStudents(applyAssignments(dbStudents, rosterAssignments));
    }
  }, [dbStudents, rosterAssignments, rosterMode, isTeacher]);

  const prevRosterModeRef = useRef(rosterMode && isTeacher);
  useEffect(() => {
    const prev = prevRosterModeRef.current;
    const current = rosterMode && isTeacher;
    if (prev && !current) {
      // Exiting roster mode - only reset filters if they weren't initialized from URL
      if (!filtersInitializedRef.current) {
        setSelectedSubject('all');
        setSelectedClass('');
        setHasUserChosenClass(false);
      }
      setRosterStudentIds(null);
      setStudents(decoratedDbStudents);
    } else if (!prev && current) {
      // Entering roster mode - preserve filters that were initialized from URL
      // Don't reset anything if filters were already initialized
    }
    prevRosterModeRef.current = current;
  }, [rosterMode, isTeacher, decoratedDbStudents]);

  const subjectOptions = useMemo(() => {
    const scheduleSource = teacherSchedule;
    const coursesSource = isTeacher ? teacherCourses : allCourses;
    logger.debug('[student-management] Building subject options', {
      isTeacher,
      teacherScheduleCount: teacherSchedule?.length || 0,
      teacherCoursesCount: teacherCourses?.length || 0,
      allCoursesCount: allCourses?.length || 0,
      enrollmentsCount: allEnrollments?.length || 0,
    });
    const options = buildSubjectOptions([], true, scheduleSource, coursesSource, allEnrollments, isTeacher);
    logger.debug('[student-management] Subject options built', { count: options?.length || 0, options });
    return options;
  }, [teacherSchedule, teacherCourses, allCourses, isTeacher, allEnrollments]);

  const subjectLabel = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'all') return '';
    const found = subjectOptions.find((o) => o.value === selectedSubject);
    return found ? found.label : titleize(selectedSubject);
  }, [selectedSubject, subjectOptions]);

  const filteredCount = filteredStudents.length;
  const selectedCount = selectedStudents.length;

  const subjectAverages = useMemo(() => {
    if (!selectedSubject || selectedSubject === 'all') return new Map();
    const map = new Map();
    students.forEach((s) => {
      const entries = (s.recentGrades || []).filter((g) => slugify(g.subject) === selectedSubject);
      if (entries.length) {
        const avg = Math.round(entries.reduce((acc, g) => acc + (g.score ?? 0), 0) / entries.length);
        map.set(s.id, avg);
      }
    });
    return map;
  }, [students, selectedSubject]);

  const studentSummary = useMemo(() => {
    const statusCounts = students.reduce((acc, student) => {
      const key = String(student.status || 'active').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const rostered = students.reduce((acc, student) => acc + (student.sectionKey ? 1 : 0), 0);
    const subjectAvg = subjectAverages.size
        ? Math.round(Array.from(subjectAverages.values()).reduce((sum, value) => sum + value, 0) / subjectAverages.size)
        : null;
    return {
      total: students.length,
      filtered: filteredCount,
      selected: selectedCount,
      active: statusCounts.active || 0,
      flagged: (statusCounts.inactive || 0) + (statusCounts.suspended || 0),
      graduated: statusCounts.graduated || 0,
      rostered,
      unassigned: Math.max(0, students.length - rostered),
      subjectAvg,
    };
  }, [students, filteredCount, selectedCount, subjectAverages]);

  const summaryCards = useMemo(() => {
    if (isArchivedStudyContext) {
      return [
        {
          key: 'filtered',
          label: 'Students in view',
          value: '0',
          helper: '0 selected • 0 total',
        },
        {
          key: 'active',
          label: 'Active students',
          value: '0',
          helper: '0 flagged / inactive',
        },
        {
          key: 'roster',
          label: 'Roster coverage',
          value: '0%',
          helper: '0 assigned • 0 unassigned',
        },
        {
          key: 'graduated',
          label: 'Graduated archive',
          value: '0',
          helper: 'Historical students retained for records',
        },
      ];
    }
    const total = studentSummary.total || 0;
    const rosterCoverage = total ? Math.round((studentSummary.rostered / total) * 100) : 0;
    const cards = [
      {
        key: 'filtered',
        label: 'Students in view',
        value: studentSummary.filtered.toLocaleString(),
        helper: `${studentSummary.selected.toLocaleString()} selected • ${total.toLocaleString()} total`,
      },
      {
        key: 'active',
        label: 'Active students',
        value: studentSummary.active.toLocaleString(),
        helper: `${studentSummary.flagged.toLocaleString()} flagged / inactive`,
      },
      {
        key: 'roster',
        label: 'Roster coverage',
        value: `${Number.isFinite(rosterCoverage) ? rosterCoverage : 0}%`,
        helper: `${studentSummary.rostered.toLocaleString()} assigned • ${studentSummary.unassigned.toLocaleString()} unassigned`,
      },
    ];

    if (studentSummary.subjectAvg != null && studentSummary.subjectAvg >= 0) {
      cards.push({
        key: 'subject-average',
        label: `${subjectLabel || 'Subject'} avg`,
        value: `${studentSummary.subjectAvg}%`,
        helper: subjectLabel ? `Average score in ${subjectLabel}` : 'Average score across the selected subject',
      });
    } else {
      cards.push({
        key: 'graduated',
        label: 'Graduated archive',
        value: studentSummary.graduated.toLocaleString(),
        helper: 'Historical students retained for records',
      });
    }

    return cards;
  }, [studentSummary, subjectLabel, isArchivedStudyContext]);

  const heroSubtitle = useMemo(
      () => (isTeacher
          ? 'Manage rosters, monitor engagement, and coordinate outreach in real time.'
          : 'Review cohort progress, statuses, and assignments with live updates.'),
      [isTeacher]
  );

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set();
    students.forEach(s => {
      const status = String(s.status || '').trim().toLowerCase();
      if (status) uniqueStatuses.add(status);
    });
    
    const options = [{ value: 'all', label: 'All Status' }];
    const statusOrder = ['active', 'inactive', 'suspended', 'graduated', 'archived'];
    
    statusOrder.forEach(status => {
      if (uniqueStatuses.has(status)) {
        const label = status.charAt(0).toUpperCase() + status.slice(1);
        options.push({ value: status, label });
      }
    });
    
    // Add any other statuses not in the predefined order
    uniqueStatuses.forEach(status => {
      if (!statusOrder.includes(status)) {
        const label = status.charAt(0).toUpperCase() + status.slice(1);
        options.push({ value: status, label });
      }
    });
    
    return options;
  }, [students]);

  const paginated = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return { totalPages, data: filteredStudents.slice(start, end), startIndex: start };
  }, [filteredStudents, currentPage, itemsPerPage]);

  // Auto-refresh removed - data updates via SignalR/WebSockets only

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    // Always use sectionKey from DB - don't override it with subjectAssignment
    // The sectionKey should already be set from toUiStudentFromDb based on className from DB
    let filtered = [...students];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
          (s) =>
              (s.name || '').toLowerCase().includes(q) ||
              (s.baseName || '').toLowerCase().includes(q) ||
              (s.studentId || '').toLowerCase().includes(q) ||
              (s.parentName || '').toLowerCase().includes(q) ||
              (s.email || '').toLowerCase().includes(q)
      );
    }
    // Filter by subject using enrollments, not recentGrades
    if (selectedSubject && selectedSubject !== 'all' && !(rosterMode && isTeacher)) {
      // Use enrollments to filter students by course code
      if (courseCodeFromSubjectSlug) {
        const enrolledStudentIds = new Set();
        (allEnrollments || []).forEach((e) => {
          const code = String(e.courseCode || e.code || '').trim().toUpperCase();
          if (code === courseCodeFromSubjectSlug.toUpperCase()) {
            const student = filtered.find((s) => 
              String(s.email || '').toLowerCase() === String(e.studentEmail || '').toLowerCase() ||
              String(s.id || '').toLowerCase() === String(e.studentId || '').toLowerCase()
            );
            if (student?.id) enrolledStudentIds.add(student.id);
          }
        });
        if (enrolledStudentIds.size > 0) {
          filtered = filtered.filter((s) => enrolledStudentIds.has(s.id));
        } else {
          // Fallback to recentGrades if no enrollments found
          filtered = filtered.filter((s) => (s.recentGrades || []).some((g) => slugify(g.subject) === selectedSubject));
        }
      } else {
        // Fallback to recentGrades if course code not found
        filtered = filtered.filter((s) => (s.recentGrades || []).some((g) => slugify(g.subject) === selectedSubject));
      }
    }
    if (rosterMode && isTeacher) {
      if (rosterStudentIds && rosterStudentIds.size) {
        filtered = filtered.filter((s) => rosterStudentIds.has(String(s.id || s.studentId || s.email || '').toLowerCase()));
      }
    }
    // Hide archived records unless specifically requested
    if (selectedStatus === 'archived') {
      filtered = filtered.filter((s) => s.isArchived);
    } else {
      filtered = filtered.filter((s) => !s.isArchived);
      if (selectedStatus !== 'all') filtered = filtered.filter((s) => s.status === selectedStatus);
    }
    // Grade filter removed - no longer filtering by grade
    if (courseCodeFromSubjectSlug && selectedClass) filtered = filtered.filter((s) => s.sectionKey === selectedClass);
    if (advStudentId.trim()) {
      const q = advStudentId.toLowerCase();
      filtered = filtered.filter((s) => (s.studentId || '').toLowerCase().includes(q));
    }
    if (advParentName.trim()) {
      const q = advParentName.toLowerCase();
      filtered = filtered.filter((s) => (s.parentName || '').toLowerCase().includes(q));
    }
    if (advDob) filtered = filtered.filter((s) => (s.dateOfBirth || '').slice(0, 10) === advDob);
    if (advGender !== 'all') filtered = filtered.filter((s) => (s.gender || '') === advGender);
    const getValue = (s) => {
      if (sortField === 'subjectAvg') {
        const v = subjectAverages.get(s.id);
        return v == null ? -1 : v;
      }
      if (sortField === 'lastActivity') return new Date(s.lastActivity).getTime();
      const val = s?.[sortField];
      if (typeof val === 'string') return val.toLowerCase();
      return val;
    };
    filtered.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    setFilteredStudents(filtered);
    setCurrentPage(1);
  }, [
    students,
    searchQuery,
    selectedGrade,
    selectedStatus,
    selectedClass,
    selectedSubject,
    advStudentId,
    advParentName,
    advDob,
    advGender,
    sortField,
    sortDirection,
    subjectAverages,
    courseCodeFromSubjectSlug,
    subjectAssignment,
    rosterMode,
    isTeacher,
    rosterStudentIds
  ]);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedSubject && selectedSubject !== 'all') params.set('subject', selectedSubject);
    // Grade filter removed - no longer setting in URL
    if (selectedStatus !== 'all') params.set('status', selectedStatus);
    params.set('class', selectedClass);
    if (sortField) params.set('sort', sortField);
    if (sortDirection) params.set('dir', sortDirection);
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== currentSearch) navigate({ pathname: '/student-management', search: newSearch }, { replace: true });
  }, [searchQuery, selectedSubject, selectedGrade, selectedStatus, selectedClass, sortField, sortDirection, navigate]);

  const handleLogout = () => navigate('/');

  const handleGradeChange = (value) => {
    setSelectedGrade(value || KEY_WS);
  };
  const handleClassChange = (value) => {
    setHasUserChosenClass(true);
    setSelectedClass(value ?? '');
  };

  const handleStudentSelect = (studentId, isSelected) => {
    setSelectedStudents((prev) => (isSelected ? (prev.includes(studentId) ? prev : [...prev, studentId]) : prev.filter((id) => id !== studentId)));
  };
  const handleSelectAll = (isSelected, visibleIds = []) => {
    setSelectedStudents((prev) => {
      if (isSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return Array.from(next);
      }
      const vis = new Set(visibleIds);
      return prev.filter((id) => !vis.has(id));
    });
  };
  const handleStudentClick = (student) => {
    // Get full student data from API if available
    const fullData = fullStudentData.get(student?.id) || student;
    
    setSelectedStudent(fullData);
    setIsProfileModalOpen(true);
  };

  const openChatExternal = (recipients) => {
    const participants = (recipients || []).map((s) => ({
      id: s.id,
      name: s.name || s.baseName || 'Student',
      email: s.email || '',
      role: 'student'
    }));
    try {
      sessionStorage.setItem('mais.chat.launch', JSON.stringify({ participants, meta: { source: 'students', ts: Date.now() } }));
    } catch {}
    guardedNotify('students-chat-launch', 'info', `Starting chat with ${participants.length}`);
    navigate('/chat?start=1');
  };

  const handleQuickAction = (action, student) => {
    switch (action) {
      case 'edit': {
        // Get full student data from API if available
        const fullData = fullStudentData.get(student?.id) || student;
        setSelectedStudent(fullData);
        setIsProfileModalOpen(true);
        break;
      }
      case 'graduation': {
        // Get full student data from API if available
        const fullData = fullStudentData.get(student?.id) || student;
        setSelectedStudent(fullData);
        setIsGraduationModalOpen(true);
        break;
      }
      case 'message': {
        openChatExternal([student]);
        break;
      }
      case 'records': {
        if (isTeacher) {
          navigate('/grade-management', { state: { studentId: student?.id } });
        }
        break;
      }
      case 'delete': {
        if (!isTeacher) return;
        setConfirmState({
          open: true,
          message: `Remove student "${student?.name || ''}"? This action cannot be undone.`,
          payload: student,
          type: 'single-delete',
        });
        break;
      }
      default:
        break;
    }
  };

  const handleBulkAction = (action) => {
    if (!isTeacher) return;
    const selected = students.filter((s) => selectedStudents.includes(s.id));
    if (!action) return;
    if (action === 'message') {
      if (selected.length) openChatExternal(selected);
    } else if (action === 'export') {
      const rows = [['Name', 'Email', 'Student ID'], ...selected.map((s) => [s.name, s.email, s.studentId])];
      const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `students_export_${Date.now()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      notify('success', `Exported ${selected.length} students`);
    } else if (action === 'clear-selection') {
      setSelectedStudents([]);
    } else if (action === 'delete') {
      if (!selected.length) return;
      setConfirmState({
        open: true,
        message: `Видалити ${selected.length} студентів? Дію неможливо скасувати.`,
        payload: selected,
        type: 'bulk-delete',
      });
    }
  };

  const handleConfirmClose = () => setConfirmState({ open: false, message: '', payload: null, type: null });

  const executeDelete = (target) => {
    if (!target) return;
    if (Array.isArray(target)) {
      const removeIds = new Set(target.map((s) => s.id));
      setDbStudents((prev) => prev.filter((s) => !removeIds.has(s.id)));
      setStudents((prev) => prev.filter((s) => !removeIds.has(s.id)));
      setFilteredStudents((prev) => prev.filter((s) => !removeIds.has(s.id)));
      const nextAssignments = { ...rosterAssignments };
      removeIds.forEach((id) => { if (nextAssignments[id]) delete nextAssignments[id]; });
      setRosterAssignments(nextAssignments);
      setSelectedStudents((prev) => prev.filter((id) => !removeIds.has(id)));
      if (selectedStudent && removeIds.has(selectedStudent.id)) {
        setIsProfileModalOpen(false);
        setSelectedStudent(null);
      }
      setTimeout(() => {
        notify('success', `Removed ${target.length} students`, { title: 'Students deleted' });
      }, 100);
    } else {
      const student = target;
      setDbStudents((prev) => prev.filter((s) => s.id !== student.id));
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setFilteredStudents((prev) => prev.filter((s) => s.id !== student.id));
      setSelectedStudents((prev) => prev.filter((id) => id !== student.id));
      if (rosterAssignments[student.id]) {
        const nextAssignments = { ...rosterAssignments };
        delete nextAssignments[student.id];
        setRosterAssignments(nextAssignments);
      }
      if (selectedStudent?.id === student.id) {
        setIsProfileModalOpen(false);
        setSelectedStudent(null);
      }
      setTimeout(() => {
        notify('success', 'Student removed', { title: 'Student deleted' });
      }, 100);
    }
  };

  function bridgeSearchChange() { const v = arguments[0]; setSearchQuery(String(v ?? '')); }
  function bridgeStatusChange() { const v = arguments[0]; setSelectedStatus(String(v ?? 'all')); }
  function bridgeClassChange() { const v = arguments[0]; handleClassChange(v); }
  function bridgeSubjectChange() { 
    const v = arguments[0]; 
    setSelectedSubject(String(v ?? 'all')); 
    // Clear selected class when subject changes (class depends on subject)
    setSelectedClass('');
    setHasUserChosenClass(false);
  }
  function bridgeBulkAction() { const a = arguments[0]; handleBulkAction(a); }
  function bridgeAdvChange() {
    const field = arguments[0];
    const value = arguments[1];
    if (field === 'studentId') setAdvStudentId(String(value ?? ''));
    if (field === 'parentName') setAdvParentName(String(value ?? ''));
    if (field === 'dob') setAdvDob(String(value ?? ''));
    if (field === 'gender') setAdvGender(String(value ?? 'all'));
  }
  function bridgeQuickAction() {
    const action = arguments[0];
    const data = arguments[1];
    if (action === 'search') setSearchQuery(String(data ?? ''));
  }
  function bridgeSort() {
    const f = arguments[0];
    const d = arguments[1];
    setSortField(String(f));
    setSortDirection(String(d));
  }

  const handleAddStudent = () => { if (isTeacher) setIsAddModalOpen(true); };

  const handleSaveStudent = async (studentData, opts = {}) => {
    // Determine if this is an update or create operation
    const studentEmail = studentData?.email || selectedStudent?.email || '';
    const studentId = studentData?.id || selectedStudent?.id || '';
    const existsNow = students.some((s) => {
      if (studentId && s.id === studentId) return true;
      if (studentEmail && String(s.email || '').toLowerCase() === String(studentEmail).toLowerCase()) return true;
      return false;
    });
    
    let allowedToMutateSelected = false;
    
    if (existsNow && (isTeacher || (isStudent && String(studentEmail).toLowerCase() === userEmail))) {
      // Update existing student via API
      try {
        const updated = await updateStudentProfileByEmail(studentEmail, studentData);
        if (updated?.ok !== false) {
          // Refresh student data from API
          const refreshed = await fetchStudents({ q: studentEmail, pageSize: 1 });
          const refreshedStudent = refreshed?.[0] || null;
          
          if (refreshedStudent?.id) {
            // Store full student data from API
            setFullStudentData((prev) => {
              const next = new Map(prev);
              next.set(refreshedStudent.id, refreshedStudent);
              return next;
            });
            
            // Update UI state
            const ui = toUiStudentFromDb(refreshedStudent);
            setStudents((prev) => prev.map((s) => {
              if (s.id === refreshedStudent.id || String(s.email || '').toLowerCase() === String(studentEmail).toLowerCase()) {
                return ui;
              }
              return s;
            }));
            setFilteredStudents((prev) => prev.map((s) => {
              if (s.id === refreshedStudent.id || String(s.email || '').toLowerCase() === String(studentEmail).toLowerCase()) {
                return ui;
              }
              return s;
            }));
            
            allowedToMutateSelected = true;
            setSelectedStudent(refreshedStudent);
            if (!opts.keepOpen) {
              setIsProfileModalOpen(false);
              setSelectedStudent(null);
            }
            guardedNotify('student-update-success', 'success', 'Changes saved', { title: 'Student updated' });
            return;
          }
        }
      } catch (e) {
        guardedNotify('student-update-error', 'error', 'Failed to update student', { title: 'Update failed' });
        return;
      }
    }
    
    if (!existsNow && isTeacher) {
      // Create via API, then reflect in UI
      try {
        const created = await createStudent(studentData);
        // Store full student data from API
        if (created?.id) {
          setFullStudentData((prev) => {
            const next = new Map(prev);
            next.set(created.id, created);
            return next;
          });
        }
        
        // Auto-enroll if subjects were selected
        if (studentData?._autoEnroll && Array.isArray(studentData._autoEnroll) && studentData._autoEnroll.length > 0 && created?.id) {
          try {
            const currentSem = getCurrentSemester();
            const semester = currentSem.semester === 'WS' ? 'WT' : 'ST';
            
            // Prepare selections for all subjects
            const selections = studentData._autoEnroll.map((item) => ({
              courseCode: item.courseCode,
              scheduleEventId: item.scheduleEventId,
            }));
            
            // Perform enrollment for student (teacher can create enrollment)
            const enrollResult = await createEnrollmentForStudent({
              studentId: created.id,
              academicYear: currentSem.academicYear,
              semester: semester,
              selections: selections,
            });
            
            // className is automatically set by backend from schedule event
            // Reload student to get updated className
            if (enrollResult?.className) {
              const refreshed = await fetchStudents({ q: created.email, pageSize: 1 });
              if (refreshed?.[0]?.id) {
                setFullStudentData((prev) => {
                  const next = new Map(prev);
                  next.set(refreshed[0].id, refreshed[0]);
                  return next;
                });
              }
            }
          } catch (enrollError) {
            logger.error('Auto-enrollment failed:', enrollError);
            // Don't fail the whole operation if enrollment fails
          }
        }
        
        // Normalize to UI shape expected by the table using DB fields only
        const ui = toUiStudentFromDb(created || {});
        setStudents((prev) => [...prev, ui]);
        setFilteredStudents((prev) => [...prev, ui]);
        allowedToMutateSelected = true;
        setSelectedStudent(created || studentData);
        if (!opts.keepOpen) {
          setIsProfileModalOpen(false);
          setSelectedStudent(null);
        }
        guardedNotify('student-create-success', 'success', 'Student added', { title: 'Student created' });
        return;
      } catch (e) {
        guardedNotify('student-create-error', 'error', 'Failed to add student', { title: 'Create failed' });
        return;
      }
    }
    
    // Fallback: update local state only (for non-API updates)
    setStudents((prev) => {
      const exists = prev.some((s) => {
        if (studentId && s.id === studentId) return true;
        if (studentEmail && String(s.email || '').toLowerCase() === String(studentEmail).toLowerCase()) return true;
        return false;
      });
      if (exists) {
        const target = prev.find((s) => {
          if (studentId && s.id === studentId) return true;
          if (studentEmail && String(s.email || '').toLowerCase() === String(studentEmail).toLowerCase()) return true;
          return false;
        });
        const canEditThis = isTeacher || (isStudent && String(target?.email || '').toLowerCase() === userEmail);
        if (!canEditThis) return prev;
        allowedToMutateSelected = true;
        return prev.map((s) => {
          if (s.id === studentId || String(s.email || '').toLowerCase() === String(studentEmail).toLowerCase()) {
            return { ...s, ...studentData };
          }
          return s;
        });
      }
      if (!isTeacher) return prev;
      allowedToMutateSelected = true;
      return [...prev, studentData];
    });
    
    if (allowedToMutateSelected) {
      // Update full student data if we have an ID
      if (studentId) {
        setFullStudentData((prev) => {
          const next = new Map(prev);
          const existing = next.get(studentId) || {};
          next.set(studentId, { ...existing, ...studentData });
          return next;
        });
      }
      setSelectedStudent((prev) => (prev ? { ...prev, ...studentData } : studentData));
      if (!opts.keepOpen) {
        setIsProfileModalOpen(false);
        setSelectedStudent(null);
      }
      notify('success', existsNow ? 'Changes saved' : 'Student added');
    }
  };

  const handleImportStudents = async (list = [], strategy = 'skip') => {
    if (!isTeacher) return;
    if (!list || list.length === 0) return;
    
    const byId = new Map(students.map((s) => [String(s.id), s]));
    const byEmail = new Map(students.map((s) => [String(s.email || '').toLowerCase(), s]));
    const byCode = new Map(students.map((s) => [String(s.studentId || '').toLowerCase(), s]));
    const toAdd = [];
    const toUpdate = new Map();
    const toSkip = [];
    
    list.forEach((n) => {
      const keyId = String(n.id ?? '').trim();
      const keyEmail = String(n.email ?? '').trim().toLowerCase();
      const keyCode = String(n.studentId ?? '').trim().toLowerCase();
      const hit = (keyId && byId.get(keyId)) || (keyEmail && byEmail.get(keyEmail)) || (keyCode && byCode.get(keyCode));
      if (!hit) {
        toAdd.push(n);
      } else {
        if (strategy === 'update') {
          toUpdate.set(hit.id, { ...hit, ...n });
        } else if (strategy === 'duplicate') {
          const dup = { ...n, id: Date.now() + Math.random() };
          toAdd.push(dup);
        } else {
          toSkip.push(n);
        }
      }
    });

    // Create new students via API
    if (toAdd.length > 0) {
      try {
        setLoadingStudents(true);
        const created = await Promise.all(
          toAdd.map((studentData) => createStudent(studentData))
        );
        
        // Normalize created students to UI format
        const uiStudents = created
          .filter((s) => s && s.id)
          .map((s) => toUiStudentFromDb(s));
        
        setStudents((prev) => [...prev, ...uiStudents]);
        setFilteredStudents((prev) => [...prev, ...uiStudents]);
        
        // Store full student data
        created.forEach((s) => {
          if (s?.id) {
            setFullStudentData((prev) => {
              const next = new Map(prev);
              next.set(s.id, s);
              return next;
            });
          }
        });
      } catch (error) {
        logger.error('Failed to import students', error);
        guardedNotify('student-import-api-error', 'error', 'Failed to import some students. Please check the data and try again.', {
          title: 'Import failed',
          lockMs: 3000,
        });
      } finally {
        setLoadingStudents(false);
      }
    }

    // Update existing students via API
    if (toUpdate.size > 0 && strategy === 'update') {
      try {
        setLoadingStudents(true);
        const updatePromises = Array.from(toUpdate.entries()).map(async ([id, studentData]) => {
          const existing = students.find((s) => s.id === id);
          if (!existing?.email) return null;
          try {
            await updateStudentProfileByEmail(existing.email, studentData);
            return { id, ...studentData };
          } catch (error) {
            logger.error(`Failed to update student ${id}`, error);
            return null;
          }
        });
        
        const updated = (await Promise.all(updatePromises)).filter(Boolean);
        if (updated.length > 0) {
          setStudents((prev) => prev.map((s) => {
            const updatedItem = updated.find((u) => u.id === s.id);
            return updatedItem ? toUiStudentFromDb(updatedItem) : s;
          }));
          setFilteredStudents((prev) => prev.map((s) => {
            const updatedItem = updated.find((u) => u.id === s.id);
            return updatedItem ? toUiStudentFromDb(updatedItem) : s;
          }));
        }
      } catch (error) {
        logger.error('Failed to update students', error);
        guardedNotify('student-import-update-error', 'error', 'Failed to update some students.', {
          title: 'Update failed',
          lockMs: 3000,
        });
      } finally {
        setLoadingStudents(false);
      }
    }
    setIsAddModalOpen(false);
    const updatedCount = strategy === 'update' ? toUpdate.size : 0;
    notify('success', `Imported ${toAdd.length}${updatedCount ? `, updated ${updatedCount}` : ''}`);
  };

  const canEditSelected =
      !!selectedStudent &&
      (isTeacher || (isStudent && String(selectedStudent?.email || '').toLowerCase() === userEmail));

  const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

  const confirmModal = confirmState.open ? (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={handleConfirmClose} />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card/95 backdrop-blur shadow-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-warning/20 text-warning p-2">
              <Icon name="AlertTriangle" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">Confirm deletion</h3>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{confirmState.message}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={handleConfirmClose}>Cancel</Button>
            <Button
                variant="destructive"
                onClick={() => {
                  executeDelete(confirmState.payload);
                  handleConfirmClose();
                }}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
  ) : null;

  if (!isTeacher && selectedStudyLoading && !selectedStudyValue) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header userRole="student" userName={headerDisplayName} onLogout={handleLogout} />
        <DataLoader
          label="Loading study context…"
          description="Synchronizing archived permissions and roster visibility."
          details={['Study selection preference • navigation constraints']}
          fullScreen
        />
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header userRole={isTeacher ? 'teacher' : 'student'} userName={headerDisplayName} onLogout={handleLogout} />
        <RoleSidebar
            userRole={isTeacher ? 'teacher' : 'student'}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            isCollapsed={isSidebarCollapsed}
        />

        <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Student management">
          <main className="flex-1">
            <div className="px-6 pt-3 pb-6">
              <NavigationBreadcrumb />
              {((loadingMeta || loadingStudents) && !rosterMode) || (loadingRoster && rosterMode && (!rosterStudentIds || rosterStudentIds.size === 0)) ? (
                <DataLoader
                  label="Preparing student records…"
                  description="Fetching roster, assignments, and program data."
                  details={[
                    'Faculty course map • timetable context • teacher schedule',
                    'Student registry import • modal form presets • analytics blocks',
                    'Roster synchronization & allocation summary to class groups',
                  ]}
                  fullScreen
                />
              ) : null}

              <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} className="mb-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-bold text-foreground truncate">Student Management</h1>
                    <p className="text-sm text-muted-foreground">{heroSubtitle}</p>
                  </div>
                  {selectedCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" aria-hidden="true" />
                      {selectedCount.toLocaleString()} selected for bulk actions
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {summaryCards.map((card, idx) => (
                    <motion.div
                      key={card.key}
                      initial={{ opacity: 0, y: 16 }}
                      animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: ANIMATION_DELAYS.SUMMARY_CARDS + idx * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      whileTap={{ scale: 0.995 }}
                      className="metric-card w-full"
                    >
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{card.label}</div>
                      <div className="text-2xl font-semibold text-foreground">{card.value}</div>
                      {card.helper && <div className="mt-3 text-xs text-muted-foreground leading-snug">{card.helper}</div>}
                    </motion.div>
                  ))}
                </div>
              </Reveal>

              {isArchivedStudyContext ? (
                <Reveal delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true}>
                  <div className="bg-card/90 backdrop-blur rounded-2xl border border-border/80 p-8 flex flex-col items-center text-center gap-5 shadow-card">
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-[0_15px_35px_rgba(79,70,229,.35)]">
                      <Icon name="Shield" size={28} />
                    </div>
                    <div className="space-y-3 max-w-2xl">
                      <h2 className="text-xl font-semibold text-foreground">Archived study restriction</h2>
                      <p className="text-sm text-muted-foreground italic">
                        * The system allows you to view only students/classmates who study in the same study programme and the same OŠP year as you.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Button iconName="GraduationCap" onClick={() => navigate('/study-select?return=/student-management&reset=1')}>
                        Change study
                      </Button>
                      <Button variant="outline" iconName="LayoutDashboard" onClick={() => navigate('/student-dashboard')}>
                        Go to dashboard
                      </Button>
                    </div>
                  </div>
                </Reveal>
              ) : (
                <>
              <Reveal as={motion.div} className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6" delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true}>
                <div className="xl:col-span-2">
                  <StudentTableHeader
                      searchQuery={searchQuery}
                      onSearchChange={bridgeSearchChange}
                      selectedGrade={selectedGrade}
                      onGradeChange={handleGradeChange}
                      selectedStatus={selectedStatus}
                      onStatusChange={bridgeStatusChange}
                      statusOptions={statusOptions}
                      selectedClass={selectedClass}
                      onClassChange={bridgeClassChange}
                      selectedSubject={selectedSubject}
                      onSubjectChange={bridgeSubjectChange}
                      subjectOptions={subjectOptions}
                      onAddStudent={handleAddStudent}
                      onBulkAction={bridgeBulkAction}
                      selectedCount={selectedStudents.length}
                      totalCount={filteredStudents.length}
                      showAdvancedSearch={showAdvancedSearch}
                      onToggleAdvancedSearch={() => setShowAdvancedSearch((s) => !s)}
                      advStudentId={advStudentId}
                      advParentName={advParentName}
                      advDob={advDob}
                      advGender={advGender}
                      onAdvChange={bridgeAdvChange}
                      onApplyFilters={() => {
                        setShowAdvancedSearch(false);
                        guardedNotify('students-adv-apply', 'success', 'Advanced filters applied.', { lockMs: 2400 });
                      }}
                      onClearFilters={() => {
                        setSearchQuery('');
                        setSelectedGrade(KEY_WS);
                        setSelectedStatus('all');
                        setSelectedClass('');
                        setSelectedSubject('all');
                        setAdvStudentId('');
                        setAdvParentName('');
                        setAdvDob('');
                        setAdvGender('all');
                        guardedNotify('students-adv-clear', 'info', 'Filters were reset to defaults.', { lockMs: 2400 });
                      }}
                      onOpenChat={() => {
                        const recips = students.filter((s) => selectedStudents.includes(s.id));
                        if (recips.length) openChatExternal(recips);
                      }}
                      classGroupOptions={classOptionsForSubject}
                      academicYear={ACADEMIC_YEAR}
                      allowBulkActions={isTeacher}
                      allowAdd={isTeacher}
                  />
                </div>
                <Reveal as={motion.div} className="space-y-6 xl:sticky xl:top-20 self-start" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true}>
                  <QuickActionPanel userRole={isTeacher ? 'teacher' : 'student'} onQuickAction={bridgeQuickAction} />
                </Reveal>
              </Reveal>

              <Reveal as={motion.section} className="space-y-6 mt-6" aria-labelledby="students-table" delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                <h2 id="students-table" className="sr-only">Students table</h2>
                <StudentTable
                    students={paginated.data}
                    selectedStudents={selectedStudents}
                    onSelectStudent={handleStudentSelect}
                    onSelectAll={handleSelectAll}
                    onStudentClick={handleStudentClick}
                    onQuickAction={handleQuickAction}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={bridgeSort}
                    subject={selectedSubject}
                    subjectLabel={subjectLabel}
                    subjectAverages={subjectAverages}
                    canSeeRecords={isTeacher}
                    canDelete={isTeacher}
                />

                {paginated.totalPages > 1 && (
                    <Reveal as={motion.div} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card glass-card rounded-xl border border-border p-3 sm:p-4" delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true}>
                        <div className="order-2 lg:order-1 text-sm text-muted-foreground min-w-0">
                            Showing {paginated.startIndex + 1} to {Math.min(paginated.startIndex + itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                        </div>
                        <div className="order-1 lg:order-2 w-full lg:w-auto flex items-center justify-between lg:justify-end gap-2 min-w-0">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={paginated.totalPages}
                                onChange={setCurrentPage}
                                className="w-full justify-between lg:justify-end"
                            />
                            <div className="lg:hidden text-xs text-muted-foreground text-center w-full">
                                Page {currentPage} / {paginated.totalPages}
                            </div>
                          </div>
                        </Reveal>
                    )}

              </Reveal>
                </>
              )}

            </div>
          </main>

          <PageFooter
              left={[
                `MAIS 2.0 • ${isTeacher ? 'Teacher Portal' : 'Student Portal'}`,
                lastLoginLabel,
              ]}
              actions={[
                <Button
                    key="help"
                    variant="ghost"
                    size="sm"
                    iconName="HelpCircle"
                    onClick={() => navigate('/help')}
                >
                      Help
                </Button>,
              ]}
          />
        </div>

        <StudentProfileModal
            student={selectedStudent}
            isOpen={isProfileModalOpen}
            onClose={() => {
              setIsProfileModalOpen(false);
              setSelectedStudent(null);
            }}
            onSave={handleSaveStudent}
            classGroupOptions={CLASS_GROUP_OPTIONS}
            canEdit={canEditSelected}
            viewerIsTeacher={isTeacher}
        />
        <GraduationStatusModal
            student={selectedStudent}
            isOpen={isGraduationModalOpen}
            onClose={() => {
              setIsGraduationModalOpen(false);
              setSelectedStudent(null);
            }}
            onUpdate={() => {
              setNeedRefresh(true);
            }}
        />
        {isTeacher && (
            <AddStudentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveStudent}
                onImport={handleImportStudents}
                classGroupOptions={availableClassGroupsFromDb}
                allCourses={allCourses}
                allScheduleEvents={allScheduleEvents}
            />
        )}
        {confirmModal}
      </div>
  );
};

const StudentManagement = () => {
  return (
      <ToastsProvider>
        <StudentManagementPage />
        <ToastViewport position="top-right" />
      </ToastsProvider>
  );
};

export default StudentManagement;