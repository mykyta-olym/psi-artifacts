// src/pages/grade-management/GradeManagement.jsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import Input from '../../components/ui/Input';
import GradeBookGrid from './components/GradeBookGrid';
import AssignmentManager from './components/AssignmentManager';
import GradeAnalytics from './components/GradeAnalytics';
import GradingScaleManager from './components/GradingScaleManager';
import StudentGradeCard from './components/StudentGradeCard';
import { buildGradebookForTeacher } from '../../data/gradebookApiAdapter';
import api from '../../utils/apiClient';
import { fetchTeacherCourseGrades, upsertCourseGrade, fetchCourseGradingScheme, saveCourseGradingScheme, bulkSaveAssignments, bulkSaveAssignmentGrades, listAssignments, deleteAssignment } from '../../data/maisApiAdapter';
import DataLoader from '../../components/ui/DataLoader';
import { maisId } from '../../utils/ids';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGradesHub from '../../hooks/useGradesHub';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { useNotifications } from '../../contexts/NotificationsContext';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';

const stripCourseCode = (txt = '') =>
    String(txt).replace(/\s*\(\d{5,}\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

const parseSubjectParts = (subject) => {
  const s = String(subject || '').trim();
  const withoutCode = s.replace(/\s*\(\d{5,}\)\s*$/, '').trim();
  const m = withoutCode.match(/\(([^()]{1,20})\)\s*$/);
  const abbr = m ? m[1].trim() : '';
  const full = m ? withoutCode.slice(0, m.index).trim() : withoutCode;
  return { full, abbr };
};

const subjectDisplay = (subject) => {
  const { full, abbr } = parseSubjectParts(subject);
  return abbr ? `${full} (${abbr})` : full;
};

const formatGroupLabel = (key) => {
  const s = String(key || '').trim();
  // Check if it matches XX-sk pattern
  const match = s.match(/^(\d{1,2})-?sk$/i);
  if (match) {
    return `${match[1].padStart(2, '0')}. sk`;
  }
  // Return original key for other formats (like "123-fei-cybersecurity")
  return s || 'Group';
};
function formatClassLabel(cls) {
  if (!cls) return 'Class';
  const base = subjectDisplay(cls?.name || cls?.subject || '');
  // Support both camelCase (from JSON serialization) and PascalCase (fallback)
  const classGroupKeys = cls?.classGroupKeys || cls?.ClassGroupKeys || [];
  const supplementary = Array.isArray(classGroupKeys) && classGroupKeys.length
      ? classGroupKeys.map(formatGroupLabel).join(', ')
      : (cls?.sectionKey ? formatGroupLabel(cls.sectionKey) : '');
  return [base || 'Class', supplementary].filter(Boolean).join(' • ');
}

const asString = (v) =>
    typeof v === 'string'
        ? v
        : (v && typeof v === 'object' && 'value' in v ? String(v.value) : String(v ?? ''));

const codeFromText = (s) => {
  const m = String(s || '').match(/\((\d{5,})\)\s*$/);
  return m ? m[1] : '';
};

const getProp = (obj, key) => (obj && obj[key] != null ? obj[key] : '');
const studentDisplay = (s) =>
    getProp(s, 'fullName') || getProp(s, 'displayName') || getProp(s, 'name') || getProp(s, 'email') || '—';
const studentIdOf = (s) =>
    s?.id || maisId('stu', `${getProp(s, 'email')}|${getProp(s, 'fullName') || getProp(s, 'displayName') || getProp(s, 'name')}`);

// Robust split for grade map keys that combine studentId and assignmentId.
// Supports new "::" separator and legacy hyphen keys even when IDs contain hyphens.
const splitGradeKey = (key) => {
  const k = String(key || '');
  // Preferred format: studentId::assignmentId
  const sep = '::';
  const pos = k.indexOf(sep);
  if (pos >= 0) return [k.slice(0, pos), k.slice(pos + sep.length)];
  // Legacy heuristic: try to detect start of assignmentId by its ASG- prefix
  const up = k.toUpperCase();
  const idxAsg = up.lastIndexOf('ASG-');
  if (idxAsg > 0) {
    // If there's a '-' immediately before ASG-, drop it from split
    const dashBefore = k[idxAsg - 1] === '-' ? idxAsg - 1 : idxAsg;
    const sid = k.slice(0, dashBefore);
    const aid = k.slice(dashBefore + 1);
    return [sid, aid];
  }
  // Fallback: split at the first double-dash pattern before a 2-digit checksum (rare)
  const m = k.match(/^(.*?)-(\w{2,}|[0-9a-f-]{4,})$/i);
  if (m) return [m[1], m[2]];
  // Last resort: last dash
  const last = k.lastIndexOf('-');
  if (last > 0) return [k.slice(0, last), k.slice(last + 1)];
  return [k, ''];
};

// Helper to make both legacy and new keys to keep UI compatibility
const bothGradeKeys = (sid, aid) => [
  `${sid}-${aid}`,
  `${sid}::${aid}`,
];

const GradeManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { push, setGroupMembers } = useNotifications();
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  
  // Get current academic year
  const currentAcademicYear = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const academicYearStart = currentMonth >= 9 ? currentYear : currentYear - 1;
    return `${academicYearStart}/${academicYearStart + 1}`;
  }, []);
  const toastStampsRef = useRef({});
  const guardedNotify = useCallback(
    (key, type, message, opts = {}) => {
      if (key) {
        const lockMs = opts.lockMs ?? 2800;
        const now = Date.now();
        const prev = toastStampsRef.current[key] ?? 0;
        if (now - prev < lockMs) return;
        toastStampsRef.current[key] = now;
      }
      notify(type, message, opts);
    },
    [notify]
  );
  const clearToastGuard = useCallback((key) => {
    if (!key) return;
    delete toastStampsRef.current[key];
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userRole] = useState('teacher');
  const currentUserEmail = user?.email || '';
  const headerDisplayName = useProfileDisplayName('Teacher');
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);

  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState(new Map());
  const [assignments, setAssignments] = useState([]);
  const [grades, setGrades] = useState({});
  const [finalGrades, setFinalGrades] = useState({}); // { [studentId]: { assessmentType:'WS', continuousPercent, finalPercent, totalPercent, letterGrade } }
  const [gradingScheme, setGradingScheme] = useState({ maxContinuousPoints: 40, maxFinalPoints: 60, threshold: 21 });
  const [schemeCont, setSchemeCont] = useState(40);
  const [schemeFin, setSchemeFin] = useState(60);
  const [hasPersistedScheme, setHasPersistedScheme] = useState(false);
  const schemeTotalRef = useRef(100);
  const schemeTotal = useMemo(() => {
    const total = Number(schemeTotalRef.current || 0);
    const fallback = Number(schemeCont || 0) + Number(schemeFin || 0);
    const resolved = Number.isFinite(total) && total > 0 ? total : fallback;
    return Math.max(2, resolved || 0);
  }, [schemeCont, schemeFin]);
  const schemePercent = useMemo(() => {
    if (!schemeTotal) return 0;
    const percent = (Number(schemeCont || 0) / schemeTotal) * 100;
    return Math.round(Math.min(100, Math.max(0, percent)));
  }, [schemeCont, schemeTotal]);
  const schemeSliderStyle = useMemo(
      () => ({
        '--slider-fill': `${schemePercent}%`,
        '--slider-fill-color': 'rgba(96,165,250,0.82)',
        '--slider-rest-color': 'rgba(148,163,184,0.18)',
      }),
      [schemePercent]
  );
  const schemeValueText = useMemo(
      () => `Continuous ${schemeCont} of ${schemeTotal} points (${schemePercent}%)`,
      [schemeCont, schemeTotal, schemePercent]
  );
  const schemeSliderMax = useMemo(() => Math.max(1, schemeTotal - 1), [schemeTotal]);
  const [loadingGradebook, setLoadingGradebook] = useState(true);
  const [loadingScheme, setLoadingScheme] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [savingScheme, setSavingScheme] = useState(false);

  const schemeDirty = useMemo(() => {
    const serverCont = Number(gradingScheme?.maxContinuousPoints ?? 0);
    const serverFin = Number(gradingScheme?.maxFinalPoints ?? 0);
    return Math.round(Number(schemeCont ?? 0)) !== Math.round(serverCont) ||
        Math.round(Number(schemeFin ?? 0)) !== Math.round(serverFin);
  }, [gradingScheme?.maxContinuousPoints, gradingScheme?.maxFinalPoints, schemeCont, schemeFin]);

  useEffect(() => {
    let mounted = true;
    setLoadingGradebook(true);
    (async () => {
      try {
        const gb = await buildGradebookForTeacher(currentUserEmail);
        if (!mounted) return;
        setTeacher(gb.teacher);
        setClasses(gb.classes || []);
        setClassStudents(gb.classStudents || new Map());
        setAssignments(gb.assignments || []);
        setGrades(gb.grades || {});
      } catch (e) {
        // noop: keep empty state
      } finally {
        if (mounted) setLoadingGradebook(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentUserEmail]);

  // Listen for data updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    console.log('[grade-management] handleDataUpdate called', { payload, hasType: !!payload?.type });
    if (!payload?.type) {
      console.log('[grade-management] Ignoring update - no type');
      return;
    }
    
    console.log('[grade-management] Data update received', payload);
    
    // Reload gradebook on grade/enrollment/schedule/assignment/student updates
    const shouldReload = payload.type === 'grade.updated' || 
        payload.type === 'enrollment.updated' || 
        payload.type === 'schedule.updated' || 
        payload.type === 'assignment.updated' ||
        payload.type === 'student.updated';
    
    console.log('[grade-management] Should reload?', { shouldReload, type: payload.type });
    
    if (shouldReload) {
      // Reload gradebook - don't clear existing data until new data is loaded
      (async () => {
        try {
          setLoadingGradebook(true);
          // Invalidate cache to ensure fresh data from server
          api.invalidateCache(`/teachers/${encodeURIComponent(currentUserEmail)}/gradebook`);
          api.invalidateCache('/schedule/events');
          api.invalidateCache('/courses');
          // Also invalidate roster caches for all courses
          const currentClasses = classes || [];
          currentClasses.forEach((c) => {
            if (c?.code) {
              api.invalidateCache(`/teachers/${encodeURIComponent(currentUserEmail)}/courses/${encodeURIComponent(c.code)}/roster`);
            }
          });
          const gb = await buildGradebookForTeacher(currentUserEmail, { skipCache: true });
          console.log('[grade-management] Reloaded gradebook data:', {
            classesCount: gb.classes?.length || 0,
            classes: gb.classes,
            teacher: gb.teacher?.id,
            assignmentsCount: gb.assignments?.length || 0,
            previousClassesCount: currentClasses.length
          });
          if (!gb.classes || gb.classes.length === 0) {
            console.warn('[grade-management] Warning: No classes returned from gradebook API');
            // Don't clear existing data if API returns empty - keep current state
            if (currentClasses.length > 0) {
              console.warn('[grade-management] Keeping existing classes to avoid UI flicker');
              setLoadingGradebook(false);
              return;
            }
          }
          // Only update state if we have new data or if we're replacing existing data
          setTeacher(gb.teacher);
          setClasses(gb.classes || []);
          setClassStudents(gb.classStudents || new Map());
          setAssignments(gb.assignments || []);
          setGrades(gb.grades || {});
          // Note: subjectOptions and classOptions will recalculate via useMemo when classes changes
          // The useEffect hooks will validate and update subjectFilter and selectedClass accordingly
        } catch (e) {
          console.error('[grade-management] Error reloading gradebook:', e);
          // On error, don't clear existing data - keep current state
        } finally {
          setLoadingGradebook(false);
        }
      })();
    }
  }, []); // Empty dependencies - user email and classes fetched inline

  useDataUpdates(handleDataUpdate);

  // Use GradesHub for real-time grade updates
  useGradesHub({
    onGradeUpdated: useCallback((payload) => {
      console.log('[grade-management] Grade updated via GradesHub:', payload);
      // Trigger data reload
      handleDataUpdate({ type: 'grade.updated', ...payload });
    }, [handleDataUpdate]),
    onGradeCreated: useCallback((payload) => {
      console.log('[grade-management] Grade created via GradesHub:', payload);
      handleDataUpdate({ type: 'grade.updated', ...payload });
    }, [handleDataUpdate]),
    onBulkGradesUpdated: useCallback((payload) => {
      console.log('[grade-management] Bulk grades updated via GradesHub:', payload);
      handleDataUpdate({ type: 'grade.updated', ...payload });
    }, [handleDataUpdate])
  });

  const currentUserId = teacher?.id || null;

  const [activeView, setActiveView] = useState('gradebook');
  useEffect(() => {
    setAssignments((prev) => (assignments || []).map((a) => ({
      ...a,
      id: a.id || maisId('asg', `${a.classId}|${a.name}|${a.dueDate}`),
    })));
  }, [classes]);

const [subjectFilter, setSubjectFilter] = useState('');
const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const teacherSubjects = useMemo(() => {
    const set = new Map();
    (classes || []).forEach((c) => { 
      const v = c?.name || c?.subject || ''; 
      if (v) set.set(v, v); 
    });
    const result = Array.from(set.values());
    console.log('[grade-management] teacherSubjects updated:', {
      result,
      classesCount: classes?.length || 0,
      classes: classes?.map(c => ({ id: c?.id, name: c?.name, subject: c?.subject, code: c?.code }))
    });
    return result;
  }, [classes]);

  const subjectOptions = useMemo(() => {
    const opts = teacherSubjects.map((s) => ({ value: s, label: subjectDisplay(s) }));
    console.log('[grade-management] subjectOptions updated:', {
      opts,
      teacherSubjectsCount: teacherSubjects.length
    });
    return opts;
  }, [teacherSubjects]);

  const classOptions = useMemo(() => {
    if (!subjectFilter) {
      console.log('[grade-management] classOptions: no subjectFilter');
      return [];
    }
    const courseCode = codeFromText(subjectFilter);
    const labelMatch = subjectDisplay(subjectFilter);
    const filtered = (classes || []).filter((cls) => {
      const clsCode = codeFromText(cls?.subject) || codeFromText(cls?.name);
      if (courseCode) return clsCode === courseCode;
      const clsLabel = subjectDisplay(cls?.name || cls?.subject || '');
      return clsLabel === labelMatch;
    });
    const opts = filtered.map((cls) => ({
      value: cls.id,
      label: formatClassLabel(cls),
    }));
    console.log('[grade-management] classOptions updated:', { subjectFilter, filteredCount: filtered.length, opts });
    return opts;
  }, [classes, subjectFilter]);

  useEffect(() => {
    console.log('[grade-management] classOptions useEffect:', { classOptionsLength: classOptions.length, selectedClass, classesLength: classes?.length });
    if (!classOptions.length) {
      if (selectedClass) {
        console.log('[grade-management] Clearing selectedClass (no options)');
        setSelectedClass('');
      }
      return;
    }
    // Check if current selectedClass is still valid
    const isValidSelection = selectedClass && classOptions.some((opt) => opt.value === selectedClass);
    if (!isValidSelection) {
      const newClass = classOptions[0].value;
      console.log('[grade-management] Setting selectedClass to first option:', newClass);
      setSelectedClass(newClass);
    }
  }, [classOptions, selectedClass]);

  useEffect(() => {
    console.log('[grade-management] subjectOptions useEffect:', { subjectOptionsLength: subjectOptions.length, subjectFilter, classesLength: classes?.length });
    if (!subjectOptions.length) {
      if (subjectFilter) {
        console.log('[grade-management] Clearing subjectFilter (no options)');
        setSubjectFilter('');
      }
      return;
    }
    // Check if current subjectFilter is still valid
    const isValidSelection = subjectFilter && subjectOptions.find((opt) => opt.value === subjectFilter);
    if (!isValidSelection) {
      const newSubject = subjectOptions[0].value;
      console.log('[grade-management] Setting subjectFilter to first option:', newSubject);
      setSubjectFilter(newSubject);
    }
  }, [subjectOptions, subjectFilter]);

const courseLabelForClass = (cls) => {
  if (cls) return formatClassLabel(cls);
  if (subjectFilter) return subjectDisplay(subjectFilter);
  return 'Course';
};

const currentClass = useMemo(() => {
  if (!Array.isArray(classes) || !classes.length) return null;
  return classes.find((c) => c.id === selectedClass) || null;
}, [classes, selectedClass]);

// Check if current class allows grading (only CL type allows grading)
const canGradeClass = useMemo(() => {
  if (!currentClass) return false;
  const classType = String(currentClass.kind || currentClass.type || '').toUpperCase();
  // Only CL (Class/Lab) type allows grading
  // S (Seminar) and P (Practice) have different assessment types (Zapocet)
  return classType === 'CL';
}, [currentClass]);

// Check if current class is credit-only (no exam assignments allowed)
// 'Cr' = Credit only (zapocet), 'CrEx' = Credit + Exam
const isCreditOnly = useMemo(() => {
  if (!currentClass) return false;
  const ct = String(currentClass.completionSk || '').toLowerCase().trim();
  // If completionType is 'cr', 'credit', 'zapocet', or similar - exam is NOT allowed
  // If completionType is 'crex', 'creditexam', 'credit+exam', or similar - exam IS allowed
  if (!ct || ct === 'crex' || ct === 'creditexam' || ct.includes('exam') || ct.includes('skúška') || ct.includes('skuska')) {
    return false; // Exam allowed
  }
  return true; // Credit only - no exam
}, [currentClass]);

  const resolveCourseCode = useMemo(() => codeFromText(subjectFilter), [subjectFilter]);

  // Load grading scheme for course
  useEffect(() => {
    let mounted = true;
    setLoadingScheme(true);
    (async () => {
      try {
        const code = resolveCourseCode;
        if (!code) {
          if (mounted) {
            const def = { maxContinuousPoints: 40, maxFinalPoints: 60, threshold: 21 };
            setGradingScheme(def);
            setSchemeCont(def.maxContinuousPoints);
            setSchemeFin(def.maxFinalPoints);
            schemeTotalRef.current = Math.max(
              2,
              Number(def.maxContinuousPoints || 0) + Number(def.maxFinalPoints || 0)
            );
            setHasPersistedScheme(false);
          }
          return;
        }
        const s = await fetchCourseGradingScheme(code);
        if (!mounted) return;
        if (s && typeof s.maxContinuousPoints === 'number') {
          setGradingScheme(s);
          setSchemeCont(s.maxContinuousPoints);
          setSchemeFin(s.maxFinalPoints);
          schemeTotalRef.current = Math.max(
            2,
            Number(s.maxContinuousPoints || 0) + Number(s.maxFinalPoints || 0)
          );
          setHasPersistedScheme(true);
        } else {
          const def = { maxContinuousPoints: 40, maxFinalPoints: 60, threshold: 21 };
          setGradingScheme(def);
          setSchemeCont(def.maxContinuousPoints);
          setSchemeFin(def.maxFinalPoints);
          schemeTotalRef.current = Math.max(
            2,
            Number(def.maxContinuousPoints || 0) + Number(def.maxFinalPoints || 0)
          );
          setHasPersistedScheme(false);
        }
      } catch {
        if (mounted) {
          const def = { maxContinuousPoints: 40, maxFinalPoints: 60, threshold: 21 };
          setGradingScheme(def);
          setSchemeCont(def.maxContinuousPoints);
          setSchemeFin(def.maxFinalPoints);
          schemeTotalRef.current = Math.max(
            2,
            Number(def.maxContinuousPoints || 0) + Number(def.maxFinalPoints || 0)
          );
          setHasPersistedScheme(false);
        }
      } finally {
        if (mounted) setLoadingScheme(false);
      }
    })();
    return () => { mounted = false; };
  }, [resolveCourseCode]);

  // Load existing final grades (KZ/WS) for the selected subject/course
  useEffect(() => {
    let mounted = true;
    setLoadingGrades(true);
    (async () => {
      try {
        const code = resolveCourseCode;
        if (!code) {
          if (mounted) setFinalGrades({});
          if (mounted) setLoadingGrades(false);
          return;
        }
        const list = await fetchTeacherCourseGrades(currentUserEmail, code);
        if (!mounted) return;
        const map = {};
        (list || []).forEach(g => { if (g && g.studentId) map[g.studentId] = g; });
        setFinalGrades(map);
      } catch {
        if (mounted) setFinalGrades({});
      } finally {
        if (mounted) setLoadingGrades(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentUserEmail, resolveCourseCode]);

const allowedGroupKeys = useMemo(() => {
  const acc = new Set();
  if (currentClass) {
    // Support both camelCase (from JSON serialization) and PascalCase (fallback)
    const classGroupKeys = currentClass.classGroupKeys || currentClass.ClassGroupKeys || [];
    if (Array.isArray(classGroupKeys) && classGroupKeys.length) {
      classGroupKeys.forEach((g) => g && acc.add(g));
    }
  }
  const roster = (classStudents.get(currentClass?.id) || []).map((s) => s.sectionKey).filter(Boolean);
  roster.forEach((g) => acc.add(g));
  return Array.from(acc);
}, [currentClass, classStudents]);

const groupOptions = useMemo(() => allowedGroupKeys.map((k) => ({
  value: k,
  label: formatGroupLabel(k),
})), [allowedGroupKeys]);

  const [classGroupFilter, setClassGroupFilter] = useState('');

  const hasSubjectSelection = useMemo(() => Boolean(resolveCourseCode), [resolveCourseCode]);
const hasClassSelection = useMemo(
    () => classOptions.some((opt) => opt.value === selectedClass),
    [classOptions, selectedClass]
);
const hasGroupSelection = useMemo(
    () => classGroupFilter ? allowedGroupKeys.includes(classGroupFilter) : false,
    [classGroupFilter, allowedGroupKeys]
);

const canCreateAssignments =
    hasSubjectSelection && hasClassSelection && hasGroupSelection && !loadingScheme && hasPersistedScheme && !schemeDirty;

  const assignmentLockReason = useMemo(() => {
    if (!hasSubjectSelection) return 'Select a course to manage assignments.';
  if (!hasClassSelection) return 'Select a class to manage assignments.';
  if (!groupOptions.length) return 'No class groups available for this class.';
    if (!hasGroupSelection) return 'Pick a class group to enable assignments.';
    if (loadingScheme) return 'Loading grading scheme...';
    if (!hasPersistedScheme) return 'Save the grading scheme for this course before creating assignments.';
    if (schemeDirty) return 'Save your latest grading scheme changes to continue.';
    return '';
}, [hasSubjectSelection, hasClassSelection, hasGroupSelection, groupOptions.length, loadingScheme, hasPersistedScheme, schemeDirty]);

const canSaveScheme = hasSubjectSelection && hasClassSelection && hasGroupSelection && !loadingScheme && !savingScheme;
  const saveSchemeLockReason = useMemo(() => {
    if (!hasSubjectSelection) return 'Select a course before saving.';
  if (!hasClassSelection) return 'Select a class before saving.';
  if (!groupOptions.length) return 'No class groups available for this class.';
    if (!hasGroupSelection) return 'Pick a class group before saving.';
    if (loadingScheme) return 'Wait until the grading scheme loads.';
    if (savingScheme) return 'Saving grading scheme...';
    return '';
}, [hasSubjectSelection, hasClassSelection, hasGroupSelection, groupOptions.length, loadingScheme, savingScheme]);

  const handleSaveScheme = useCallback(async () => {
    if (!canSaveScheme) return;
    const code = resolveCourseCode;
    if (!code) return;
    const sum = Number(schemeCont || 0) + Number(schemeFin || 0);
    if (sum !== schemeTotalRef.current) {
      notify('error', `Max points must total ${schemeTotalRef.current}.`, { title: 'Invalid grading scheme' });
      return;
    }
    setSavingScheme(true);
    try {
      const res = await saveCourseGradingScheme(code, { maxContinuousPoints: schemeCont, maxFinalPoints: schemeFin });
      if (res && typeof res.maxContinuousPoints === 'number') {
        setGradingScheme(res);
        setSchemeCont(res.maxContinuousPoints);
        setSchemeFin(res.maxFinalPoints);
        schemeTotalRef.current = Math.max(
          2,
          Number(res.maxContinuousPoints || 0) + Number(res.maxFinalPoints || 0)
        );
        setHasPersistedScheme(true);
        notify('success', `${res.maxContinuousPoints} + ${res.maxFinalPoints} points • threshold ${res.threshold}`, { title: 'Grading scheme saved' });
      } else {
        notify('error', 'Unable to save grading scheme. Please try again.', { title: 'Save failed' });
      }
    } catch {
      notify('error', 'Unable to save grading scheme. Please try again.', { title: 'Save failed' });
    } finally {
      setSavingScheme(false);
    }
  }, [canSaveScheme, notify, resolveCourseCode, schemeCont, schemeFin]);

  const adjustSchemeValue = useCallback(
    (target, rawValue) => {
      const total = Math.max(
        2,
        Number(schemeTotalRef.current || 0) || 100
      );
      let next = Math.round(Number(rawValue));
      if (!Number.isFinite(next)) next = 1;
      next = Math.min(total - 1, Math.max(1, next));
      const remainder = Math.max(1, total - next);
      if (target === 'continuous') {
        setSchemeCont(next);
        setSchemeFin(remainder);
      } else {
        setSchemeFin(next);
        setSchemeCont(remainder);
      }
    },
    []
  );

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch != null) setSearchQuery(urlSearch);
    const urlClassGroup = searchParams.get('class');
    if (urlClassGroup != null) setClassGroupFilter(urlClassGroup || '');
    const urlSubject = searchParams.get('subject');
    if (urlSubject) setSubjectFilter(urlSubject);
    const urlClassId = searchParams.get('course');
    if (urlClassId != null) setSelectedClass(urlClassId || '');
    const action = searchParams.get('action');
    if (action === 'entry') setActiveView('gradebook');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (classGroupFilter) params.set('class', classGroupFilter);
    if (subjectFilter) params.set('subject', String(subjectFilter));
    if (selectedClass) params.set('course', selectedClass);
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== currentSearch) {
      navigate({ pathname: '/grade-management', search: newSearch }, { replace: true });
    }
  }, [searchQuery, classGroupFilter, subjectFilter, selectedClass, navigate]);

  const visibleAssignments = useMemo(() => {
    const classId = currentClass?.id;
    const courseCode = currentClass?.code;
    const list = assignments.filter((a) => a.classId === classId || a.courseCode === courseCode);
    if (filterCategory === 'all') return list;
    return list.filter((a) => a.category === filterCategory);
  }, [assignments, currentClass?.id, currentClass?.code, filterCategory]);

  // Include all assignments in class (ignore filter) for aggregation
  const allClassAssignments = useMemo(() => {
    const classId = currentClass?.id;
    const courseCode = currentClass?.code;
    return assignments.filter((a) => a.classId === classId || a.courseCode === courseCode);
  }, [assignments, currentClass?.id, currentClass?.code]);

  const baseClassRoster = useMemo(() => classStudents.get(currentClass?.id) || [], [classStudents, currentClass?.id]);

  const classRoster = useMemo(() => {
    if (!allowedGroupKeys.length) return baseClassRoster;
    const allowed = new Set(allowedGroupKeys);
    return baseClassRoster.filter((s) => !s.sectionKey || allowed.has(s.sectionKey));
  }, [baseClassRoster, allowedGroupKeys]);

  const rosterWithMeta = useMemo(() => {
    const academicYear = currentAcademicYear || '2025/2026';
    const termText = `1. rok ${academicYear} WS`;
    const yearSlug = academicYear.replace('/', '-');
    const gradeKey = `1-rok-${yearSlug}-ws`;
    return (classRoster || []).map((s) => {
      const display = studentDisplay(s);
      // Use real sectionKey only - no synthetic assignment
      const sectionKey = s.sectionKey || '';
      const section = sectionKey ? `${String(sectionKey).slice(0, 2)}. sk` : '—';
      const ensuredId = studentIdOf(s);
      return {
        ...s,
        id: ensuredId,
        name: display,
        fullName: getProp(s, 'fullName') || display,
        displayName: display,
        gradeKey: gradeKey,
        gradeText: termText,
        sectionKey,
        section,
      };
    });
  }, [classRoster, currentAcademicYear]);

  useEffect(() => {
    if (!allowedGroupKeys.length || !rosterWithMeta.length) return;
    allowedGroupKeys.forEach((g) => {
      const ids = rosterWithMeta.filter((s) => s.sectionKey === g).map((s) => s.id).filter(Boolean);
      setGroupMembers(g, ids);
    });
  }, [allowedGroupKeys, rosterWithMeta, setGroupMembers]);

  const visibleStudents = useMemo(() => {
    let list = rosterWithMeta;
    if (classGroupFilter) {
      list = list.filter((s) => s.sectionKey === classGroupFilter);
    } else if (allowedGroupKeys.length) {
      const onlyAllowed = new Set(allowedGroupKeys);
      list = list.filter((s) => onlyAllowed.has(s.sectionKey));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((s) => {
      const n = (getProp(s, 'fullName') || getProp(s, 'name') || '').toLowerCase();
      const e = (getProp(s, 'email') || '').toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [rosterWithMeta, classGroupFilter, searchQuery, allowedGroupKeys]);

  // Helpers for WS grading UI
  const zsRows = useMemo(() => {
    const contMax = Math.max(1, gradingScheme.maxContinuousPoints || 40);
    const finMax = Math.max(1, gradingScheme.maxFinalPoints || 60);
    return (visibleStudents || []).map(s => {
      const sid = studentIdOf(s);
      const existing = finalGrades[sid] || {};
      // Prefer in-progress draft strings (cont/fin). Otherwise translate server percents -> points.
      const contFromServer = Number.isFinite(existing.continuousPercent) ? Math.round((existing.continuousPercent / 100) * contMax) : null;
      const finFromServer = Number.isFinite(existing.finalPercent) ? Math.round((existing.finalPercent / 100) * finMax) : null;
      const cont = (existing.cont != null) ? existing.cont : (Number.isFinite(contFromServer) ? contFromServer : '');
      const fin = (existing.fin != null) ? existing.fin : (Number.isFinite(finFromServer) ? finFromServer : '');
      const total = Number.isFinite(existing.totalPercent) ? existing.totalPercent : '';
      const letter = existing.letterGrade || '';
      // compute exam eligibility from points directly
      const contVal = typeof cont === 'string' ? (cont.trim() === '' ? NaN : parseInt(cont, 10)) : cont;
      const contPts = Number.isFinite(contVal) ? Math.max(0, Math.min(contMax, contVal)) : 0;
      const allowExam = contPts >= Math.max(1, gradingScheme.threshold || 0);
      return { sid, name: studentDisplay(s), email: getProp(s,'email'), sectionKey: s.sectionKey, cont, fin, total, letter, allowExam };
    });
  }, [visibleStudents, finalGrades, gradingScheme]);

  const updateFinalGradeLocal = (sid, patch) => {
    setFinalGrades(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), ...patch } }));
  };

  const saveFinalGrade = async (row) => {
    const code = resolveCourseCode;
    if (!code) return;
    const contPts = Number.isFinite(parseInt(row.cont, 10)) ? parseInt(row.cont, 10) : undefined;
    const finPts = Number.isFinite(parseInt(row.fin, 10)) ? parseInt(row.fin, 10) : undefined;
    const body = {
      studentId: row.sid,
      courseCode: code,
      teacherEmail: currentUserEmail,
      assessmentType: 'WS',
      continuousPoints: contPts,
      finalPoints: finPts,
    };
    try {
      const res = await upsertCourseGrade(body);
      if (res && res.studentId) {
        setFinalGrades(prev => ({ ...prev, [row.sid]: res }));
        const pct = Number.isFinite(res.totalPercent) ? `${res.totalPercent}%` : '';
        const letter = res.letterGrade || '';
        const details = [pct, letter].filter(Boolean).join(' • ');
        setTimeout(() => {
          guardedNotify('grade-save-success', 'success', details || 'Grade saved successfully', { title: 'Grade saved' });
        }, 100);
      } else {
        setTimeout(() => {
          guardedNotify('grade-save-failed', 'error', 'Could not save grade. Ensure Continuous meets threshold for exam.', { title: 'Save failed' });
        }, 100);
      }
    } catch (e) {
      setTimeout(() => {
        guardedNotify('grade-save-error', 'error', 'Failed to save grade', { title: 'Save failed' });
      }, 100);
    }
  };

  const classMetrics = useMemo(() => {
    const sCount = visibleStudents.length;
    const aCount = visibleAssignments.length;
    if (sCount === 0 || aCount === 0) return { avg: 0, completion: 0 };
    let sumPct = 0;
    let graded = 0;
    for (const s of visibleStudents) {
      for (const a of visibleAssignments) {
        const sid = studentIdOf(s);
        const aid = a?.id || maisId('asg', `${a.classId}|${a.name}|${a.dueDate}`);
        const g = grades[`${sid}-${aid}`];
        if (g && typeof g.percentage === 'number') {
          sumPct += g.percentage;
          graded += 1;
        }
      }
    }
    const totalCells = sCount * aCount;
    const completion = Math.round((graded / totalCells) * 100);
    const avg = graded > 0 ? Math.round(sumPct / graded) : 0;
    return { avg, completion };
  }, [visibleStudents, visibleAssignments, grades]);

  const gradeSummary = useMemo(() => {
    const rosterLists = classStudents instanceof Map
        ? Array.from(classStudents.values())
        : Array.isArray(classStudents)
            ? classStudents
            : [];
    const totalStudents = rosterLists.reduce((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
    const coursesTracked = classes.length;
    const totalAssignments = assignments.length;
    let gradedCells = 0;
    let totalCells = 0;

    assignments.forEach((assignment) => {
      const classId = assignment.classId;
      const roster = classStudents instanceof Map ? classStudents.get(classId) || [] : [];
      const aid = assignment.id || maisId('asg', `${assignment.classId}|${assignment.name}|${assignment.dueDate}`);
      roster.forEach((student) => {
        totalCells += 1;
        const sid = studentIdOf(student);
        const keys = bothGradeKeys(sid, aid);
        const entry = keys.map((k) => grades[k]).find(Boolean);
        if (entry && (Number.isFinite(entry.percentage) || Number.isFinite(entry.score) || Number.isFinite(entry.points))) {
          gradedCells += 1;
        }
      });
    });

    const completion = totalCells > 0 ? Math.round((gradedCells / totalCells) * 100) : 0;
    const upcoming = assignments.filter((a) => {
      if (!a?.dueDate) return false;
      const due = new Date(a.dueDate);
      if (Number.isNaN(due.getTime())) return false;
      return due.getTime() > Date.now();
    }).length;

    const finalized = Object.values(finalGrades || {}).filter((fg) => fg && (fg.letterGrade || Number.isFinite(fg.totalPercent))).length;

    return {
      coursesTracked,
      totalStudents,
      totalAssignments,
      completion,
      gradedCells,
      totalCells,
      upcoming,
      finalized,
    };
  }, [assignments, classes, classStudents, finalGrades, grades]);

  const heroSubtitle = useMemo(
      () => 'Keep grades, assignments, and thresholds aligned across every course.',
      []
  );

  const summaryCards = useMemo(() => {
    const cards = [
      {
        key: 'courses',
        label: 'Courses tracked',
        value: gradeSummary.coursesTracked.toLocaleString(),
        helper: `${gradeSummary.totalStudents.toLocaleString()} students across all sections`,
      },
      {
        key: 'assignments',
        label: 'Assignments catalog',
        value: gradeSummary.totalAssignments.toLocaleString(),
        helper: gradeSummary.upcoming > 0 ? `${gradeSummary.upcoming} upcoming deadlines` : 'No upcoming deadlines',
      },
      {
        key: 'coverage',
        label: 'Grade coverage',
        value: `${gradeSummary.completion}%`,
        helper: gradeSummary.totalCells > 0
            ? `${gradeSummary.gradedCells.toLocaleString()} of ${gradeSummary.totalCells.toLocaleString()} entries captured`
            : 'Awaiting first grade entries',
      },
      {
        key: 'finalized',
        label: 'Final grades posted',
        value: gradeSummary.finalized.toLocaleString(),
        helper: gradeSummary.finalized > 0 ? 'Published for student review' : 'Pending publication',
      },
    ];
    return cards;
  }, [gradeSummary]);

  const totalsByCategory = useMemo(() => {
    const sum = { continuous: 0, exam: 0 };
    for (const a of allClassAssignments) {
      if (a?.category === 'continuous') sum.continuous += Number(a.totalPoints) || 0;
      if (a?.category === 'exam') sum.exam += Number(a.totalPoints) || 0;
    }
    return sum;
  }, [allClassAssignments]);

  const fillFromAssignments = () => {
    const map = {};
    for (const row of zsRows) {
      const agg = aggregatedFromAssignments[row.sid] || { contPts: 0, examPts: 0 };
      map[row.sid] = {
        ...(finalGrades[row.sid] || {}),
        cont: agg.contPts,
        fin: agg.examPts,
      };
    }
    setFinalGrades((prev) => ({ ...prev, ...map }));
  };

  const saveAllFinalGrades = async () => {
    try {
      for (const row of zsRows) await saveFinalGrade(row);
      setTimeout(() => {
        guardedNotify('grades-save-all-success', 'success', `Saved ${zsRows.length} final grades`, { title: 'All grades saved', lockMs: 3000 });
      }, 100);
    } catch (e) {
      setTimeout(() => {
        guardedNotify('grades-save-all-error', 'error', 'Failed to save some grades', { title: 'Save failed', lockMs: 3000 });
      }, 100);
    }
  };

  // Aggregate points per student from assignments by category
  const aggregatedFromAssignments = useMemo(() => {
    const res = {};
    const contMax = Math.max(1, gradingScheme.maxContinuousPoints || 40);
    const finMax = Math.max(1, gradingScheme.maxFinalPoints || 60);
    for (const s of visibleStudents) {
      const sid = studentIdOf(s);
      let contPts = 0;
      let examPts = 0;
      for (const a of allClassAssignments) {
        // Treat any non-exam legacy category (e.g., test, quiz, homework) as continuous
        const cat = a?.category === 'exam' ? 'exam' : 'continuous';
        const key = `${sid}-${a.id}`;
        const g = grades[key];
        if (!g || !Number.isFinite(g.points)) continue;
        if (cat === 'continuous') contPts += g.points || 0;
        if (cat === 'exam') examPts += g.points || 0;
      }
      // Clamp to scheme caps
      contPts = Math.max(0, Math.min(contMax, Math.round(contPts)));
      examPts = Math.max(0, Math.min(finMax, Math.round(examPts)));
      res[sid] = { contPts, examPts };
    }
    return res;
  }, [allClassAssignments, grades, visibleStudents, gradingScheme]);

  // Save Grades: persist assignments and per-student assignment grades, then refresh final grades
  const handleSaveGrades = async () => {
    const email = currentUserEmail; const code = resolveCourseCode; const classId = currentClass?.id;
    if (!email || !code || !classId) return;
    try {
      // Only read persisted assignments (do NOT upsert here). Assignment CRUD is handled elsewhere.
      const persisted = await listAssignments(email, code);
      if (Array.isArray(persisted) && persisted.length) {
        // Build mapping oldId -> newId for same logical assignment using resilient signature
        const norm = (s='') => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
        const dateOnly = (d) => (d ? String(d).slice(0,10) : '');
        const sigOf = (a) => `${a.classId}|${norm(a.name)}|${Number(a.totalPoints)||0}`; // ignore time, use name+classId+points
        const oldBySig = new Map();
        for (const a of allClassAssignments) oldBySig.set(sigOf(a), a);
        const newBySig = new Map();
        for (const a of persisted) newBySig.set(sigOf(a), a);
        const idMap = new Map();
        for (const [sig, oldA] of oldBySig) {
          const bySig = newBySig.get(sig);
          if (bySig && oldA.id && bySig.id && oldA.id !== bySig.id) idMap.set(oldA.id, bySig.id);
        }
        // Extra: try by exact (classId|name|dateOnly) if still unmapped
        const keyOf = (a) => `${a.classId}|${norm(a.name)}|${dateOnly(a.dueDate)}`;
        if (idMap.size === 0) {
          const oldByKey = new Map();
          for (const a of allClassAssignments) oldByKey.set(keyOf(a), a);
          const newByKey = new Map();
          for (const a of persisted) newByKey.set(keyOf(a), a);
          for (const [k, oldA] of oldByKey) {
            const newA = newByKey.get(k);
            if (newA && oldA.id && newA.id && oldA.id !== newA.id) idMap.set(oldA.id, newA.id);
          }
        }

        // If IDs changed, remap local grades keys to the new assignment IDs
        if (idMap.size) {
          setGrades((prev) => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(prev)) {
              const [sid, oldAid] = splitGradeKey(key);
              if (!sid || !oldAid) continue;
              const newAid = idMap.get(oldAid);
              if (newAid) {
                for (const k of bothGradeKeys(sid, newAid)) next[k] = val;
                // clean old variants
                for (const k of bothGradeKeys(sid, oldAid)) delete next[k];
              }
            }
            return next;
          });
        }

        setAssignments(prev => {
          // merge by id, keep only for current class/course in visible lists naturally
          const map = new Map();
          for (const a of prev) map.set(a.id, a);
          for (const a of persisted) map.set(a.id, { ...map.get(a.id), ...a });
          return Array.from(map.values());
        });
      }
      // Build grade entries from current state and de-duplicate by (studentId, assignmentId)
      let entries = Object.entries(grades)
        .map(([k, v]) => {
          const [sid, aid] = splitGradeKey(k);
          if (!sid || !aid) return null;
          const pts = Math.round(Number(v?.points || 0));
          if (!Number.isFinite(pts)) return null;
          return { studentId: sid, assignmentId: aid, points: pts };
        })
        .filter(Boolean);
      // De-dupe: keep the last seen (arbitrary stable) or the max points if duplicates exist
      const uniq = new Map();
      for (const e of entries) {
        const key = `${e.studentId}::${e.assignmentId}`;
        const prev = uniq.get(key);
        if (!prev || (e.points ?? 0) >= (prev.points ?? 0)) uniq.set(key, e);
      }
      entries = Array.from(uniq.values());
      // Validate assignmentIds against persisted list; attempt to swap to a matching persisted id if needed (by signature)
      if (Array.isArray(persisted) && persisted.length) {
        const persistedInClass = persisted.filter(a => a.classId === classId);
        const persistedIds = new Set(persistedInClass.map(a => a.id));
        const norm = (s='') => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
        const sigOf = (a) => `${a.classId}|${norm(a.name)}|${Number(a.totalPoints)||0}`;
        const persistedBySig = new Map(persistedInClass.map(a => [sigOf(a), a.id]));
        const oldById = new Map(allClassAssignments.map(a => [a.id, a]));
        for (const e of entries) {
          if (!persistedIds.has(e.assignmentId)) {
            const oldA = oldById.get(e.assignmentId);
            if (oldA) {
              const repl = persistedBySig.get(sigOf(oldA));
              if (repl) e.assignmentId = repl;
            }
          }
        }
      }
      // If nothing to save, surface a clearer message and exit early
      if (!entries.length) {
        guardedNotify('grades-no-changes', 'warning', 'There are no grade changes to save for visible assignments.', {
          title: 'Nothing to save',
          lockMs: 3500,
        });
        return;
      }
      if (entries.length >= 10) {
        const sample = entries
          .slice(0, 3)
          .map((e) => `${e.studentId}→${e.assignmentId}=${e.points}`)
          .join(', ');
        guardedNotify('grades-save-progress', 'info', `Saving ${entries.length} grade entries${sample ? ` • ${sample}` : ''}`, {
          title: 'Saving grades…',
          duration: 2600,
          lockMs: 2600,
        });
      }
  const finals = await bulkSaveAssignmentGrades({ email, courseCode: code, entries });
      // After saving grades, try to refresh assignment grades from server immediately
      try {
        const gb = await api.get(`/teachers/${encodeURIComponent(email)}/gradebook`);
        const arr = Array.isArray(gb?.grades) ? gb.grades : [];
        if (arr.length) {
          setGrades((prev) => {
            const next = { ...prev };
            for (const g of arr) {
              if (!g || !g.studentId || !g.assignmentId) continue;
              const payload = {
                points: Number(g.points) || 0,
                percentage: Number(g.percentage) || 0,
                letterGrade: g.letterGrade,
                lastUpdated: g.lastUpdated,
              };
              for (const k of bothGradeKeys(g.studentId, g.assignmentId)) next[k] = payload;
            }
            return next;
          });
        }
      } catch {}
      // Fallback: if server returned empty, fetch explicitly
      let serverFinals = finals;
      if (!Array.isArray(serverFinals) || serverFinals.length === 0) {
        serverFinals = await fetchTeacherCourseGrades(email, code);
      }
      let map = {}; (serverFinals || []).forEach(f => { if (f && f.studentId) map[f.studentId] = f; });
      setFinalGrades(map);
      if (Object.keys(map).length === 0) {
        guardedNotify('grades-no-finals', 'warning', `Server returned 0 finals for ${entries.length} entries`, {
          title: 'No finals yet',
          lockMs: 3600,
        });
        // Robust fallback: compute from current assignment points and persist via /api/grades per student
        const toPersist = [];
        for (const s of visibleStudents) {
          const sid = studentIdOf(s);
          const agg = aggregatedFromAssignments[sid];
          if (!agg) continue;
          // Only persist for students who had at least one changed cell in this save batch
          const hasAnyEntry = entries.some(e => e.studentId === sid);
          if (!hasAnyEntry) continue;
          toPersist.push({ sid, contPts: Number(agg.contPts || 0), finPts: Number(agg.examPts || 0) });
        }
        if (toPersist.length) {
          for (const p of toPersist) {
            try {
              await upsertCourseGrade({
                studentId: p.sid,
                courseCode: code,
                teacherEmail: email,
                assessmentType: 'WS',
                continuousPoints: p.contPts,
                finalPoints: p.finPts,
              });
            } catch {}
          }
          const after = await fetchTeacherCourseGrades(email, code);
          const map2 = {}; (after || []).forEach(f => { if (f && f.studentId) map2[f.studentId] = f; });
          setFinalGrades(map2);
          if (Object.keys(map2).length === 0) {
            guardedNotify('grades-no-finals', 'error', 'No final grades returned. Check roster/IDs and try again.', {
              title: 'Save incomplete',
              lockMs: 3600,
            });
          } else {
            setTimeout(() => {
              notify('success', 'Grades saved and final grades updated', { title: 'Saved' });
              clearToastGuard('grades-no-finals');
              clearToastGuard('grades-no-changes');
              clearToastGuard('grades-save-progress');
            }, 100);
          }
        } else {
          setTimeout(() => {
            guardedNotify('grades-no-finals', 'error', 'No final grades returned. Check roster/IDs and try again.', {
              title: 'Save incomplete',
              lockMs: 3600,
            });
          }, 100);
        }
      } else {
        setTimeout(() => {
          notify('success', 'Grades saved and final grades updated', { title: 'Saved' });
          clearToastGuard('grades-no-finals');
          clearToastGuard('grades-no-changes');
          clearToastGuard('grades-save-progress');
        }, 100);
      }
    } catch (e) {
      setTimeout(() => {
        notify('error', 'Failed to save grades', { title: 'Save failed' });
      }, 100);
    }
  };

  const notifyGradeUpdate = (student, assignment, gradeData) => {
    const title = `Grade updated: ${assignment?.name || 'Assignment'}`;
    const message = `${student?.name || 'Student'} • ${Math.round(gradeData?.percentage || 0)}% • ${
        assignment?.totalPoints || 0
    } pts total`;
    push({
      id: `grade_${student?.id || 's'}_${assignment?.id || 'a'}_${Date.now()}`,
      type: 'success',
      title,
      message,
      time: new Date().toISOString(),
      unread: true,
      href: '/grade-management?action=entry',
      meta: {
        assignmentId: assignment?.id,
        studentId: student?.id,
        studentName: student?.name || '',
        classId: currentClass?.id || '',
        subject: subjectDisplay(subjectFilter),
        courseCode: resolveCourseCode,
      },
      category: 'grades',
      priority: 'low',
    });
  };

  const handleGradeUpdate = (studentId, assignmentId, gradeData) => {
    setGrades((prev) => {
      const next = { ...prev };
      for (const k of bothGradeKeys(studentId, assignmentId)) next[k] = gradeData;
      return next;
    });
    const student = rosterWithMeta.find((s) => s.id === studentId);
    const assignment = assignments.find((a) => a.id === assignmentId);
    notifyGradeUpdate(student, assignment, gradeData);
    setTimeout(() => {
      guardedNotify('grade-update-success', 'success', `Grade updated: ${student?.name || 'Student'} • ${Math.round(gradeData?.percentage || 0)}%`, { title: 'Grade updated', lockMs: 2000 });
    }, 100);
  };

  const notifyAssignment = (kind, a) => {
    const title =
        kind === 'create'
            ? `New assignment: ${a?.name}`
            : kind === 'update'
                ? `Assignment updated: ${a?.name}`
                : `Assignment deleted`;
    const message =
        kind === 'delete'
            ? `Removed from ${subjectDisplay(subjectFilter)}`
            : `${subjectDisplay(subjectFilter)} • ${a?.totalPoints || 0} pts • Due ${
                a?.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'
            }`;
    push({
      id: `asg_${kind}_${a?.id || Date.now()}`,
      type: kind === 'delete' ? 'info' : 'success',
      title,
      message,
      time: new Date().toISOString(),
      unread: true,
      href: '/grade-management?action=assignments',
      meta: {
        assignmentId: a?.id,
        classId: a?.classId || currentClass?.id || '',
        subject: subjectDisplay(subjectFilter),
        courseCode: resolveCourseCode,
        teacher: headerDisplayName,
      },
      category: 'grades',
      priority: 'medium',
    });
  };

  // Persist assignments for current class immediately (create/update/delete)
  const persistAssignmentsForClass = async (classAssignments, opts = {}) => {
    const email = currentUserEmail; const code = resolveCourseCode; const classId = currentClass?.id;
    if (!email || !code || !classId) return;
    try {
      const saved = await bulkSaveAssignments({ email, courseCode: code, classId, assignments: classAssignments, sync: !!opts.sync });
      const persisted = await listAssignments(email, code);
      // Remap potential ID changes and refresh local state
      const source = Array.isArray(persisted) && persisted.length ? persisted : Array.isArray(saved) ? saved : classAssignments;
      if (Array.isArray(source) && source.length) {
        const norm = (s='') => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
        const sigOf = (a) => `${a.classId}|${norm(a.name)}|${Number(a.totalPoints)||0}`;
        const oldBySig = new Map(classAssignments.map(a => [sigOf(a), a]));
        const newBySig = new Map(source.map(a => [sigOf(a), a]));
        const idMap = new Map();
        for (const [sig, oldA] of oldBySig) {
          const na = newBySig.get(sig);
          if (na && oldA.id && na.id && oldA.id !== na.id) idMap.set(oldA.id, na.id);
        }
        if (idMap.size) {
          setGrades(prev => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(prev)) {
              const [sid, oldAid] = splitGradeKey(key);
              if (!sid || !oldAid) continue;
              const newAid = idMap.get(oldAid);
              if (newAid) {
                for (const k of bothGradeKeys(sid, newAid)) next[k] = val;
                for (const k of bothGradeKeys(sid, oldAid)) delete next[k];
              }
            }
            return next;
          });
        }
        setAssignments(prev => {
          const map = new Map();
          for (const a of prev) map.set(a.id, a);
          for (const a of source) map.set(a.id, { ...map.get(a.id), ...a });
          return Array.from(map.values());
        });
      }
      notify('success', 'Assignments saved', { title: 'Saved' });
    } catch (e) {
      notify('error', 'Failed to save assignments to server', { title: 'Save failed' });
    }
  };

  const handleAssignmentCreate = (assignmentData) => {
    const safeId =
        assignmentData.id || maisId('asg', `${assignmentData.classId}|${assignmentData.name}|${assignmentData.dueDate}`);
    const payload = { ...assignmentData, id: safeId };
    setAssignments((prev) => [{ ...payload }, ...prev]);
    notifyAssignment('create', payload);
    // Persist immediately for current class
    const updatedClass = [payload, ...allClassAssignments.filter(a => a.id !== payload.id)];
    persistAssignmentsForClass(updatedClass);
  };
  const handleAssignmentUpdate = (assignmentData) => {
    setAssignments((prev) => prev.map((a) => (a.id === assignmentData.id ? assignmentData : a)));
    notifyAssignment('update', assignmentData);
    const updatedClass = allClassAssignments.map(a => (a.id === assignmentData.id ? assignmentData : a));
    persistAssignmentsForClass(updatedClass);
  };
  const handleAssignmentDelete = async (assignmentId) => {
    const existing = assignments.find((x) => x.id === assignmentId);
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    setGrades((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.endsWith(`-${assignmentId}`)) delete next[k];
      });
      return next;
    });
    notifyAssignment('delete', existing || { id: assignmentId });
    // Try dedicated DELETE endpoint first; if not available (404), fallback to bulk sync
    const email = currentUserEmail; const code = resolveCourseCode;
    if (!email || !code || !assignmentId) {
      guardedNotify(
        'assignments-delete-fallback',
        'warning',
        `Delete params missing: email=${!!email}, code=${!!code}, id=${!!assignmentId}. Falling back to sync.`,
        { title: 'Delete fallback', lockMs: 4000 }
      );
    }
    const tryDel = (email && code && assignmentId) ? await deleteAssignment(email, code, assignmentId) : { ok: false, status: 400 };

    const updatedClass = allClassAssignments.filter(a => a.id !== assignmentId);
    if (tryDel.ok) {
      // Also sync to make sure DB is clean and client IDs are aligned
      await persistAssignmentsForClass(updatedClass, { sync: true });
      notify('success', 'Assignment deleted', { title: 'Deleted' });
      return;
    }

    // Any failure -> bulk sync (server will delete missing assignments for this class)
    await persistAssignmentsForClass(updatedClass, { sync: true });
    notify('success', 'Assignment deleted via sync', { title: 'Deleted' });
  };

  const handleQuickAction = (actionId, data) => {
    switch (actionId) {
      case 'search':
        setSearchQuery(asString(data));
        setActiveView('students');
        break;
      case 'grade-entry':
        setActiveView('gradebook');
        break;
      case 'new-assignment':
        setActiveView('assignments');
        break;
      default:
        break;
    }
  };

  const lastScrollY = useRef(0);
  const rememberScroll = () => {
    lastScrollY.current = window.scrollY || 0;
  };
  const restoreScroll = () => {
    window.scrollTo(0, lastScrollY.current);
  };
  useLayoutEffect(() => {
    restoreScroll();
  }, [subjectFilter, filterCategory, searchQuery, selectedClass, activeView]);

  const categoryOptions = [
    { value: 'all', label: 'All Assignments' },
    { value: 'continuous', label: 'Continuous Assignments' },
    { value: 'exam', label: 'Exam Assignments' },
  ];

  const classOwnerEmail = teacher?.email || currentUserEmail;

  const [scPage, setScPage] = useState(1);
  const SC_PER_PAGE = 10;
  useEffect(() => {
    setScPage(1);
  }, [subjectFilter, classGroupFilter, searchQuery, activeView]);
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(visibleStudents.length / SC_PER_PAGE));
    setScPage((p) => Math.min(Math.max(1, p), tp));
  }, [visibleStudents.length]);
  const scStart = (scPage - 1) * SC_PER_PAGE;
  const scEnd = scStart + SC_PER_PAGE;
  const scTotalPages = Math.max(1, Math.ceil(visibleStudents.length / SC_PER_PAGE));
  const scSlice = useMemo(() => visibleStudents.slice(scStart, scEnd), [visibleStudents, scStart, scEnd]);

  const [expandedId, setExpandedId] = useState(null);
  useEffect(() => {
    setExpandedId(null);
  }, [subjectFilter, classGroupFilter, searchQuery, activeView, scPage, selectedClass]);

  const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

