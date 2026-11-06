// src/pages/class-schedule-management/index.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import ScheduleCalendar from './components/ScheduleCalendar';
import ScheduleFilters from './components/ScheduleFilters';
import ResourcePanel from './components/ResourcePanel';
import ScheduleModal from './components/ScheduleModal';
import ScheduleStats from './components/ScheduleStats';
import ClassGroupManagement from './components/ClassGroupManagement';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import TabBar from '../../components/ui/TabBar';
import PageFooter from '../../components/ui/PageFooter';
import DataLoader from '../../components/ui/DataLoader';
import { motion } from 'framer-motion';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import { fetchScheduleEvents, fetchCourses, fetchFaculty, fetchRooms, fetchEquipment, createScheduleEvent, fetchStudentEnrollments, fetchStudents, updateScheduleEvent, deleteScheduleEvent, fetchClassGroups } from '../../data/maisApiAdapter';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import { displayNameFrom } from '../../utils/displayName';
import { formatLastLogin } from '../../utils/datetime';
import { useNotifications } from '../../contexts/NotificationsContext';
import { ToastsProvider, useToasts, ToastViewport } from '../../components/ui/Toasts';
import useDataUpdates from '../../hooks/useDataUpdates';
import useScheduleHub from '../../hooks/useScheduleHub';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { createValidator, custom as customRule, required } from '../../utils/validation';
import { extractApiErrorMessage } from '../../utils/apiErrors';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// Static hourly slots for placement; API events with arbitrary times are normalized to nearest slots
const TIME_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