useEffect(() => {
  if (!allowedGroupKeys.length) {
    if (classGroupFilter) setClassGroupFilter('');
    return;
  }
  if (!classGroupFilter || !allowedGroupKeys.includes(classGroupFilter)) {
    // Auto-select first available group if none selected or current selection is invalid
    setClassGroupFilter(allowedGroupKeys[0] || '');
  }
}, [allowedGroupKeys, classGroupFilter, classes, classStudents]);

  return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header userRole={userRole} userName={headerDisplayName} onLogout={() => navigate('/login')} />
        <RoleSidebar
            userRole={userRole}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div
            className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}
            role="main"
            aria-label="Grade management"
        >
          <main className="flex-1">
            <div className="p-4 sm:p-6">
              <Reveal variant="keycap" className="mb-4" delay={ANIMATION_DELAYS.HERO} waitForLoaders={true}>
                <NavigationBreadcrumb />
              </Reveal>
              {(loadingGradebook || loadingScheme || loadingGrades) && (
                <DataLoader
                  label="Synchronizing grade data…"
                  description="Refreshing assignments, gradebook, and analytics."
                  details={[
                    'Course grading scheme • thresholds • assessment weights',
                    'Assignment catalogue • student submissions • point caps',
                    'Statistics dashboards • pending workflows • notifications',
                  ]}
                  fullScreen
                />
              )}

              <Reveal as={motion.section} variant="keycap" delay={ANIMATION_DELAYS.HERO} className="mb-6 space-y-4" waitForLoaders={true}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Grade Management</h1>
                    <Reveal variant="keycap" delay={ANIMATION_DELAYS.SUBTITLE} waitForLoaders={true}>
                      <p className="text-sm text-muted-foreground">{heroSubtitle}</p>
                    </Reveal>
                  </div>
                  {gradeSummary.totalAssignments > 0 && (
                    <Reveal variant="keycap" delay={ANIMATION_DELAYS.SUBTITLE} waitForLoaders={true}>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" aria-hidden="true" />
                        {gradeSummary.upcoming > 0 ? `${gradeSummary.upcoming} upcoming deadlines` : 'All deadlines cleared'}
                      </div>
                    </Reveal>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {summaryCards.map((card, idx) => (
                    <Reveal
                      key={card.key}
                      variant="pop"
                      delay={ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP * idx}
                      waitForLoaders={true}
                    >
                      <motion.div
                        className="metric-card w-full"
                        whileHover={{ y: -3, scale: 1.01 }}
                        whileTap={{ scale: 0.995 }}
                      >
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{card.label}</div>
                        <div className="text-2xl font-semibold text-foreground">{card.value}</div>
                        {card.helper && <div className="mt-3 text-xs text-muted-foreground leading-snug">{card.helper}</div>}
                      </motion.div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>

              <Reveal as={motion.section} variant="keycap" className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6" delay={ANIMATION_DELAYS.FILTERS} waitForLoaders={true}>
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Subject</span>
                        <Select
                            key={`subject-${subjectOptions.length}-${classes.length}`}
                            options={subjectOptions}
                            value={subjectFilter}
                            placeholder="Select subject"
                            onChange={(v) => {
                              const next = asString(v);
                              setSubjectFilter(next);
                              setSelectedClass('');
                              setClassGroupFilter('');
                            }}
                            className="w-full max-w-full min-w-0 [&>button]:w-full [&>button]:box-border [&>button]:pr-8 [&>button]:truncate"
                            clearable={false}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Class group</span>
                        <Select
                            key={`group-${groupOptions.length}-${allowedGroupKeys.length}-${currentClass?.id || ''}`}
                            options={groupOptions}
                            value={classGroupFilter}
                            placeholder={!hasClassSelection ? 'Select subject first' : (groupOptions.length === 0 ? 'No groups available' : 'Select class group')}
                            clearable={false}
                            onChange={(v) => setClassGroupFilter(asString(v))}
                            disabled={!hasClassSelection || groupOptions.length === 0}
                            className="w-full max-w-full min-w-0 [&>button]:w-full [&>button]:box-border [&>button]:pr-8 [&>button]:truncate"
                        />
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const showStudentSearch = activeView === 'gradebook' || activeView === 'students';
                    const showAssignmentFilter = activeView === 'gradebook' || activeView === 'assignments';
                    return (
                      <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: 'gradebook', label: 'Grade Book', icon: 'Grid3x3' },
                            { value: 'assignments', label: 'Assignments', icon: 'BookOpen' },
                            { value: 'analytics', label: 'Analytics', icon: 'BarChart3' },
                            { value: 'students', label: 'Student Cards', icon: 'Users' },
                            { value: 'settings', label: 'Grading Scale', icon: 'Settings' },
                          ].map((v) => (
                              <Button
                                  key={v.value}
                                  variant={activeView === v.value ? 'default' : 'outline'}
                                  size="sm"
                                  iconName={v.icon}
                                  onClick={() => setActiveView(v.value)}
                                  className="whitespace-nowrap"
                              >
                                {v.label}
                              </Button>
                          ))}
                        </div>

                        {(showStudentSearch || showAssignmentFilter) && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {showStudentSearch && (
                              <Input
                                  type="search"
                                  placeholder="Search students..."
                                  value={searchQuery}
                                  onChange={(e) => {
                                    rememberScroll();
                                    setSearchQuery(e.target.value);
                                  }}
                                  className="w-full"
                              />
                            )}
                            {showAssignmentFilter && (
                              <Select
                                  options={[
                                    { value: 'all', label: 'All Assignments' },
                                    { value: 'continuous', label: 'Continuous Assignments' },
                                    ...(isCreditOnly ? [] : [{ value: 'exam', label: 'Exam Assignments' }]),
                                  ]}
                                  value={filterCategory}
                                  onChange={(v) => {
                                    rememberScroll();
                                    setFilterCategory(asString(v));
                                  }}
                                  className="w-full [&>button]:w-full [&>button]:box-border [&>button]:pr-8 [&>button]:truncate"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {currentClass && (
                      <Reveal as={motion.div} variant="keycap" className="bg-card rounded-lg border border-border p-4" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} waitForLoaders={true}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                              <Icon name="BookOpen" size={20} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">
                                {stripCourseCode(currentClass.name)}
                              </h3>
                              <p className="text-sm text-muted-foreground truncate">
                                {courseLabelForClass(currentClass)} • {visibleStudents.length} students
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <p className="font-medium text-foreground">{visibleAssignments.length}</p>
                              <p className="text-muted-foreground">Assignments</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-foreground">{classMetrics.avg}%</p>
                              <p className="text-muted-foreground">Avg Grade</p>
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-foreground">{classMetrics.completion}%</p>
                              <p className="text-muted-foreground">Completion</p>
                            </div>
                          </div>
                        </div>
                      </Reveal>
                  )}

                  {/* Final Grades panel (display-only, computed by server) */}
                  {activeView === 'gradebook' && canGradeClass && (
                      <Reveal as={motion.section} variant="keycap" aria-labelledby="final-grades-title" className="bg-card rounded-lg border border-border p-4" delay={ANIMATION_DELAYS.MAIN_CONTENT} waitForLoaders={true}>
                        <h2 id="final-grades-title" className="text-lg font-semibold text-foreground mb-2">Final Grades</h2>
                        <p className="text-xs text-muted-foreground mb-3">Computed from saved assignment grades and the grading scheme. Values shown in points.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left p-2">Student</th>
                              <th className="text-center p-2">Continuous pts</th>
                              <th className="text-center p-2">Exam pts</th>
                          <th className="text-center p-2">Total pts</th>
                          <th className="text-center p-2">Letter</th>
                        </tr>
                        </thead>
                        <tbody>
                            {visibleStudents.map(s => {
                              const sid = studentIdOf(s);
                              const fg = finalGrades[sid] || {};
                              const contMax = Math.max(1, gradingScheme.maxContinuousPoints || 40);
                              const finMax = Math.max(1, gradingScheme.maxFinalPoints || 60);
                              const totalMax = contMax + finMax;
                              const contPts = Number.isFinite(fg.continuousPercent) ? Math.round((fg.continuousPercent / 100) * contMax) : (Number.isFinite(fg.continuousPoints) ? Math.round(fg.continuousPoints) : null);
                              const finPts = Number.isFinite(fg.finalPercent) ? Math.round((fg.finalPercent / 100) * finMax) : (Number.isFinite(fg.finalPoints) ? Math.round(fg.finalPoints) : null);
                              const totPts = (Number.isFinite(fg.totalPercent) ? Math.round((fg.totalPercent / 100) * totalMax) : (Number.isFinite(contPts) || Number.isFinite(finPts) ? (Number(contPts||0) + Number(finPts||0)) : null));
                              return (
                                <tr key={sid} className="border-b border-border last:border-0">
                                  <td className="p-2">
                                    <div className="font-medium text-foreground">{studentDisplay(s)}</div>
                                    <div className="text-xs text-muted-foreground">{getProp(s,'email')}</div>
                                  </td>
                                  <td className="p-2 text-center tabular-nums">{Number.isFinite(contPts) ? contPts : '—'}</td>
                                  <td className="p-2 text-center tabular-nums">{Number.isFinite(finPts) ? finPts : '—'}</td>
                                  <td className="p-2 text-center tabular-nums">{Number.isFinite(totPts) ? totPts : '—'}</td>
                                  <td className="p-2 text-center">
                                    {fg.letterGrade ? (
                                      <span className="inline-flex items-center rounded-full border border-border px-2 py-[2px] text-xs font-medium">{fg.letterGrade}</span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                        {visibleStudents.length === 0 && (
                          <tr><td className="p-2 text-muted-foreground" colSpan={6}>No students in this class/group.</td></tr>
                        )}
                        </tbody>
                      </table>
                    </div>
                  </Reveal>
                  )}
                </div>

                <Reveal as={motion.div} variant="slideScale" className="space-y-6" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} waitForLoaders={true}>
                  <Reveal variant="keycap" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                    <QuickActionPanel userRole={userRole} onQuickAction={handleQuickAction} />
                  </Reveal>
                  {/* Course info - show profile and completion type */}
                  {currentClass && (
                    <Reveal variant="keycap" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + ANIMATION_DELAYS.STEP * 1.5} waitForLoaders={true}>
                      <div className="bg-card rounded-lg border border-border p-4">
                        <h3 className="text-base font-semibold text-foreground mb-2">Course Info</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground block">Profile</span>
                            <span className="font-medium text-foreground">
                              {currentClass.profile === 'PV' ? 'Compulsory' : 
                               currentClass.profile === 'PVP' ? 'Compulsory Elective' : 
                               currentClass.profile === 'PP' ? 'Not Compulsory' :
                               currentClass.profile || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Completion</span>
                            <span className="font-medium text-foreground">
                              {isCreditOnly ? 'Credit only' : 'Credit + Exam'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Credits</span>
                            <span className="font-medium text-foreground">{currentClass.credits || '—'} ECTS</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">Class Type</span>
                            <span className="font-medium text-foreground">{currentClass.kind || currentClass.type || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  )}
                  {/* Grading Scheme editor */}
                  {activeView === 'assignments' && canGradeClass && (
                  <Reveal variant="keycap" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + ANIMATION_DELAYS.STEP * 2} waitForLoaders={true}>
                    <div className="bg-card rounded-lg border border-border p-4">
                    <h3 className="text-base font-semibold text-foreground mb-2">Grading Scheme</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {isCreditOnly 
                        ? 'Configure maximum points for continuous assessment (Credit only course).'
                        : 'Configure maximum points (Continuous + Exam). Exam unlocks at half + 1 of Continuous.'}
                    </p>
                    <div className={`grid gap-3 ${isCreditOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <Input
                          label="Max Continuous points"
                          type="number"
                          min={1}
                          size="sm"
                          value={schemeCont ?? ''}
                          inputClassName="input-no-spinner text-center font-semibold tracking-wide"
                          onChange={(e)=>adjustSchemeValue('continuous', e.target.value)}
                      />
                      {!isCreditOnly && (
                        <Input
                            label="Max Exam points"
                            type="number"
                            min={1}
                            size="sm"
                            value={schemeFin ?? ''}
                            inputClassName="input-no-spinner text-center font-semibold tracking-wide"
                            onChange={(e)=>adjustSchemeValue('exam', e.target.value)}
                        />
                      )}
                      {!isCreditOnly && (
                        <div className="col-span-2">
                          <input
                              type="range"
                              min={1}
                              max={schemeSliderMax}
                              value={schemeCont}
                              onChange={(e)=>adjustSchemeValue('continuous', e.target.value)}
                              className="scheme-slider w-full"
                              style={schemeSliderStyle}
                              aria-valuetext={schemeValueText}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Icon name="Target" size={12} className="text-primary" />
                              Continuous: <span className="text-foreground font-semibold">{schemeCont}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-primary/90 font-semibold">
                              <Icon name="Activity" size={11} className="text-primary" />
                              {schemePercent}%
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Icon name="Award" size={12} className="text-primary" />
                              Exam: <span className="text-foreground font-semibold">{schemeFin}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {!isCreditOnly && <div>Threshold: {Math.floor((schemeCont/2))+1} pts (from {schemeCont})</div>}
                        <div>Total points: {isCreditOnly ? schemeCont : schemeTotalRef.current}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Button
                            size="sm"
                            iconName="Save"
                            onClick={handleSaveScheme}
                            disabled={!canSaveScheme}
                            title={!canSaveScheme && saveSchemeLockReason ? saveSchemeLockReason : undefined}
                        >
                          {savingScheme ? 'Saving...' : 'Save Scheme'}
                        </Button>
                        {!canSaveScheme && saveSchemeLockReason && (
                            <span className="text-xs text-muted-foreground">{saveSchemeLockReason}</span>
                        )}
                      </div>
                    </div>
                    </div>
                  </Reveal>
                  )}
                </Reveal>
              </Reveal>

              <Reveal as={motion.section} variant="keycap" className="mt-6 space-y-6" delay={ANIMATION_DELAYS.MAIN_CONTENT} waitForLoaders={true}>
              {activeView === 'assignments' && (
                  <div className="space-y-6">
                    {canGradeClass ? (
                      <AssignmentManager
            assignments={visibleAssignments}
            allAssignmentsInClass={allClassAssignments}
                        visibleStudents={visibleStudents}
                        grades={grades}
                        subjectFilter={subjectFilter}
                        selectedClassId={currentClass?.id}
                        onAssignmentCreate={handleAssignmentCreate}
                        onAssignmentUpdate={handleAssignmentUpdate}
                        onAssignmentDelete={handleAssignmentDelete}
                        userRole={userRole}
                        classOwnerEmail={classOwnerEmail}
                        sessionDisplayName={headerDisplayName}
                        sessionEmail={currentUserEmail}
            maxContinuousPoints={Number.isFinite(schemeCont) ? schemeCont : gradingScheme.maxContinuousPoints}
            maxFinalPoints={Number.isFinite(schemeFin) ? schemeFin : gradingScheme.maxFinalPoints}
                        canCreateAssignments={canCreateAssignments}
                        schemeLockMessage={assignmentLockReason}
                        completionType={currentClass?.completionSk || 'CrEx'}
                    />
                    ) : (
                      <Reveal as={motion.div} variant="keycap" className="bg-card rounded-lg border border-border p-8 text-center" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                        <div className="flex flex-col items-center gap-4">
                          <div className="p-4 bg-warning/10 rounded-full">
                            <Icon name="AlertCircle" size={32} className="text-warning" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">Assignments Not Available</h3>
                            <p className="text-sm text-muted-foreground">
                              {currentClass?.kind === 'S' || currentClass?.type === 'S' 
                                ? 'Seminars (S) use a different assessment type (Zapocet) and cannot have assignments graded here.'
                                : currentClass?.kind === 'P' || currentClass?.type === 'P'
                                ? 'Practice classes (P) use a different assessment type (Zapocet) and cannot have assignments graded here.'
                                : 'Only Class/Lab (CL) type courses can have assignments graded in this system.'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Class type: <span className="font-medium">{currentClass?.kind || currentClass?.type || 'Unknown'}</span>
                            </p>
                          </div>
                        </div>
                      </Reveal>
                    )}
                  </div>
              )}

              {activeView === 'gradebook' && (
                  <div className="space-y-6">
                    {canGradeClass ? (
                      <GradeBookGrid
                          students={visibleStudents}
                          assignments={visibleAssignments}
                          grades={grades}
                          onGradeUpdate={handleGradeUpdate}
                          onSaveGrades={handleSaveGrades}
                          userRole={userRole}
                          selectedClass={currentClass}
                          currentUserId={currentUserId}
                          currentUserEmail={currentUserEmail}
                          classOwnerEmail={classOwnerEmail}
                      />
                    ) : (
                      <Reveal as={motion.div} variant="keycap" className="bg-card rounded-lg border border-border p-8 text-center" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                        <div className="flex flex-col items-center gap-4">
                          <div className="p-4 bg-warning/10 rounded-full">
                            <Icon name="AlertCircle" size={32} className="text-warning" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">Grading Not Available</h3>
                            <p className="text-sm text-muted-foreground">
                              {currentClass?.kind === 'S' || currentClass?.type === 'S' 
                                ? 'Seminars (S) use a different assessment type (Zapocet) and cannot be graded here.'
                                : currentClass?.kind === 'P' || currentClass?.type === 'P'
                                ? 'Practice classes (P) use a different assessment type (Zapocet) and cannot be graded here.'
                                : currentClass?.kind || currentClass?.type
                                ? `This class type (${currentClass.kind || currentClass.type}) cannot be graded in this system.`
                                : 'No class or subject has been selected. Please select a class from the list to start grading.'}
                            </p>
                            {(currentClass?.kind || currentClass?.type) && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Class type: <span className="font-medium">{currentClass?.kind || currentClass?.type}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </Reveal>
                    )}
                  </div>
              )}

              {activeView !== 'gradebook' && activeView !== 'assignments' && (
                  <div className="space-y-6">
                    {activeView === 'analytics' && (
                        <GradeAnalytics
                            students={visibleStudents}
                            assignments={visibleAssignments}
                            grades={grades}
                            selectedClass={currentClass}
                        />
                    )}

                    {activeView === 'students' && (
                        <>
                          <div className="columns-1 md:columns-2 gap-4 [column-fill:balance]">
                            {scSlice.map((s) => (
                                <div key={s.id} className="mb-4 break-inside-avoid">
                                  <StudentGradeCard
                                      student={s}
                                      assignments={visibleAssignments}
                                      grades={grades}
                                      onGradeUpdate={handleGradeUpdate}
                                      userRole={userRole}
                                      expanded={expandedId === s.id}
                                      onExpandedChange={(next) => {
                                        setExpandedId((prev) => (next ? s.id : prev === s.id ? null : prev));
                                      }}
                                  />
                                </div>
                            ))}
                          </div>

                          {visibleStudents.length === 0 && (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                              No students assigned to you yet.
                            </div>
                          )}

                          {scTotalPages > 1 && (
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card glass-card rounded-xl border border-border p-3 sm:p-4">
                                <div className="order-2 lg:order-1 text-sm text-muted-foreground">
                                  Showing {Math.min(scStart + 1, visibleStudents.length)} to {Math.min(scEnd, visibleStudents.length)} of {visibleStudents.length} students
                                </div>
                                <div className="order-1 lg:order-2 w-full lg:w-auto">
                                  <Pagination currentPage={scPage} totalPages={scTotalPages} onChange={setScPage} className="justify-between lg:justify-end" />
                                </div>
                              </div>
                          )}
                        </>
                    )}

                    {activeView === 'settings' && (
                        <GradingScaleManager currentScale="standard" userRole={userRole} onScaleUpdate={() => {}} />
                    )}
                  </div>
              )}
            </Reveal>
          </div>
          </main>

          <PageFooter
              left={[
                'MAIS 2.0 • Teacher Portal',
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
              containerClassName="px-4 sm:px-6"
          />
        </div>
      </div>
  );
};

const GradeManagement = () => (
  <ToastsProvider>
    <GradeManagementPage />
    <ToastViewport position="top-right" />
  </ToastsProvider>
);

export default GradeManagement;