const slug = (s = '') => {
  const normalized = String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return normalized;
};
const unslug = (s = '') => s.toString().trim().replace(/-/g, ' ');
const norm = (s = '') => s.toString().trim().toLowerCase();
const unique = (arr = []) => Array.from(new Set(arr));
const sortStrings = (arr = []) => [...arr].sort((a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true }));
const normalizeSubjectKey = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const TITLE_PREFIX_RE = /^(?:Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|Mgr\. art\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+/i;
const TITLE_SUFFIX_RE = /\s*,\s*(?:PhD\.|CSc\.|DrSc\.|MBA|Th\.D\.|ArtD\.)$/i;
const stripTitles = (raw = '') => {
  let name = String(raw || '').trim();
  if (!name) return '';
  let prev;
  do {
    prev = name;
    name = name.replace(TITLE_PREFIX_RE, '').trim();
  } while (prev !== name);
  do {
    prev = name;
    name = name.replace(TITLE_SUFFIX_RE, '').trim();
  } while (prev !== name);
  return name.replace(/\s+/g, ' ').trim();
};
const asYear = (periodSk = '') => {
  const m = String(periodSk).match(/(\d+)\.\s*rok/i);
  return m ? m[1] : '1';
};

const groupOrder = (key = '') => parseInt(String(key).split('-')[0], 10) || 0;
const sortGroupKeys = (keys = []) => [...keys].sort((a, b) => groupOrder(a) - groupOrder(b));
const labelForKey = (key, classGroups = []) => classGroups.find((g) => g.value === key || g.id === key || g.groupKey === key)?.label || classGroups.find((g) => g.name === key)?.name || key;
const textForGroupKeys = (keys = [], classGroups = []) => sortGroupKeys(keys).map(k => labelForKey(k, classGroups)).join(', ');

const slotTimes = (slot = '') => {
  const [s, e] = String(slot).split('-').map((x) => String(x || '').trim());
  return { start: s || '09:00', end: e || (s ? s : '10:00') };
};

const timeToMinutes = (t = '00:00') => {
  const [hh, mm] = String(t).split(':').map((n) => parseInt(n, 10));
  return (hh || 0) * 60 + (mm || 0);
};
const nearestSlot = (t = '00:00') => {
  const target = timeToMinutes(t);
  let best = TIME_SLOTS[0];
  let bestDiff = Infinity;
  for (const s of TIME_SLOTS) {
    const diff = Math.abs(timeToMinutes(s) - target);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best;
};

const firstMonday = (year, monthIndex) => {
  const d = new Date(year, monthIndex, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const detectConflicts = (list = []) => {
  const next = list.map((e) => ({ ...e, hasConflict: false }));
  const index = new Map();
  next.forEach((e) => {
    const r = norm(e.room);
    if (!r) return;
    const key = `${e.day}||${e.time}||${r}`;
    index.set(key, (index.get(key) || 0) + 1);
  });
  next.forEach((e) => {
    const r = norm(e.room);
    if (!r) return;
    const key = `${e.day}||${e.time}||${r}`;
    if ((index.get(key) || 0) > 1) e.hasConflict = true;
  });
  return next;
};

const isLectureKind = (k = '') => {
  const s = String(k || '').trim().toUpperCase();
  if (!s) return false;
  return s === 'P' || s === 'L' || s.includes('LECT');
};

function applyLectureLock(list = []) {
  // Map of teacherEmail|courseCode -> total enrollments on non-lecture events
  const keyOf = (e) => `${String(e.teacherEmail||'').toLowerCase()}|${String(e.courseCode||'').toLowerCase()}`;
  const agg = new Map();
  (list || []).forEach((e) => {
    if (!e) return;
    const k = keyOf(e);
    const isLect = isLectureKind(e.kind);
    const cnt = Number.isFinite(e.enrollmentsCount) ? e.enrollmentsCount : 0;
    if (!isLect && cnt > 0) agg.set(k, (agg.get(k) || 0) + cnt);
  });
  return (list || []).map((e) => {
    if (!e) return e;
    const baseLocked = !!e.locked || ((e.enrollmentsCount || 0) > 0);
    if (baseLocked) return { ...e, locked: true };
    if (isLectureKind(e.kind)) {
      const k = keyOf(e);
      const hasGroupEnrollments = (agg.get(k) || 0) > 0;
      if (hasGroupEnrollments) return { ...e, locked: true };
    }
    return { ...e, locked: false };
  });
}

function buildFromApiEvents(events = [], facultyList = [], coursesList = [], classGroups = []) {
  const findCourseByCode = (code) => (coursesList || []).find((c) => String(c.code) === String(code)) || null;
  const findTeacherByEmail = (email) => (facultyList || []).find((f) => (f.email || '').toLowerCase() === String(email || '').toLowerCase()) || null;
  const base = (events || []).map((ev, idx) => {
    const code = ev.code || ev.courseCode || '';
    const c = findCourseByCode(code);
    const t = findTeacherByEmail(ev.teacherEmail || ev.email);
    const teacherRaw = t ? (t.displayName || t.name || t.fullName || t.email) : (ev.teacher || ev.teacherName || ev.teacherEmail || '—');
    const teacherName = stripTitles(teacherRaw) || teacherRaw;
    const slot = ev.slot || `${ev.start || ev.startTime || '09:00'}-${ev.end || ev.endTime || '10:00'}`;
  const { start, end } = slotTimes(slot);
  const snappedStart = nearestSlot(start);
  const snappedEnd = nearestSlot(end);
    const providedKeys = Array.isArray(ev.classGroupKeys) && ev.classGroupKeys.length ? sortGroupKeys(ev.classGroupKeys) : [];
    const groups = {
      keys: providedKeys,
      labels: providedKeys.map(k => labelForKey(k, classGroups)),
      text: providedKeys.length ? textForGroupKeys(providedKeys, classGroups) : '',
    };
    // Strip any existing "Groups:..." from notes to avoid duplication
    const rawNote = (ev.note || ev.notes || '')
        .replace(/\s*•?\s*Groups:\s*[^•]*/gi, '')
        .replace(/\s*•\s*$/g, '')
        .trim();
    const notePieces = [];
    if (rawNote) notePieces.push(rawNote);
    if (providedKeys.length) notePieces.push(`Groups: ${groups.text}`);
    const kind = ev.type || (idx % 2 === 0 ? 'P' : 'CL');
    const id = ev.id || ev.Id || ev._id || `evt-${idx}-${code}`;
    return {
      id,
      subject: c?.nameEn || c?.nameSk || ev.subject || ev.courseName || code,
      courseCode: code || null,
      teacher: teacherName,
      teacherEmail: t?.email || ev.teacherEmail || null,
      grade: `Year ${asYear(c?.periodSk || '')}`,
      room: ev.room || ev.location || '',
      day: ev.day,
  time: snappedStart,
  endTime: snappedEnd,
      classGroupKeys: sortGroupKeys(groups.keys),
      classGroupLabels: groups.labels.sort((a, b) => groupOrder(a) - groupOrder(b)),
      classGroupText: groups.text,
      hasConflict: false,
      kind,
      notes: notePieces.filter(Boolean).join(' • '),
      enrollmentsCount: Number.isFinite(ev?.enrollmentsCount) ? ev.enrollmentsCount : 0,
      locked: (Number.isFinite(ev?.enrollmentsCount) ? ev.enrollmentsCount : 0) > 0,
      program: c?.program || ev.program || null,
      faculty: c?.faculty || ev.faculty || null,
    };
  });
  return detectConflicts(base);
}

const withConflicts = (list) => detectConflicts(list || []);

const makeInitialFilters = (name, role) => ({
  year: 'all',
  teacher: role === 'student' ? 'all' : slug(name) || 'all',
  subject: 'all',
  room: 'all',
  classGroup: 'all',
  faculty: 'all',
  program: 'all',
  search: '',
  conflicts: false,
  today: false,
  available: false,
});

const ClassScheduleManagementInner = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { notifyScheduleChange } = useNotifications() || {};
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
  const toastGuard = useRef({});
  const guardedNotify = useCallback(
    (key, type, message, opts = {}) => {
      if (key) {
        const now = Date.now();
        const lockMs = opts.lockMs ?? 5000;
        const prev = toastGuard.current[key] ?? 0;
        if (now - prev < lockMs) return;
        toastGuard.current[key] = now;
        // Auto-clear after lock period
        setTimeout(() => {
          delete toastGuard.current[key];
        }, lockMs);
      }
      notify(type, message, opts);
    },
    [notify]
  );
  const clearToastGuard = useCallback((key) => {
    if (!key) return;
    delete toastGuard.current[key];
  }, []);

  const scheduleValidationSchema = useMemo(
    () => ({
      subject: [required('Subject is required')],
      room: [required('Room is required')],
      day: [
        required('Day is required'),
        customRule('Invalid day', {
          validate: (value) => !value || WEEK_DAYS.includes(value),
        }),
      ],
      time: [
        required('Start time is required'),
        customRule('Select a valid start time', {
          validate: (value) => !value || TIME_SLOTS.includes(value),
        }),
        customRule('Room is already booked at this time', {
          validate: (value, values, context) => {
            if (!value || !values?.room || !values?.day) return true;
            const list = Array.isArray(context?.scheduleData) ? context.scheduleData : [];
            const currentId = context?.currentId;
            const roomNorm = norm(values.room);
            return !list.some(
              (ev) =>
                ev?.id !== currentId &&
                ev?.day === values.day &&
                ev?.time === value &&
                norm(ev?.room) === roomNorm,
            );
          },
        }),
      ],
      endTime: [
        required('End time is required'),
        customRule('Select a valid end time', {
          validate: (value) => !value || TIME_SLOTS.includes(value),
        }),
        customRule('End time must be after start time', {
          validate: (value, values) => {
            if (!value || !values?.time) return true;
            const sIdx = TIME_SLOTS.indexOf(values.time);
            const eIdx = TIME_SLOTS.indexOf(value);
            if (sIdx === -1 || eIdx === -1) return false;
            return eIdx > sIdx;
          },
        }),
      ],
      teacher: [
        customRule('Teacher is required', {
          validate: (value, values) => {
            if (value && String(value).trim()) return true;
            return Boolean(values?.teacherEmail);
          },
        }),
      ],
    }),
    [],
  );

  const scheduleValidator = useMemo(
    () => createValidator(scheduleValidationSchema),
    [scheduleValidationSchema],
  );

  const userRole = (userProfile?.role || user?.role || 'teacher').toLowerCase();

  // State needed before computing currentTeacher
  const [facultyList, setFacultyList] = useState([]);
  const [coursesList, setCoursesList] = useState([]);
  const [apiEvents, setApiEvents] = useState([]);
  const baselineRef = useRef([]);
  const [scheduleData, setScheduleData] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [classGroupsList, setClassGroupsList] = useState([]);
  const [studentEnrollments, setStudentEnrollments] = useState([]);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [loadingEnrollment, setLoadingEnrollment] = useState(userRole === 'student');

  const currentTeacher =
    userRole !== 'student'
      ? facultyList.find((f) => (f.email || '').toLowerCase() === (user?.email || '').toLowerCase()) ||
        facultyList[0]
      : null;

  const userEmail = user?.email || currentTeacher?.email || '';
  const fallbackName = user?.full_name || displayNameFrom(currentTeacher || {}) || 'User';
  const headerDisplayName = useProfileDisplayName(fallbackName);
  const resourceToastRef = useRef(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isResourcePanelCollapsed, setIsResourcePanelCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' or 'class-groups'

  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');

  const [filters, setFilters] = useState(() => makeInitialFilters(headerDisplayName, userRole));

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [modalMode, setModalMode] = useState('create');

  const isWeekendToday = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  }, []);

  // Load base data (faculty, courses, rooms, equipment) once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [fac, crs, rms, eqp, grps] = await Promise.all([
          fetchFaculty({ page: 1, pageSize: 200, sort: 'fullName', order: 'asc' }),
          fetchCourses(),
          fetchRooms(),
          fetchEquipment(),
          fetchClassGroups({ activeOnly: true }),
        ]);
        if (!mounted) return;
        console.log('[ScheduleManagement] Loaded faculty:', fac?.length);
        console.log('[ScheduleManagement] Loaded courses:', crs?.length);
        console.log('[ScheduleManagement] Loaded rooms:', rms?.length);
        console.log('[ScheduleManagement] Loaded equipment:', eqp?.length);
        console.log('[ScheduleManagement] Loaded class groups:', grps?.length);
        setFacultyList(fac || []);
        setCoursesList(crs || []);
        setRoomsList(rms || []);
        setEquipmentList(eqp || []);
        setClassGroupsList(grps || []);
        setCoursesList(crs || []);
        setRoomsList(Array.isArray(rms) ? rms : []);
        setClassGroupsList(Array.isArray(grps) ? grps : []);
      } catch (e) {
        if (mounted) {
          guardedNotify(
            'schedule-base-load-failed',
            'error',
            'Failed to load base data. Try refreshing or contact support if the issue persists.',
            { title: 'Failed to load data', duration: 4800 }
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []); // Empty deps - load once on mount

  // Load schedule events with filters
  useEffect(() => {
    // Skip if base data not loaded yet
    if (facultyList.length === 0 && coursesList.length === 0 && roomsList.length === 0 && classGroupsList.length === 0) {
      setLoadingBootstrap(false);
      return;
    }

    let mounted = true;
    setLoadingBootstrap(true);
    if (userRole !== 'student') {
      setLoadingEnrollment(false);
    }
    (async () => {
      try {
        // Build API params from filters
        const apiParams = {};
        if (filters.teacher && filters.teacher !== 'all' && facultyList.length > 0) {
          const teacher = facultyList.find((f) => slug(displayNameFrom(f) || f.fullName || f.name || f.email || '') === filters.teacher);
          if (teacher?.email) apiParams.teacherEmail = teacher.email;
        }
        if (filters.subject && filters.subject !== 'all' && coursesList.length > 0) {
          const course = coursesList.find((c) => {
            const name = c.nameEn || c.nameSk || c.code || '';
            return slug(name) === filters.subject || slug(c.code || '') === filters.subject;
          });
          if (course?.code) apiParams.courseCode = course.code;
        }
        if (filters.room && filters.room !== 'all' && roomsList.length > 0) {
          const room = roomsList.find((r) => slug(r.name || r.id || '') === filters.room);
          if (room?.name) apiParams.room = room.name;
        }
        if (filters.today && !isWeekendToday) {
          const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          apiParams.day = todayName;
        }

        const ev = await fetchScheduleEvents(apiParams);
        if (!mounted) return;
        setApiEvents(ev || []);
  const built = buildFromApiEvents(ev || [], facultyList || [], coursesList || [], classGroupsList || []);
  const lockedApplied = applyLectureLock(built);
  baselineRef.current = lockedApplied;
  setScheduleData(lockedApplied);
        if (userRole === 'student') {
          setLoadingEnrollment(true);
          const email = user?.email || '';
          if (email) {
            const studs = await fetchStudents({ q: email, page: 1, pageSize: 10 });
            const me = (Array.isArray(studs) ? studs : []).find(s => (s.email||'').toLowerCase() === email.toLowerCase()) || (Array.isArray(studs) ? studs[0] : null);
            const sid = me?.id || '';
            if (sid) {
              const enr = await fetchStudentEnrollments(sid);
              if (mounted) setStudentEnrollments(Array.isArray(enr) ? enr : []);
            }
          }
          if (mounted) setLoadingEnrollment(false);
        }
      } catch (e) {
        if (userRole === 'student' && mounted) setLoadingEnrollment(false);
        guardedNotify(
          'schedule-load-failed',
          'error',
          'Schedule data could not be loaded. Try refreshing or contact support if the issue persists.',
          { title: 'Failed to load schedule', duration: 4800 }
        );
      } finally {
        if (mounted) setLoadingBootstrap(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userRole, user?.email, filters.teacher, filters.subject, filters.room, filters.today, isWeekendToday, facultyList, coursesList, roomsList, guardedNotify]);

  // SignalR real-time updates
  const handleDataUpdate = useCallback((payload) => {
    if (!payload?.type) return;
    if (payload.type === 'schedule.updated' || payload.type === 'classgroup.updated') {
      guardedNotify('schedule-realtime', 'info', payload.type === 'classgroup.updated' ? 'Class group updated' : 'Schedule updated', { lockMs: 2000 });
      // Reload schedule data
      (async () => {
        try {
          const ev = await fetchScheduleEvents({ includeHistory: false });
          setApiEvents(ev || []);
          // Fetch faculty and courses inline to avoid stale closure
          const [fac, crs, grps] = await Promise.all([
            fetchFaculty({ page: 1, pageSize: 200 }),
            fetchCourses(),
            fetchClassGroups({ activeOnly: true })
          ]);
          const built = buildFromApiEvents(ev || [], fac || [], crs || [], grps || []);
          const lockedApplied = applyLectureLock(built);
          baselineRef.current = lockedApplied;
          setScheduleData(lockedApplied);
        } catch (err) {
          // Silent fail for real-time updates
        }
      })();
    }
  }, []); // Empty dependencies - all data fetched inline

  useDataUpdates(handleDataUpdate);

  // Dedicated ScheduleHub for real-time schedule updates
  useScheduleHub({
    onScheduleUpdated: useCallback(() => {
      guardedNotify('schedule-hub-update', 'info', 'Schedule updated', { lockMs: 2000 });
      (async () => {
        try {
          const ev = await fetchScheduleEvents({ includeHistory: false });
          setApiEvents(ev || []);
          const [fac, crs, grps] = await Promise.all([
            fetchFaculty({ page: 1, pageSize: 200 }),
            fetchCourses(),
            fetchClassGroups({ activeOnly: true })
          ]);
          const built = buildFromApiEvents(ev || [], fac || [], crs || [], grps || []);
          const lockedApplied = applyLectureLock(built);
          baselineRef.current = lockedApplied;
          setScheduleData(lockedApplied);
        } catch (err) {
          // Silent fail
        }
      })();
    }, []),
    onClassAdded: useCallback((payload) => {
      guardedNotify('class-added', 'success', 'New class added to schedule', { lockMs: 2000 });
      (async () => {
        try {
          const ev = await fetchScheduleEvents({ includeHistory: false });
          setApiEvents(ev || []);
          const [fac, crs, grps] = await Promise.all([
            fetchFaculty({ page: 1, pageSize: 200 }),
            fetchCourses(),
            fetchClassGroups({ activeOnly: true })
          ]);
          const built = buildFromApiEvents(ev || [], fac || [], crs || [], grps || []);
          const lockedApplied = applyLectureLock(built);
          baselineRef.current = lockedApplied;
          setScheduleData(lockedApplied);
        } catch (err) {
          // Silent fail
        }
      })();
    }, []),
    onClassRemoved: useCallback((payload) => {
      guardedNotify('class-removed', 'info', 'Class removed from schedule', { lockMs: 2000 });
      (async () => {
        try {
          const ev = await fetchScheduleEvents({ includeHistory: false });
          setApiEvents(ev || []);
          const [fac, crs, grps] = await Promise.all([
            fetchFaculty({ page: 1, pageSize: 200 }),
            fetchCourses(),
            fetchClassGroups({ activeOnly: true })
          ]);
          const built = buildFromApiEvents(ev || [], fac || [], crs || [], grps || []);
          const lockedApplied = applyLectureLock(built);
          baselineRef.current = lockedApplied;
          setScheduleData(lockedApplied);
        } catch (err) {
          // Silent fail
        }
      })();
    }, []),
    onClassRescheduled: useCallback((payload) => {
      guardedNotify('class-rescheduled', 'info', 'Class rescheduled', { lockMs: 2000 });
      (async () => {
        try {
          const ev = await fetchScheduleEvents({ includeHistory: false });
          setApiEvents(ev || []);
          const [fac, crs, grps] = await Promise.all([
            fetchFaculty({ page: 1, pageSize: 200 }),
            fetchCourses(),
            fetchClassGroups({ activeOnly: true })
          ]);
          const built = buildFromApiEvents(ev || [], fac || [], crs || [], grps || []);
          const lockedApplied = applyLectureLock(built);
          baselineRef.current = lockedApplied;
          setScheduleData(lockedApplied);
        } catch (err) {
          // Silent fail
        }
      })();
    }, [])
  });

  // removed localStorage sync


  const applyFilters = (list) => {
    return list.filter((s) => {
      if (filters.year !== 'all') {
        const y = s.grade?.match(/Year\s+(\d+)/i)?.[1] || '';
        if (String(y) !== String(filters.year)) return false;
      }
      if (filters.teacher && filters.teacher !== 'all') {
        const teacherSlug = slug(s.teacher || '');
        const filterSlug = slug(filters.teacher || '');
        if (teacherSlug !== filterSlug) return false;
      }
      if (filters.subject !== 'all' && slug(s.subject) !== filters.subject) return false;
      if (filters.room !== 'all' && slug(s.room) !== filters.room) return false;
      if (filters.classGroup !== 'all') {
        const keys = s.classGroupKeys || [];
        if (!keys.includes(filters.classGroup)) return false;
      }
      if (filters.faculty !== 'all' && slug(s.faculty) !== filters.faculty) return false;
      if (filters.program !== 'all' && slug(s.program) !== filters.program) return false;
      if (filters.search) {
        const q = norm(filters.search);
        const blob = `${s.subject} ${s.teacher} ${s.grade} ${s.room} ${s.classGroupText || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (filters.conflicts && !s.hasConflict) return false;
      if (filters.today) {
        if (isWeekendToday) return false;
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        if (norm(s.day) !== norm(todayName)) return false;
      }
      return true;
    });
  };

  const allTeachers = useMemo(() => {
    // Prefer faculty list from API so options are complete and stable
    const arr = (facultyList || []).map((f) => ({ value: f.email, label: displayNameFrom(f) || f.email }));
    return arr;
  }, [facultyList]);

  const subjectOptionsFromCourses = useMemo(() => {
    const byCode = new Map();
    (coursesList || []).forEach((c) => {
      if (!c?.code) return;
      if (byCode.has(c.code)) return;
      const label = c.nameEn || c.nameSk || c.code;
      byCode.set(c.code, { value: c.code, label, _meta: c });
    });
    return Array.from(byCode.values());
  }, [coursesList]);

  const courseMeta = useMemo(() => {
    return (coursesList || [])
      .filter((c) => c && c.code)
      .map((c) => {
        const keys = [c.code, c.nameEn, c.nameSk]
          .map(normalizeSubjectKey)
          .filter(Boolean);
        return { code: c.code, keys };
      });
  }, [coursesList]);

  const teacherCourseMap = useMemo(() => {
    const map = new Map();
    (facultyList || []).forEach((f) => {
      const email = String(f.email || '').toLowerCase();
      if (!email) return;
      const rawSubjects = Array.isArray(f.subjects) ? f.subjects : [];
      if (!rawSubjects.length) return;
      const normalized = rawSubjects.map(normalizeSubjectKey).filter(Boolean);
      if (!normalized.length) return;
      const codes = new Set();
      courseMeta.forEach((course) => {
        const matches = normalized.some((sub) =>
          course.keys.some((key) => key && (sub === key || sub.startsWith(key) || key.startsWith(sub) || sub.includes(key)))
        );
        if (matches) codes.add(course.code);
      });
      if (codes.size) map.set(email, codes);
    });
    return map;
  }, [facultyList, courseMeta]);

  const roomOptionsFromApi = useMemo(() => {
    const set = new Set();
    const arr = [];
    (roomsList || []).forEach((r) => {
      const name = r?.name || '';
      if (!name) return;
      const key = name.toLowerCase();
      if (set.has(key)) return;
      set.add(key);
      arr.push({ value: name, label: name });
    });
    return arr;
  }, [roomsList]);

  // Extract unique years from courses (periodSk) - e.g., "1. rok" -> "Year 1"
  const allYears = useMemo(() => {
    const yearSet = new Set();
    (coursesList || []).forEach((c) => {
      if (c?.periodSk) {
        const match = String(c.periodSk).match(/(\d+)\.\s*rok/i);
        if (match) {
          yearSet.add(parseInt(match[1], 10));
        }
      }
    });
    // Also include years from existing schedule data as fallback
    scheduleData.forEach((s) => {
      const match = (s.grade || '').match(/Year\s+(\d+)/i);
      if (match) {
        yearSet.add(parseInt(match[1], 10));
      }
    });
    const yrs = Array.from(yearSet).sort((a, b) => a - b);
    return yrs.length > 0 
      ? yrs.map((y) => ({ value: `Year ${y}`, label: `Year ${y}` }))
      : [{ value: 'Year 1', label: 'Year 1' }, { value: 'Year 2', label: 'Year 2' }]; // Fallback
  }, [coursesList, scheduleData]);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const action = qp.get('action');
    const view = qp.get('view');
    if (action === 'add' && userRole !== 'student') {
      setModalMode('create');
      setSelectedSchedule(null);
      setIsScheduleModalOpen(true);
    }
    if (view === 'day' || view === 'week') setViewMode(view);
    const readBool = (k) => qp.get(k) === '1' || qp.get(k) === 'true';
    const maybe = (k, def = 'all') => (qp.get(k) != null ? qp.get(k) : def);

    const nextFilters = {
      ...makeInitialFilters(headerDisplayName, userRole),
      teacher: userRole === 'student' ? String(maybe('teacher', 'all')) : String(maybe('teacher', slug(headerDisplayName) || 'all')),
      subject: String(maybe('subject', 'all')),
      room: String(maybe('room', 'all')),
      classGroup: String(maybe('class', 'all')),
      faculty: String(maybe('faculty', 'all')),
      program: String(maybe('program', 'all')),
      search: String(qp.get('search') || ''),
      conflicts: readBool('conflicts'),
      today: readBool('today'),
      available: readBool('available') && userRole !== 'student',
    };
    setFilters(nextFilters);

  }, [userRole, headerDisplayName]);

  const prevHeaderSlugRef = useRef(slug(headerDisplayName || ''));
  useEffect(() => {
    if (userRole === 'student') return;
    const nextSlug = slug(headerDisplayName || '');
    const prevSlug = prevHeaderSlugRef.current;
    if (nextSlug !== prevSlug && nextSlug) {
      // Update filter if it was set to previous slug or if it's empty/all
      if (filters.teacher === prevSlug || !filters.teacher || filters.teacher === 'all') {
        setFilters((prev) => ({ ...prev, teacher: nextSlug }));
      }
      prevHeaderSlugRef.current = nextSlug;
    }
  }, [headerDisplayName, filters, userRole]);

  useEffect(() => {
    const qp = new URLSearchParams();
    qp.set('role', userRole);
    if (filters.teacher) qp.set('teacher', filters.teacher);
    if (filters.subject) qp.set('subject', filters.subject);
    if (filters.room) qp.set('room', filters.room);
    if (filters.classGroup && userRole !== 'student') qp.set('class', filters.classGroup);
    if (filters.search) qp.set('search', filters.search);
    if (filters.conflicts) qp.set('conflicts', '1');
    if (filters.today) qp.set('today', '1');
    if (filters.available && userRole !== 'student') qp.set('available', '1');
    if (viewMode) qp.set('view', viewMode);
    const newSearch = qp.toString();
    const curSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== curSearch) {
      navigate({ pathname: '/class-schedule-management', search: newSearch }, { replace: true });
    }
  }, [filters, viewMode, navigate, userRole]);

  const handleFilterChange = (key, value) => {
    if (userRole === 'student' && key === 'available') return;
    // Prevent clearing teacher filter for teachers - always keep a teacher selected
    if (key === 'teacher' && userRole !== 'student' && (!value || value === 'all')) {
      // Reset to current user instead of clearing
      const currentSlug = slug(headerDisplayName || '');
      if (currentSlug) {
        setFilters({ ...filters, [key]: currentSlug });
        if (key === 'today') {
          setViewMode(value ? 'day' : 'week');
        }
        return;
      }
    }
    setFilters({ ...filters, [key]: value });
    if (key === 'today') {
      setViewMode(value ? 'day' : 'week');
      if (value && isWeekendToday) {
        guardedNotify('schedule-weekend-today', 'info', 'Weekend: no classes scheduled today.', { title: 'No Schedule Today', icon: 'Calendar', lockMs: 4000 });
      }
    }
  };

  const handleClearFilters = () => {
    // Always reset teacher to current user for teachers, keep 'all' for students
    const clearedFilters = makeInitialFilters(headerDisplayName, userRole);
    setFilters(clearedFilters);
    setViewMode('week');
  };

  const canManageAll = userRole !== 'student';

  const handleScheduleClick = (schedule) => {
    setSelectedSchedule(schedule);
    setModalMode('view');
    setIsScheduleModalOpen(true);
  };

  const moveKeepingDuration = (item, newDay, newStart) => {
    const s0 = TIME_SLOTS.indexOf(item.time);
    const e0 = TIME_SLOTS.indexOf(item.endTime || item.time);
    const dur = Math.max(1, e0 - s0);
    const s1 = TIME_SLOTS.indexOf(newStart);
    const e1 = s1 + dur;
    if (s1 < 0 || e1 >= TIME_SLOTS.length) return null;
    return { ...item, day: newDay, time: TIME_SLOTS[s1], endTime: TIME_SLOTS[e1] };
  };

  const emitScheduleChange = useCallback(
      (mode, payload) => {
        if (typeof notifyScheduleChange === 'function') {
          notifyScheduleChange({ mode, event: payload, actor: { email: userEmail, name: headerDisplayName } });
        }
      },
      [notifyScheduleChange, userEmail, headerDisplayName]
  );

  const teacherSlugForSpecial = useMemo(() => {
    return filters.teacher && filters.teacher !== 'all' ? filters.teacher : slug(headerDisplayName);
  }, [filters.teacher, headerDisplayName]);

  const scheduleForViewRaw = useMemo(() => {
    return (scheduleData || []).map((e) => {
      const email = String(e.teacherEmail || '').toLowerCase();
      let teacherLabel = e.teacher;
      if (email) {
        const faculty = facultyList.find((f) => (f.email || '').toLowerCase() === email);
        if (faculty) {
          teacherLabel = displayNameFrom(faculty) || faculty.fullName || faculty.name || e.teacher;
        } else if (email === String(userEmail).toLowerCase()) {
          teacherLabel = headerDisplayName;
        }
      }
      // Ensure teacher name is stripped of titles for consistent slug matching
      teacherLabel = stripTitles(teacherLabel) || teacherLabel;
      return { ...e, teacher: teacherLabel };
    });
  }, [scheduleData, headerDisplayName, userEmail, facultyList]);

  const filteredScheduleData = useMemo(() => applyFilters(scheduleForViewRaw), [scheduleForViewRaw, filters]);

  const displayedScheduleData = useMemo(() => {
    if (userRole === 'student') {
      const enrolledCourses = new Set((studentEnrollments || []).map(e => String(e.courseCode || '')));
      const selectedEventIds = new Set((studentEnrollments || []).map(e => String(e.scheduleEventId || '')).filter(Boolean));
      if (enrolledCourses.size === 0 && selectedEventIds.size === 0) return [];
      return (scheduleForViewRaw || []).filter(ev => {
        const byId = ev?.id && selectedEventIds.has(String(ev.id));
        const byCourseLecture = ev?.courseCode && enrolledCourses.has(String(ev.courseCode)) && (String(ev.kind||'').toUpperCase()==='P' || String(ev.kind||'').toUpperCase()==='S');
        return byId || byCourseLecture;
      });
    }
    if (filters.available && filters.conflicts) {
      return scheduleForViewRaw.filter((ev) => slug(ev.teacher) === teacherSlugForSpecial);
    }
    return filteredScheduleData;
  }, [userRole, studentEnrollments, filters.available, filters.conflicts, filteredScheduleData, scheduleForViewRaw, teacherSlugForSpecial]);

  const teacherDisplayName = filters.teacher !== 'all' ? unslug(filters.teacher).replace(/\b\w/g, (c) => c.toUpperCase()) : 'All Teachers';

  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      setIsSidebarCollapsed(w < 1024);
      setIsResourcePanelCollapsed((prev) => (w < 1366 ? true : prev));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useEffect(() => {
    if (isResourcePanelCollapsed) {
      if (!resourceToastRef.current) {
        guardedNotify('schedule-resource-panel-info', 'info', 'Use the resources button on the right to open the resource panel.', {
          title: 'Resource panel hidden',
          lockMs: 4000,
        });
        resourceToastRef.current = true;
      }
    } else {
      resourceToastRef.current = false;
    }
  }, [isResourcePanelCollapsed, guardedNotify]);

  const ownerName = useMemo(() => {
    return filters.available && filters.conflicts ? unslug(teacherSlugForSpecial) : teacherDisplayName;
  }, [filters.available, filters.conflicts, teacherSlugForSpecial, teacherDisplayName]);

  // Convert classGroupsList from API to options format
  const classGroupOptions = useMemo(() => {
    const groups = (classGroupsList || []).map((g) => ({
      value: g.groupKey || g.id || g.name,
      label: g.name || g.groupKey || g.id
    }));
    return [{ value: 'all', label: 'All classes' }, ...groups];
  }, [classGroupsList]);

  // For dict-based lookups (ResourcePanel, ScheduleCalendar)
  const classGroupDict = useMemo(() => {
    return (classGroupsList || []).map((g) => ({
      value: g.groupKey || g.id || g.name,
      label: g.name || g.groupKey || g.id
    }));
  }, [classGroupsList]);

  const computeServerEventId = (day, start, end, courseCode, room) => {
    const s = String(start || '').trim();
    const e = String(end || '').trim();
    const slot = s && e ? `${s}-${e}` : s ? `${s}-${s}` : '';
    return `evt:${day}:${slot}:${courseCode || ''}:${room || ''}`;
  };

  const handleTimeSlotClick = (day, time, draggedItem = null) => {
    if (userRole === 'student') {
      guardedNotify('schedule-readonly', 'warning', 'Read-only: students cannot modify the schedule.');
      return false;
    }
    // Handle drag-move if provided
    if (draggedItem) {
      if (draggedItem.locked || (draggedItem.enrollmentsCount || 0) > 0) {
        guardedNotify('schedule-move-enrolled', 'warning', 'Move blocked: students are already enrolled for this class.');
        return false;
      }
      // Compute new times keeping duration
      const moved = moveKeepingDuration(draggedItem, day, time);
      if (!moved) { guardedNotify('schedule-move-invalid-time', 'error', 'Invalid target time', { title: 'Invalid time', lockMs: 3000 }); return false; }
      // Optimistic: verify slot occupancy in current view
    const slotTakenInFull = scheduleData.some(
      (ev) => ev.day === moved.day && ev.time === moved.time && norm(ev.room) === norm(draggedItem.room) && ev.id !== moved.id
    );
      if (slotTakenInFull) { guardedNotify('schedule-move-slot-occupied', 'error', 'Target slot is occupied', { title: 'Slot occupied', lockMs: 3000 }); return false; }
      const looksServerId = typeof draggedItem.id === 'string' && draggedItem.id.startsWith('evt:');
      // Fire async update to backend; keep UI unchanged until confirmed
      (async () => {
        try {
          if (looksServerId) {
            const res = await updateScheduleEvent(draggedItem.id, {
              day: moved.day,
              time: moved.time,
              endTime: moved.endTime,
              room: draggedItem.room,
              capacity: draggedItem.capacity,
              note: draggedItem.notes,
              program: draggedItem.program || undefined,
              faculty: draggedItem.faculty || undefined,
            });
            const newId = res?.id || draggedItem.id;
            const updated = { ...draggedItem, id: newId, day: moved.day, time: moved.time, endTime: moved.endTime };
            const next = withConflicts(scheduleData.map((i) => (i.id === draggedItem.id ? updated : i)));
            setScheduleData(applyLectureLock(next));
            emitScheduleChange('move', updated);
            guardedNotify('schedule-move-success', 'success', 'Class moved', { title: 'Class moved', lockMs: 3000 });
            clearToastGuard('schedule-move-enrolled');
          } else {
            // If item is not backed by server (legacy/local), create at target slot
            const payload = {
              courseCode: draggedItem.courseCode || draggedItem.code || '',
              day: moved.day,
              time: moved.time,
              endTime: moved.endTime,
              room: draggedItem.room,
              note: draggedItem.notes,
              capacity: draggedItem.capacity,
              classGroupKeys: Array.isArray(draggedItem.classGroupKeys) ? draggedItem.classGroupKeys : undefined,
              type: draggedItem.kind,
              program: draggedItem.program || undefined,
              faculty: draggedItem.faculty || undefined,
            };
            if (!payload.courseCode) throw new Error('Missing course code for event');
            const res = await createScheduleEvent(payload, { teacherEmail: userEmail });
            const newId = res?.id;
            if (!newId) throw new Error('Failed to create event');
            const updated = { ...draggedItem, id: newId, day: moved.day, time: moved.time, endTime: moved.endTime };
            const next = withConflicts(scheduleData.map((i) => (i.id === draggedItem.id ? updated : i)));
            setScheduleData(applyLectureLock(next));
            emitScheduleChange('create', updated);
            guardedNotify('schedule-move-create-success', 'success', 'Class created at new slot', { title: 'Class created', lockMs: 3000 });
            clearToastGuard('schedule-move-enrolled');
          }
        } catch (e) {
          const status = e?.status;
          const rawMessage = typeof e?.message === 'string' ? e.message : (typeof e?.body === 'string' ? e.body : '');
          const friendly = extractApiErrorMessage(e, 'Failed to move class');
          // If target is occupied, try to clean up a stale duplicate owned by current user, then retry once
          if (status === 409 || /Target slot already occupied/i.test(rawMessage)) {
            try {
              const targetId = computeServerEventId(moved.day, moved.time, moved.endTime, draggedItem.courseCode || draggedItem.code, draggedItem.room);
              await deleteScheduleEvent(targetId);
              // retry update once
              const resRetry = await updateScheduleEvent(draggedItem.id, {
                day: moved.day,
                time: moved.time,
                endTime: moved.endTime,
                room: draggedItem.room,
                capacity: draggedItem.capacity,
                note: draggedItem.notes,
                program: draggedItem.program || undefined,
                faculty: draggedItem.faculty || undefined,
              });
              const newIdR = resRetry?.id || draggedItem.id;
              const updatedR = { ...draggedItem, id: newIdR, day: moved.day, time: moved.time, endTime: moved.endTime };
              const nextR = withConflicts(scheduleData.map((i) => (i.id === draggedItem.id ? updatedR : i)));
              setScheduleData(applyLectureLock(nextR));
              emitScheduleChange('move', updatedR);
              guardedNotify('schedule-move-success', 'success', 'Class moved', { title: 'Class moved', lockMs: 3000 });
              clearToastGuard('schedule-move-enrolled');
              return;
            } catch (e3) {
              // fall through to generic handling
            }
          }
          if (status === 404) {
            // Fallback: create new event at target slot, then replace locally
            try {
              const payload = {
                courseCode: draggedItem.courseCode || draggedItem.code || '',
                day: moved.day,
                time: moved.time,
                endTime: moved.endTime,
                room: draggedItem.room,
                note: draggedItem.notes,
                capacity: draggedItem.capacity,
                classGroupKeys: Array.isArray(draggedItem.classGroupKeys) ? draggedItem.classGroupKeys : undefined,
                type: draggedItem.kind,
                program: draggedItem.program || undefined,
                faculty: draggedItem.faculty || undefined,
              };
              if (!payload.courseCode) throw new Error('Missing course code for event');
              const res2 = await createScheduleEvent(payload, { teacherEmail: userEmail });
              const newId2 = res2?.id;
              if (!newId2) throw new Error('Failed to create event');
              // Attempt to clean up original (to prevent duplicates after reload)
              // Fire-and-forget to avoid await parsing issues in some environments
              deleteScheduleEvent(draggedItem.id).catch(() => {});
              const updated2 = { ...draggedItem, id: newId2, day: moved.day, time: moved.time, endTime: moved.endTime };
              const next2 = withConflicts(scheduleData.map((i) => (i.id === draggedItem.id ? updated2 : i)));
              setScheduleData(applyLectureLock(next2));
              emitScheduleChange('create', updated2);
            guardedNotify('schedule-move-create-success', 'success', 'Class created at new slot', { title: 'Class created', lockMs: 3000 });
            clearToastGuard('schedule-move-enrolled');
              return;
            } catch (e2) {
              const m2 = e2?.message || '';
              if (/occupied/i.test(m2)) guardedNotify('schedule-move-create-occupied', 'error', 'Target slot already occupied.', { title: 'Slot occupied', lockMs: 3000 });
              else guardedNotify('schedule-move-create-failed', 'error', 'Failed to move/create class', { title: 'Operation failed', lockMs: 3000 });
              return;
            }
          }
          if (/enrolled/i.test(rawMessage)) guardedNotify('schedule-move-enrolled', 'warning', 'Move blocked: students are already enrolled for this class.');
          else if (/occupied/i.test(rawMessage)) guardedNotify('schedule-move-occupied', 'error', 'Target slot already occupied.', { title: 'Slot occupied', lockMs: 3000 });
          else guardedNotify('schedule-move-failed', 'error', 'Failed to move class', { title: 'Move failed', lockMs: 3000 });
        }
      })();
      return true;
    }
    // Keep a light occupancy hint but don't alter persisted data without API
    if (filters.conflicts) {
      const anyAtSlotInFull = scheduleData.some((ev) => ev.day === day && ev.time === time);
      if (anyAtSlotInFull) {
        guardedNotify('schedule-conflicts-filter-active', 'error', 'Conflicts filter is active. You cannot add a class to an occupied slot.', { title: 'Conflicts filter', lockMs: 3000 });
        return false;
      }
    }
    setSelectedSchedule({ day, time, teacher: headerDisplayName, teacherEmail: userEmail });
    setModalMode('create');
    setIsScheduleModalOpen(true);
    return true;
  };

  const handleScheduleSave = async (scheduleItem) => {
    if (userRole === 'student') {
      guardedNotify('schedule-readonly', 'warning', 'Read-only: students cannot modify the schedule.');
      return;
    }

    const normalized = { ...scheduleItem };
    if (!normalized.teacherEmail && normalized.teacher) {
  const findByLabel = facultyList.find((f) => slug(displayNameFrom(f)) === slug(normalized.teacher));
  const findByName = facultyList.find((f) => slug(f.name || '') === slug(normalized.teacher));
      normalized.teacherEmail =
          findByLabel?.email ||
          findByName?.email ||
          (norm(normalized.teacher) === norm(headerDisplayName) ? userEmail : normalized.teacherEmail);
    }
    const groupKeys = Array.isArray(normalized.classGroupKeys)
        ? sortGroupKeys(normalized.classGroupKeys.filter(Boolean))
        : [];
    normalized.classGroupKeys = groupKeys;
    normalized.classGroupLabels = groupKeys.map(k => labelForKey(k, classGroupsList));
    normalized.classGroupText = groupKeys.length ? textForGroupKeys(groupKeys, classGroupsList) : '';
    if (normalized.notes) {
      // Remove ALL occurrences of "Groups:..." patterns (handles duplicates)
      const stripped = normalized.notes
          .replace(/\s*•?\s*Groups:\s*[^•]*/gi, '')
          .replace(/\s*•\s*$/g, '')
          .trim();
      normalized.notes = groupKeys.length
          ? stripped
              ? `${stripped} • Groups: ${normalized.classGroupText}`
              : `Groups: ${normalized.classGroupText}`
          : stripped;
    } else {
      normalized.notes = groupKeys.length ? `Groups: ${normalized.classGroupText}` : '';
    }

    if (filters.conflicts) {
      const slotTakenInFull = scheduleData.some(
          (ev) => ev.day === normalized.day && ev.time === normalized.time && ev.id !== normalized.id
      );
      if (slotTakenInFull) {
        guardedNotify('schedule-conflicts-filter-active', 'error', 'Conflicts filter is active. You cannot add a class to an occupied slot.', { title: 'Conflicts filter', lockMs: 3000 });
        return;
      }
    }

    const validationErrors = scheduleValidator.validateMany(null, normalized, {
      scheduleData,
      currentId: normalized.id,
    });
    console.log('[handleScheduleSave] Normalized:', normalized);
    console.log('[handleScheduleSave] Validation errors:', validationErrors);
    if (Object.keys(validationErrors).length) {
      const firstError = Object.values(validationErrors)[0];
      if (firstError) {
        guardedNotify('schedule-validation-error', 'error', firstError, { title: 'Validation error', lockMs: 3000 });
      }
      return;
    }

    if (modalMode === 'create') {
      try {
        const payload = {
          courseCode: normalized.courseCode || normalized.code || normalized.subjectCode || normalized.subject || '',
          day: normalized.day,
          time: normalized.time,
          endTime: normalized.endTime,
          room: normalized.room,
          note: normalized.notes,
          capacity: normalized.capacity,
          classGroupKeys: normalized.classGroupKeys,
          type: normalized.kind,
          program: normalized.program || undefined,
          faculty: normalized.faculty || undefined,
        };
  const res = await createScheduleEvent(payload, { teacherEmail: userEmail });
        const id = res?.id || `evt-${Date.now().toString(36)}`;
        const item = { id, ...normalized };
  const next = withConflicts([...scheduleData, item]);
  setScheduleData(applyLectureLock(next));
        emitScheduleChange('create', item);
        setIsScheduleModalOpen(false);
        // Show toast after state update and modal close completes
        setTimeout(() => {
          guardedNotify('schedule-create-success', 'success', 'Class created', { title: 'Class created', lockMs: 3000 });
          clearToastGuard('schedule-move-enrolled');
        }, 300);
      } catch (e) {
        setTimeout(() => {
          guardedNotify('schedule-create-error', 'error', extractApiErrorMessage(e, 'Failed to create class'), { title: 'Create failed', lockMs: 3000 });
        }, 100);
        return;
      }
    } else if (modalMode === 'edit') {
        // Persist edits (day/time/room/capacity/note) to backend
        try {
          const res = await updateScheduleEvent(normalized.id, {
            day: normalized.day,
            time: normalized.time,
            endTime: normalized.endTime,
            room: normalized.room,
            capacity: normalized.capacity,
            note: normalized.notes,
            program: normalized.program || undefined,
            faculty: normalized.faculty || undefined,
          });
          const newId = res?.id || normalized.id;
          const updated = { ...normalized, id: newId };
          const next = withConflicts(scheduleData.map((i) => (i.id === normalized.id ? updated : i)));
          setScheduleData(applyLectureLock(next));
          emitScheduleChange('update', updated);
          setIsScheduleModalOpen(false);
          // Show toast after state update and modal close completes
          setTimeout(() => {
            guardedNotify('schedule-update-success', 'success', 'Class updated', { title: 'Class updated', lockMs: 3000 });
            clearToastGuard('schedule-edit-enrolled');
          }, 100);
        } catch (e) {
          const rawMessage = typeof e?.message === 'string' ? e.message : (typeof e?.body === 'string' ? e.body : '');
          const friendly = extractApiErrorMessage(e, 'Failed to update class');
          const status = e?.status;
          if (status === 409 || /Target slot already occupied/i.test(rawMessage)) {
            // Attempt cleanup of stale duplicate and retry once
            try {
              const targetId = computeServerEventId(normalized.day, normalized.time, normalized.endTime, normalized.courseCode || normalized.code || normalized.subjectCode || normalized.subject, normalized.room);
              await deleteScheduleEvent(targetId);
              const resRetry = await updateScheduleEvent(normalized.id, {
                day: normalized.day,
                time: normalized.time,
                endTime: normalized.endTime,
                room: normalized.room,
                capacity: normalized.capacity,
                note: normalized.notes,
              });
              const newIdR = resRetry?.id || normalized.id;
              const updatedR = { ...normalized, id: newIdR };
              const nextR = withConflicts(scheduleData.map((i) => (i.id === normalized.id ? updatedR : i)));
              setScheduleData(applyLectureLock(nextR));
              emitScheduleChange('update', updatedR);
              setIsScheduleModalOpen(false);
              // Show toast after state update and modal close completes
              setTimeout(() => {
                guardedNotify('schedule-update-success', 'success', 'Class updated', { title: 'Class updated', lockMs: 3000 });
                clearToastGuard('schedule-edit-enrolled');
              }, 100);
              return;
            } catch {
              // fall through
            }
          }
          if (/enrolled/i.test(rawMessage)) guardedNotify('schedule-edit-enrolled', 'warning', 'Edit blocked: students are already enrolled for this class.');
          else guardedNotify('schedule-update-error', 'error', friendly, { title: 'Update failed', lockMs: 3000 });
          return;
        }
    }
  };

  const handleScheduleDelete = async (scheduleItem) => {
    if (!scheduleItem?.id) return;
    if (userRole === 'student') {
      guardedNotify('schedule-readonly', 'warning', 'Read-only: students cannot modify the schedule.');
      return;
    }
    // Guard by enrollments on client too
    if ((scheduleItem.enrollmentsCount || 0) > 0 || scheduleItem.locked) {
      guardedNotify('schedule-delete-enrolled-warning', 'warning', 'Cannot delete: students are enrolled for this class.', { title: 'Cannot delete', lockMs: 3000 });
      return;
    }
    try {
      await deleteScheduleEvent(scheduleItem.id);
      const next = withConflicts((scheduleData || []).filter((e) => e.id !== scheduleItem.id));
      setScheduleData(applyLectureLock(next));
      setIsScheduleModalOpen(false);
      emitScheduleChange('delete', scheduleItem);
      // Show toast after state update completes
      setTimeout(() => {
        guardedNotify('schedule-delete-success', 'success', 'Class deleted', { title: 'Class deleted', lockMs: 3000 });
        clearToastGuard('schedule-delete-enrolled');
      }, 300);
    } catch (e) {
      const rawMessage = typeof e?.message === 'string' ? e.message : (typeof e?.body === 'string' ? e.body : '');
      const friendly = extractApiErrorMessage(e, 'Failed to delete class');
      const status = e?.status;
      setTimeout(() => {
        if (status === 409 || /enrolled/i.test(rawMessage)) guardedNotify('schedule-delete-enrolled', 'warning', 'Cannot delete this class while students are enrolled.');
        else if (status === 403) guardedNotify('schedule-delete-owner-only', 'error', 'Only the owner can delete this class.', { title: 'Permission denied', lockMs: 3000 });
        else if (status === 404) {
          // Already gone; clean up locally
          const next = withConflicts((scheduleData || []).filter((ev) => ev.id !== scheduleItem.id));
          setScheduleData(applyLectureLock(next));
          setIsScheduleModalOpen(false);
          guardedNotify('schedule-delete-missing', 'info', 'Class was already removed.', { lockMs: 3200 });
        } else guardedNotify('schedule-delete-error', 'error', friendly, { title: 'Delete failed', lockMs: 3000 });
      }, 100);
    }
  };

  const handleResourceSelect = (type, resource) => {
    if (type === 'teacher') {
      let name = resource?.name || '';
      if (!name && resource?.email) {
  const f = facultyList.find((x) => (x.email || '').toLowerCase() === (resource.email || '').toLowerCase());
        name = displayNameFrom(f || {}) || '';
      }
      if (name) setFilters({ ...filters, teacher: slug(name) });
    }
    if (type === 'room') setFilters({ ...filters, room: slug(resource?.name || '') });
    if (type === 'subject') setFilters({ ...filters, subject: slug(resource?.name || '') });
    if (type === 'classGroup') setFilters({ ...filters, classGroup: resource?.key || 'all' });
  };

  const handleQuickAction = (actionId) => {
    if (userRole === 'student') return;
    switch (actionId) {
      case 'add-class':
        setModalMode('create');
        setSelectedSchedule(null);
        setIsScheduleModalOpen(true);
        break;
      case 'view-conflicts':
        setFilters({ ...filters, conflicts: true });
        break;
      default:
        break;
    }
  };

  const confirmedScheduleIds = useMemo(() => {
    if (!Array.isArray(scheduleData)) return new Set();
    return new Set(scheduleData.map(e => String(e.id || '')));
  }, [scheduleData]);

  const confirmedScheduleEntries = useMemo(() => {
    if (!Array.isArray(scheduleData)) return [];
    return scheduleData.filter((entry) => confirmedScheduleIds.has(String(entry.id || '')) || (entry.enrollmentsCount || 0) > 0 || entry.locked);
  }, [scheduleData, confirmedScheduleIds]);

  const resourceTeachers = useMemo(() => {
    // Show ALL faculty, not just those in schedule
    return facultyList.map((faculty) => {
      const full = stripTitles(displayNameFrom(faculty) || faculty.fullName || faculty.name || faculty.email || '');
      return {
        ...faculty,
        displayName: full,
        name: full,
        fullName: full,
      };
    });
  }, [facultyList]);

  const resourceRooms = useMemo(() => {
    // Show ALL rooms, not just those in schedule
    return roomsList;
  }, [roomsList]);

  const resourceEquipment = useMemo(() => {
    // Show ALL equipment, not just those required by scheduled courses
    if (!Array.isArray(equipmentList)) return [];
    return equipmentList;
  }, [equipmentList]);

  // Calculate stats for student view
  const studentStats = useMemo(() => {
    if (userRole !== 'student') return null;
    const list = (displayedScheduleData || []).map((e) => ({ ...e }));
    const d = new Date(selectedWeek);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    const weekStartLocal = d;
    const dayToIdx = (dayName) => WEEK_DAYS.indexOf(dayName);
    const dateAt = (dayName, time) => {
      const base = new Date(weekStartLocal);
      const idx = dayToIdx(dayName);
      if (idx >= 0) base.setDate(base.getDate() + idx);
      const [hh, mm] = String(time || '00:00').split(':').map((n) => parseInt(n, 10));
      base.setHours(hh || 0, mm || 0, 0, 0);
      return base;
    };
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekendToday = (() => { const d = new Date().getDay(); return d === 0 || d === 6; })();
    const unique = (arr = []) => Array.from(new Set(arr));
    const listWithDates = list
      .map((e) => ({ ...e, startDt: dateAt(e.day, e.time), endDt: dateAt(e.day, e.endTime || e.time) }))
      .sort((a, b) => a.startDt - b.startDt);
    const classesThisWeek = list.length;
    const classesToday = listWithDates.filter((e) => e.startDt.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === todayName.toLowerCase()).length;
    const coursesThisWeek = unique(list.map((e) => e.courseCode || e.subject || '').filter(Boolean)).length;
    const now = new Date();
    const nextToday = listWithDates.filter((e) => e.startDt.toDateString() === now.toDateString() && e.endDt > now)[0];
    const minsUntil = nextToday ? Math.max(0, Math.round((nextToday.startDt - now) / 60000)) : null;
    const nextClass = nextToday
      ? { label: `${nextToday.subject} — ${nextToday.time}${nextToday.endTime ? '-' + nextToday.endTime : ''}`, inMins: minsUntil, room: nextToday.room || '' }
      : null;
    const totalSlotsWeek = WEEK_DAYS.length * TIME_SLOTS.length;
    const totalSlotsToday = TIME_SLOTS.length;
    const freeSlotsWeek = Math.max(0, totalSlotsWeek - classesThisWeek);
    const freeSlotsToday = Math.max(0, totalSlotsToday - classesToday);
    const occupiedToday = new Set(listWithDates.filter(e => e.startDt.toDateString() === now.toDateString()).map(e => e.time));
    let firstFreeSlotLabel = '';
    for (const t of TIME_SLOTS) { if (!occupiedToday.has(t)) { firstFreeSlotLabel = t; break; } }
    return { classesThisWeek, classesToday, nextClass, coursesThisWeek, totalSlotsWeek, totalSlotsToday, freeSlotsWeek, freeSlotsToday, firstFreeSlotLabel, isWeekendToday, dayName: todayName };
  }, [displayedScheduleData, selectedWeek, userRole]);

  // Calculate stats for teacher view
  const teacherStats = useMemo(() => {
    if (userRole === 'student') return null;
    const teacherIndex = new Map();
    (facultyList || []).forEach((f) => {
      const key = (f.fullName || f.displayName || f.name || f.email || '')
          .toString().trim().toLowerCase().replace(/\s+/g, '-');
      if (key) teacherIndex.set(key, f);
    });
    const unique = (arr = []) => Array.from(new Set(arr));
    const countActiveTeachers = (allEvents) => {
      const byTeacher = new Map();
      (allEvents || []).forEach((ev) => {
        const k = (ev.teacher || ev.teacherEmail || '')
            .toString().trim().toLowerCase().replace(/\s+/g, '-');
        if (k) byTeacher.set(k, true);
      });
      return byTeacher.size;
    };
    const byDay = WEEK_DAYS.reduce((acc, d) => { acc[d] = (confirmedScheduleEntries || []).filter((e) => e.day === d).length; return acc; }, {});
    const totalClasses = confirmedScheduleEntries.length;
    const activeTeachers = countActiveTeachers(confirmedScheduleEntries);
    const uniqueRooms = unique(confirmedScheduleEntries.map((e) => e.room || '').filter(Boolean)).length;
    const uniqueCourses = unique(confirmedScheduleEntries.map((e) => e.courseCode || e.code || e.subject || '').filter(Boolean)).length;
    const conflicts = (confirmedScheduleEntries || []).filter((e) => e.hasConflict).length;
    
    // Calculate room utilization (percentage of available time slots filled)
    const maxSlotsPerDay = 10; // Assuming 10 possible time slots per day
    const totalAvailableSlots = WEEK_DAYS.length * maxSlotsPerDay;
    const roomUtilizationPercent = totalAvailableSlots > 0 
      ? Math.round((totalClasses / totalAvailableSlots) * 100) 
      : 0;
    
    return { 
      totalClasses: {
        value: totalClasses,
        caption: `${uniqueCourses} courses`,
        unit: ''
      },
      activeTeachers: {
        value: activeTeachers,
        caption: 'teaching',
        unit: ''
      },
      roomUtilization: {
        value: roomUtilizationPercent,
        caption: `${uniqueRooms} rooms`,
        unit: '%'
      },
      conflicts: {
        value: conflicts,
        caption: conflicts === 0 ? 'No issues' : 'needs review',
        deltaKind: conflicts === 0 ? 'flat' : 'down',
        unit: ''
      },
      byDay 
    };
  }, [confirmedScheduleEntries, facultyList, userRole]);

  const teacherNameList = useMemo(() => {
    const names = new Set();
    facultyList.forEach((f) => {
      const label = stripTitles(displayNameFrom(f) || f.fullName || f.name || '');
      // Filter out emails - only include if it looks like a name (contains space or is not an email)
      if (label && !label.includes('@') && label.trim()) {
        names.add(label);
      }
    });
    scheduleData.forEach((entry) => {
      const label = stripTitles(entry.teacher || entry.teacherName || '');
      // Filter out emails
      if (label && !label.includes('@') && label.trim()) {
        names.add(label);
      }
    });
    return sortStrings(Array.from(names).filter(Boolean));
  }, [facultyList, scheduleData]);

  const courseNameList = useMemo(() => {
    const names = new Set();
    coursesList.forEach((course) => {
      const label =
        course?.nameEn ||
        course?.nameSk ||
        course?.title ||
        course?.subject ||
        course?.code ||
        '';
      if (label) names.add(label);
    });
    scheduleData.forEach((entry) => {
      const label = entry.subject || entry.courseName || entry.courseCode || '';
      if (label) names.add(label);
    });
    return sortStrings(Array.from(names).filter(Boolean));
  }, [coursesList, scheduleData]);

  const roomNameList = useMemo(() => {
    const names = new Set();
    roomsList.forEach((room) => {
      const label = room?.name || room?.code || room?.id || '';
      if (label) names.add(label);
    });
    scheduleData.forEach((entry) => {
      const label = entry.room || '';
      if (label) names.add(label);
    });
    return sortStrings(Array.from(names).filter(Boolean));
  }, [roomsList, scheduleData]);

  return (
      <div className="min-h-screen bg-background flex flex-col">
        <RoleSidebar
            userRole={userRole}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() =>
                setIsSidebarCollapsed((prev) => {
                    const next = !prev;
                    if (!next) {
                        setIsResourcePanelCollapsed(true);
                    }
                    return next;
                })
            }
        />
        <ResourcePanel
            isCollapsed={isResourcePanelCollapsed}
            onToggle={() =>
                setIsResourcePanelCollapsed((prev) => {
                    const next = !prev;
                    if (!next) {
                        setIsSidebarCollapsed(true);
                    }
                    return next;
                })
            }
            selectedDate={selectedWeek}
            onResourceSelect={handleResourceSelect}
            scheduleData={confirmedScheduleEntries}
            timeSlots={TIME_SLOTS}
            currentUserEmail={userEmail}
            currentUserName={headerDisplayName}
            classGroupDict={classGroupDict}
            userRole={userRole}
            teacherList={resourceTeachers}
            roomList={resourceRooms}
            equipmentList={resourceEquipment}
        />
        <main
            className={`flex-1 flex flex-col transition-all duration-300 pt-16 ml-0 ${
                isSidebarCollapsed ? 'md:ml-16 lg:ml-20' : 'md:ml-64 lg:ml-72'
            } ${isResourcePanelCollapsed ? 'md:mr-0 2xl:mr-12' : 'md:mr-[24rem] 2xl:mr-[24rem]'}`}
        >
          <div className="flex-1 px-6 pt-3 pb-6">
            <NavigationBreadcrumb />
            {(loadingBootstrap || loadingEnrollment) && (
                <DataLoader
                    label="Preparing schedule overview…"
                    description="Compiling timetable, resource panel, and conflicts."
                    details={[
                      'Base timetable import • lecture locks • resource mapping',
                      'Faculty roster & room availability • equipment ledger',
                      'Student enrolments overlay • conflict detection • filters',
                    ]}
                    fullScreen
                />
            )}
            <Reveal as={motion.div} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">Class Schedule Management</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  {userRole === 'student'
                      ? 'Browse your timetable and resources'
                      : 'Create, modify, and oversee academic timetables and classroom assignments'}
                </p>
              </div>
            </Reveal>

            {/* Tabs (for teachers only) */}
            {userRole !== 'student' && (
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.TABS} variant="keycap" waitForLoaders={true} className="mb-6">
                <div className="bg-card rounded-lg border border-border p-3">
                  <TabBar
                    value={activeTab}
                    onChange={setActiveTab}
                    items={[
                      { value: 'schedule', label: 'Schedule', icon: 'Calendar' },
                      { value: 'class-groups', label: 'Class Groups', icon: 'Users' },
                    ]}
                    className="gap-2"
                  />
                </div>
              </Reveal>
            )}

            {/* Class Groups Tab Content */}
            {activeTab === 'class-groups' && userRole !== 'student' && (
              <Reveal as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                <ClassGroupManagement userEmail={userEmail} />
              </Reveal>
            )}

            {/* Schedule Tab Content */}
            {activeTab === 'schedule' && (
              <>
                <Reveal as={motion.div} delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true}>
                  <ScheduleStats
                    stats={userRole === 'student' ? studentStats : teacherStats}
                    viewMode={viewMode}
                    userRole={userRole}
                  />
                </Reveal>

                {userRole !== 'student' && (
                  <Reveal as={motion.div} delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true}>
                    <QuickActionPanel userRole={userRole} onQuickAction={handleQuickAction} className="mb-6" />
                  </Reveal>
                )}

                <Reveal as={motion.div} delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true}>
                  <ScheduleFilters
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                    onViewModeChange={setViewMode}
                    viewMode={viewMode}
                    classGroupOptions={userRole === 'student' ? null : classGroupOptions}
                    userRole={userRole}
                    scheduleData={scheduleData}
                    teacherNames={teacherNameList}
                    courseNames={courseNameList}
                    roomNames={roomNameList}
                  />
                </Reveal>

                {filters.today && isWeekendToday ? (
                  <div className="bg-card rounded-lg border border-border p-8 text-center mb-6">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Icon name="CalendarX" size={22} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No classes today</h3>
                    <p className="text-sm text-muted-foreground mt-1">It&apos;s a weekend. Switch to Week View to browse the timetable.</p>
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Calendar"
                        onClick={() => {
                          setFilters({ ...filters, today: false });
                          setViewMode('week');
                        }}
                      >
                        View Week
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ScheduleCalendar
                    scheduleData={displayedScheduleData}
                    selectedWeek={selectedWeek}
                    onScheduleClick={handleScheduleClick}
                    onTimeSlotClick={handleTimeSlotClick}
                    viewMode={viewMode}
                    userRole={userRole}
                    availableMode={userRole === 'student' ? false : !!filters?.available}
                    exportContext={{ owner: ownerName, filters, viewMode, selectedWeek }}
                    currentTeacherName={headerDisplayName}
                    currentTeacherEmail={userEmail}
                    canManageAll={canManageAll}
                    onNotify={(type, message) => guardedNotify(`schedule-calendar-${type}-${Date.now()}`, type, message, { lockMs: 2200 })}
                    classGroupDict={classGroupDict}
                    weekDays={WEEK_DAYS}
                    timeSlots={TIME_SLOTS}
                    coursesList={coursesList}
                  />
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Icon name="Calendar" size={16} />
                      <span>Showing {displayedScheduleData.length} classes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Clock" size={16} />
                      <span>Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" iconName="RefreshCw" onClick={() => window.location?.reload()}>
                      Refresh
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <PageFooter
            left={[
              `MAIS 2.0 • ${userRole === 'teacher' ? 'Teacher Portal' : 'Student Portal'}`,
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
        </main>

        <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            onSave={handleScheduleSave}
      onDelete={handleScheduleDelete}
            scheduleData={selectedSchedule}
            mode={modalMode}
            userRole={userRole}
            currentTeacherName={headerDisplayName}
            currentTeacherEmail={userEmail}
            timeSlots={TIME_SLOTS}
            weekDays={WEEK_DAYS}
            dynamic={{
              teacherOptions: allTeachers,
              subjectOptions: subjectOptionsFromCourses,
              teacherCourseMap,
              roomOptions: roomOptionsFromApi,
              yearOptions: allYears,
              facultyList: facultyList,
              classGroups: classGroupsList,
            }}
            existingSchedules={scheduleData}
        />

        <ToastViewport position="top-right" />
      </div>
  );
};

const ClassScheduleManagement = () => (
    <ToastsProvider>
      <ClassScheduleManagementInner />
    </ToastsProvider>
);

export default ClassScheduleManagement;