// src/pages/attendance-tracking/AttendanceTracking.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import AttendanceHeader from './components/AttendanceHeader';
import AttendanceStats from './components/AttendanceStats';
import StudentAttendanceCard from './components/StudentAttendanceCard';
import AttendanceChart from './components/AttendanceChart';
import BulkActionsModal from './components/BulkActionsModal';
import AttendanceFilters from './components/AttendanceFilters';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';

import { buildGradebookForTeacher } from '../../data/gradebookApiAdapter';
import { resourceCache } from '../../data/resourceCache';
import { fetchTeacherTimetable } from '../../data/maisApiAdapter';
import { markAttendance, bulkMarkAttendance, getAttendanceByCourse } from '../../data/attendanceApi';
import { maisId, studentCode } from '../../utils/ids';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import Pagination from '../../components/ui/Pagination';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import useUserPreference from '../../hooks/useUserPreference';
import useDataUpdates from '../../hooks/useDataUpdates';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';

import { createLogger } from '../../utils/logger';
import useGradesHub from '../../hooks/useGradesHub';
import useAttendanceHub from '../../hooks/useAttendanceHub';
const logger = createLogger('index');

const toYMD = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const addDays = (dateStr, delta) => {
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() + delta);
  return toYMD(dt);
};
const todayStr = () => toYMD(new Date());

const asRecord = (v) => (v && typeof v === 'object' ? v : {});

const explodeList = (val) => {
  if (Array.isArray(val)) return val.flatMap(explodeList).filter((v) => v || v === 0);
  if (!val && val !== 0) return [];
  return String(val).split(/[,;|/]+/g).map((v) => v.trim()).filter(Boolean);
};

const normalizeGroupKey = (raw) => {
  if (!raw && raw !== 0) return null;
  const s = String(raw).toLowerCase().trim();
  if (!s) return null;
  // Accept patterns like "01-sk", "sk-01", "1", or any valid group key
  const cleaned = s.replace(/\s+/g, '').replace(/_/g, '-');
  const m = cleaned.match(/^(\d{1,2})-?sk$/) || cleaned.match(/^sk-?(\d{1,2})$/) || cleaned.match(/^(\d{1,2})$/);
  if (m) {
    return String(parseInt(m[1], 10)).padStart(2, '0') + '-sk';
  }
  // Return original for any other valid group key format (like "123-fei-cybersecurity")
  return s;
};

const codeFromText = (s) => {
  const m = String(s || '').match(/\((\d{5,})\)\s*$/);
  return m ? m[1] : '';
};

const buildTeacherClassesAndGroups = (teacherEmail, timetableSource = [], courseLookup = () => null) => {
  const mine = (timetableSource || []).filter(
      (t) => String(t.teacherEmail || '').toLowerCase() === String(teacherEmail).toLowerCase()
  );
  const byCourse = new Map();
  const groupsByCourse = new Map();
  mine.forEach((t) => {
    if (!byCourse.has(t.courseCode)) byCourse.set(t.courseCode, []);
    byCourse.get(t.courseCode).push(t);
    const gset = groupsByCourse.get(t.courseCode) || new Set();
    explodeList(t?.classGroupKeys).forEach((k) => {
      const nk = normalizeGroupKey(k);
      if (nk) gset.add(nk);
    });
    if (gset.size) groupsByCourse.set(t.courseCode, gset);
  });
  const classes = Array.from(byCourse.keys()).map((code) => {
    const course = courseLookup?.(code);
    const label = course?.nameEn || course?.name || code;
    return { id: maisId('class', code), courseCode: code, name: label };
  });
  const allGroups = new Set();
  Array.from(groupsByCourse.values()).forEach((s) => s.forEach((g) => allGroups.add(g)));
  return { classes, byCourse, groupsByCourse, allGroups };
};

const parseTimeToMin = (t) => {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return (+m[1]) * 60 + (+m[2]);
};

const longDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const isWeekendDate = (dateStr) => {
  const d = new Date(dateStr);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
};

const statusMeta = (status) => {
  switch (status) {
    case 'absent':  return { type: 'error',   requiresAction: true,  priority: 'high' };
    case 'late':    return { type: 'warning', requiresAction: false, priority: 'medium' };
    case 'excused': return { type: 'info',    requiresAction: false, priority: 'low' };
    default:        return { type: 'success', requiresAction: false, priority: 'low' };
  }
};

const SessionPicker = ({ sessions, selectedKey, onSelect, nowSessions, onJumpNow }) => {
  const { isBlocked } = useGlobalLoaderBlocking();
  const nowDayName = longDays[new Date().getDay()];
  return (
      <MotionConfig transition={{ duration: 0.38, ease: 'easeOut' }}>
        <div className="bg-card glass-card border border-border rounded-xl p-5 space-y-5">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.25em]">Sessions</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{sessions.length} items in timetable</span>
              <span>Local time {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {Array.isArray(nowSessions) && nowSessions.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {nowSessions.map((ns, idx) => (
                    <motion.button
                        key={ns.key}
                        type="button"
                        onClick={() => onJumpNow?.(ns)}
                        className="group relative rounded-lg border border-green-400/35 bg-green-400/10 px-3 py-3 text-left transition-colors duration-200 hover:bg-green-400/14"
                        initial={{ opacity: 0, y: 14 }}
                        animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                        transition={{ delay: ANIMATION_DELAYS.SUMMARY_CARDS + idx * 0.04 }}
                        whileHover={{ y: -1, scale: 1.005 }}
                        whileTap={{ scale: 0.995 }}
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-green-300">
                        <Icon name="Zap" size={12} /> Live now
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground truncate">{ns.courseName}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-green-200">
                        <span className="inline-flex items-center gap-1"><Icon name="Clock" size={11} /> {ns.start}–{ns.end}</span>
                        <span className="opacity-60">•</span>
                        <span>{ns.room || '—'}</span>
                      </div>
                    </motion.button>
                ))}
              </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((session, idx) => {
              const active = session.key === selectedKey;
              const dayLabel = session.day === nowDayName ? 'Today' : session.day;
              return (
                  <motion.button
                      key={session.key}
                      type="button"
                      onClick={() => onSelect(session.key)}
                      className={`relative rounded-xl border px-4 py-4 text-left transition-colors duration-200 ${
                        active
                            ? 'border-primary/45 bg-primary/10 shadow-[0_18px_36px_rgba(76,185,255,0.18)]'
                            : 'border-white/12 bg-card/70 hover:bg-card/78'
                      }`}
                      initial={{ opacity: 0, y: 18 }}
                      animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                      transition={{ delay: ANIMATION_DELAYS.SUMMARY_CARDS + idx * 0.04 }}
                      whileHover={{ y: -1, scale: 1.004 }}
                      whileTap={{ scale: 0.995 }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {dayLabel}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {session.subjectName || session.courseName || 'Course'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                          <span className="inline-flex items-center gap-1"><Icon name="Clock" size={11} /> {session.start}–{session.end}</span>
                          <span className="opacity-60">•</span>
                          <span>{session.room || '—'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${session.badgeColor}`}>{session.badgeText}</span>
                        <span className="inline-flex items-center gap-1"><Icon name="Users" size={11} /> Cap {session.capacity ?? '∞'}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      {(session.classGroupKeys || []).map((groupKey) => (
                          <span key={groupKey} className="rounded border border-white/12 bg-background/60 px-1.5 py-0.5">
                            {groupKey}
                          </span>
                      ))}
                      {!(session.classGroupKeys || []).length && (
                          <span className="rounded border border-dashed border-white/12 px-1.5 py-0.5">No groups</span>
                      )}
                    </div>
                  </motion.button>
              );
            })}
            {!sessions.length && <div className="text-sm text-muted-foreground">No sessions scheduled</div>}
          </div>
        </div>
      </MotionConfig>
  );
};

const AttendanceTrackingInner = () => {
  const { notify } = useToasts();
  // Get current academic year
  const currentAcademicYear = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const academicYearStart = currentMonth >= 9 ? currentYear : currentYear - 1;
    return `${academicYearStart}/${academicYearStart + 1}`;
  }, []);
  
  // Convert period to keys and labels for compatibility
  const getPeriodData = () => {
    const academicYear = currentAcademicYear || '2025/2026';
    const yearSlug = academicYear.replace('/', '-');
    const KEY_WS = `1-rok-${yearSlug}-ws`;
    const KEY_SS = `1-rok-${yearSlug}-ss`;
    return { KEY_WS, KEY_SS, ACADEMIC_YEAR: academicYear };
  };
  
  const { KEY_WS, KEY_SS, ACADEMIC_YEAR } = getPeriodData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userRole] = useState('teacher');
  const { user } = useAuth();
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
  const userName = useProfileDisplayName('Teacher');
  const { push, addActivity } = useNotifications();
  const teacherEmailLc = useMemo(() => String(user?.email || '').toLowerCase(), [user?.email]);
  const targetTeacherEmail = teacherEmailLc;

  const attendancePreferenceKey = useMemo(
      () => `attendance.store.${teacherEmailLc}`,
      [teacherEmailLc],
  );
  const {
    value: storedAttendance,
    setValue: saveAttendancePreference,
    loading: attendanceLoading,
  } = useUserPreference(attendancePreferenceKey, {});
  const [attendanceStore, setAttendanceStore] = useState({});
  const attendanceHydratedRef = useRef(false);
  useEffect(() => {
    if (attendanceHydratedRef.current) return;
    if (attendanceLoading) return;
    attendanceHydratedRef.current = true;
    setAttendanceStore(
        storedAttendance && typeof storedAttendance === 'object' ? storedAttendance : {},
    );
  }, [attendanceLoading, storedAttendance]);
  const persistDay = useCallback((courseCode, date, dayMap) => {
    setAttendanceStore((prev) => {
      const next = { ...(prev || {}) };
      const current = { ...(next[courseCode] || {}) };
      current[date] = { ...dayMap };
      next[courseCode] = current;
      return next;
    });
  }, []);
  useEffect(() => {
    if (!attendanceHydratedRef.current) return;
    saveAttendancePreference(attendanceStore);
  }, [attendanceStore, saveAttendancePreference]);

  const [coursesList, setCoursesList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [timetableEntries, setTimetableEntries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const courses = await resourceCache.getCourses();
        if (!cancelled) setCoursesList(Array.isArray(courses) ? courses : []);
      } catch {
        if (!cancelled) setCoursesList([]);
      }
      try {
        const rooms = await resourceCache.getRooms();
        if (!cancelled) setRoomsList(Array.isArray(rooms) ? rooms : []);
      } catch {
        if (!cancelled) setRoomsList([]);
      }
      try {
        const timetable = await fetchTeacherTimetable(targetTeacherEmail);
        if (!cancelled) setTimetableEntries(Array.isArray(timetable) ? timetable : []);
      } catch {
        if (!cancelled) setTimetableEntries([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // SignalR real-time updates for attendance
  const handleDataUpdate = useCallback((payload) => {
    if (!payload?.type) return;
    if (payload.type === 'attendance.updated' || payload.type === 'grade.updated') {
      logger.debug('Attendance real-time update:', payload);
      // Reload gradebook data
      (async () => {
        try {
          const book = await buildGradebookForTeacher(targetTeacherEmail);
          setGradebookData(book || { teacher: null, classes: [], classStudents: new Map(), assignments: [], grades: {}, finalGrades: [] });
        } catch (err) {
          logger.error('Failed to refresh gradebook:', err);
        }
      })();
    }
  }, []);

  useDataUpdates(handleDataUpdate);

  // Dedicated GradesHub for real-time attendance/grade updates
  useGradesHub({
    onGradeUpdated: useCallback(async () => {
      logger.debug('Grade updated via GradesHub');
      try {
        const book = await buildGradebookForTeacher(targetTeacherEmail);
        setGradebookData(book || { teacher: null, classes: [], classStudents: new Map(), assignments: [], grades: {}, finalGrades: [] });
      } catch (err) {
        logger.error('Failed to refresh gradebook:', err);
      }
    }, [targetTeacherEmail]),
    onGradeCreated: useCallback(async () => {
      logger.debug('Grade created via GradesHub');
      try {
        const book = await buildGradebookForTeacher(targetTeacherEmail);
        setGradebookData(book || { teacher: null, classes: [], classStudents: new Map(), assignments: [], grades: {}, finalGrades: [] });
      } catch (err) {
        logger.error('Failed to refresh gradebook:', err);
      }
    }, [targetTeacherEmail]),
    onBulkGradesUpdated: useCallback(async () => {
      logger.debug('Bulk grades updated via GradesHub');
      try {
        const book = await buildGradebookForTeacher(targetTeacherEmail);
        setGradebookData(book || { teacher: null, classes: [], classStudents: new Map(), assignments: [], grades: {}, finalGrades: [] });
      } catch (err) {
        logger.error('Failed to refresh gradebook:', err);
      }
    }, [targetTeacherEmail])
  });

  const findCourseByCode = useCallback((code) => {
    const key = String(code || '').toUpperCase();
    return coursesList.find((c) => String(c.code || c.id || '').toUpperCase() === key) || null;
  }, [coursesList]);

  const roomByName = useCallback((name) => {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    return roomsList.find((r) => String(r.name || r.id || '').trim().toLowerCase() === key) || null;
  }, [roomsList]);

  const [gradebookData, setGradebookData] = useState({ teacher: null, classes: [], classStudents: new Map(), assignments: [], grades: {}, finalGrades: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await buildGradebookForTeacher(targetTeacherEmail);
        if (!cancelled) {
          const normalized = {
            teacher: data?.teacher || null,
            classes: Array.isArray(data?.classes) ? data.classes : [],
            classStudents: data?.classStudents instanceof Map ? data.classStudents : new Map(data?.classStudents || []),
            assignments: Array.isArray(data?.assignments) ? data.assignments : [],
            grades: data?.grades || {},
            finalGrades: Array.isArray(data?.finalGrades) ? data.finalGrades : [],
          };
          setGradebookData(normalized);
        }
      } catch {
        if (!cancelled) {
          setGradebookData({ teacher: null, classes: [], classStudents: new Map(), assignments: [], grades: {}, finalGrades: [] });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { classes: teacherClasses } = useMemo(
      () => buildTeacherClassesAndGroups(targetTeacherEmail, timetableEntries, findCourseByCode),
      [timetableEntries, findCourseByCode]
  );

  const gbClasses = gradebookData.classes || [];
  const gbClassStudents = gradebookData.classStudents || new Map();

  const safeClasses = useMemo(() => {
    return teacherClasses;
  }, [teacherClasses]);

  const allowedGroupsByCourse = useMemo(() => {
    const map = new Map();
    (timetableEntries || [])
        .filter((t) => String(t.teacherEmail || '').toLowerCase() === teacherEmailLc)
        .forEach((t) => {
          const set = map.get(t.courseCode) || new Set();
          explodeList(t.classGroupKeys || []).forEach((g) => {
            const nk = normalizeGroupKey(g);
            if (nk) set.add(nk);
          });
          if (set.size) map.set(t.courseCode, set);
        });
    gbClasses.forEach((cls) => {
      const code = codeFromText(cls?.subject) || codeFromText(cls?.name) || cls?.courseCode || '';
      const list = gbClassStudents.get(cls?.id) || [];
      if (!code) return;
      const set = map.get(code) || new Set();
      list.forEach((s) => {
        const nk = normalizeGroupKey(s?.sectionKey);
        if (nk) set.add(nk);
      });
      if (set.size) map.set(code, set);
    });
    return map;
  }, [gbClasses, gbClassStudents, timetableEntries]);

  const rosterByCourseFromGB = useMemo(() => {
    const rosters = {};
    const addForCode = (code, arr) => {
      if (!code) return;
      if (!rosters[code]) rosters[code] = [];
      const seen = new Set(rosters[code].map((s) => s.email || s.id));
      arr.forEach((s) => {
        const key = s.email || s.id;
        if (seen.has(key)) return;
        seen.add(key);
        rosters[code].push(s);
      });
      rosters[code].sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''));
    };
    gbClasses.forEach((cls) => {
      const code = codeFromText(cls?.subject) || codeFromText(cls?.name) || cls?.courseCode || '';
      const list = gbClassStudents.get(cls?.id) || [];
      if (!code) return;
      const normalized = list.map((s) => {
        const fullName = s.fullName || s.displayName || s.name || '';
        const email = s.email || '';
        const id = s.id || maisId('stu', `${email}|${fullName}`);
        const nk = normalizeGroupKey(s.sectionKey);
        return {
          id,
          fullName,
          email,
          photo: s.photo || null,
          sectionKey: nk || 'default',
          section: nk || 'default',
          studyYear: s.studyYear || s.year || 1
        };
      });
      addForCode(code, normalized);
    });
    return rosters;
  }, [gbClasses, gbClassStudents]);

  const [selectedClass, setSelectedClass] = useState(safeClasses[0]?.id || '');

  const classById = useMemo(() => {
    const map = new Map();
    safeClasses.forEach((c) => map.set(c.id, c));
    return map;
  }, [safeClasses]);

  useEffect(() => {
    const urlClassId = searchParams.get('classId');
    const urlCourse  = searchParams.get('course');
    const action     = searchParams.get('action');
    if (urlClassId && classById.has(urlClassId)) {
      setSelectedClass(urlClassId);
      return;
    }
    if (urlCourse) {
      setSelectedClass(maisId('class', urlCourse));
      return;
    }
    if (action === 'take' && safeClasses[0]?.id) {
      setSelectedClass(safeClasses[0].id);
    }
  }, [searchParams, classById, safeClasses]);

  const selectedCourseCode = classById.get(selectedClass)?.courseCode || safeClasses[0]?.courseCode;
  const selectedCourseName = classById.get(selectedClass)?.name || selectedCourseCode;

  // Load real attendance data from API
  const [realAttendanceData, setRealAttendanceData] = useState({});
  
  useEffect(() => {
    if (!selectedCourseCode) return;
    let cancelled = false;
    (async () => {
      try {
        const records = await getAttendanceByCourse(selectedCourseCode);
        if (cancelled) return;
        // Group by student and date
        const byStudentDate = {};
        (Array.isArray(records) ? records : []).forEach((r) => {
          const key = `${r.studentId}|${r.sessionDate}`;
          byStudentDate[key] = r.status;
        });
        setRealAttendanceData(byStudentDate);
      } catch (err) {
        logger.error('Failed to load attendance data:', err);
        if (!cancelled) setRealAttendanceData({});
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCourseCode]);

  // Calculate attendance rates from real data
  const attendanceRatesByStudent = useMemo(() => {
    const rates = {};
    const byStudent = {};
    
    Object.entries(realAttendanceData).forEach(([key, status]) => {
      const [studentId] = key.split('|');
      if (!byStudent[studentId]) byStudent[studentId] = { total: 0, present: 0, late: 0 };
      byStudent[studentId].total++;
      if (status === 'present') byStudent[studentId].present++;
      if (status === 'late') byStudent[studentId].late++;
    });
    
    Object.entries(byStudent).forEach(([studentId, counts]) => {
      rates[studentId] = counts.total > 0
        ? Math.round(((counts.present + counts.late) / counts.total) * 100)
        : 100; // Default to 100% if no records
    });
    
    return rates;
  }, [realAttendanceData]);

  // Get recent attendance for a student
  const getRecentAttendance = useCallback((studentId) => {
    const last7 = [...Array(7)].map((_, i) => addDays(todayStr(), -(6 - i)));
    return last7.map((date) => {
      const key = `${studentId}|${date}`;
      return {
        date,
        status: realAttendanceData[key] || null // null means no record
      };
    }).filter(r => r.status !== null);
  }, [realAttendanceData]);

  const rosters = useMemo(() => {
    const codes = safeClasses.map((c) => c.courseCode);
    const out = {};
    codes.forEach((code) => {
      const fromGB = rosterByCourseFromGB[code] || [];
      // Only use students from gradebook (real enrolled students)
      out[code] = fromGB.map((s) => ({
        ...s,
        attendanceRate: attendanceRatesByStudent[s.id] ?? 100,
        recentAttendance: getRecentAttendance(s.id)
      }));
    });
    return out;
  }, [safeClasses, rosterByCourseFromGB, attendanceRatesByStudent, getRecentAttendance]);

  // Dedicated AttendanceHub for real-time attendance updates
  const selectedCourseCodeRef = useRef(null);
  useEffect(() => {
    selectedCourseCodeRef.current = selectedCourseCode;
  }, [selectedCourseCode]);

  const reloadAttendanceFromHub = useCallback(async () => {
    const courseCode = selectedCourseCodeRef.current;
    if (!courseCode) return;
    try {
      const records = await getAttendanceByCourse(courseCode);
      const byStudentDate = {};
      (Array.isArray(records) ? records : []).forEach((r) => {
        const key = `${r.studentId}|${r.sessionDate}`;
        byStudentDate[key] = r.status;
      });
      setRealAttendanceData(byStudentDate);
      logger.debug('Attendance data reloaded via hub');
    } catch (err) {
      logger.error('Failed to reload attendance data via hub:', err);
    }
  }, []);

  useAttendanceHub({
    onAttendanceUpdated: reloadAttendanceFromHub,
    onAttendanceMarked: reloadAttendanceFromHub,
    onBulkAttendanceUpdated: reloadAttendanceFromHub
  });

  const [selectedDate, setSelectedDate] = useState(todayStr());

  const courseSessionsRaw = useMemo(() => {
    return (timetableEntries || [])
        .filter((t) => t.courseCode === selectedCourseCode && String(t.teacherEmail || '').toLowerCase() === teacherEmailLc)
        .map((t, idx) => {
          const [s, e] = String(t.slot || '').split('-').map((x) => (x || '').trim());
          const roomObj = roomByName(t.room);
          const cap = roomObj?.capacity ?? null;
          const classKeys = Array.isArray(t.classGroupKeys) ? t.classGroupKeys.slice().map(normalizeGroupKey).filter(Boolean) : [];
          // Get course name from coursesList
          const course = findCourseByCode(t.courseCode);
          const courseName = course?.nameEn || course?.nameSk || course?.name || t.courseCode || 'Course';
          return {
            key: `${t.day}|${t.slot}|${idx}`,
            day: t.day,
            start: s,
            end: e,
            startMin: parseTimeToMin(s),
            endMin: parseTimeToMin(e),
            classGroupKeys: classKeys,
            room: t.room || '',
            capacity: cap,
            courseName,
            subjectName: courseName
          };
        })
        .sort((a, b) => {
          const d = longDays.indexOf(a.day) - longDays.indexOf(b.day);
          return d !== 0 ? d : (a.startMin - b.startMin);
        });
  }, [selectedCourseCode, timetableEntries, roomByName, findCourseByCode, teacherEmailLc]);

  const decoratedSessions = useMemo(() => {
    const now = new Date();
    const today = todayStr();
    const selected = new Date(selectedDate);
    const selectedName = longDays[selected.getDay()];
    const selectedIsToday = selectedDate === today;
    const selectedIsPast = new Date(selectedDate) < new Date(today);
    const selectedIsFuture = new Date(selectedDate) > new Date(today);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return courseSessionsRaw.map((s) => {
      let badgeText = 'Other day';
      let badgeColor = 'bg-muted text-foreground';
      if (s.day === selectedName) {
        if (selectedIsPast) {
          badgeText = 'Past';
          badgeColor = 'bg-zinc-600/90 text-white';
        } else if (selectedIsFuture) {
          badgeText = 'Upcoming';
          badgeColor = 'bg-blue-600/90 text-white';
        } else if (selectedIsToday) {
          if (s.startMin != null && s.endMin != null) {
            if (nowMin >= s.startMin && nowMin < s.endMin) {
              badgeText = 'Now';
              badgeColor = 'bg-green-600/90 text-white';
            } else if (nowMin < s.startMin) {
              badgeText = 'Next';
              badgeColor = 'bg-blue-600/90 text-white';
            } else {
              badgeText = 'Finished';
              badgeColor = 'bg-zinc-600/90 text-white';
            }
          } else {
            badgeText = 'Today';
            badgeColor = 'bg-indigo-600/90 text-white';
          }
        }
      }
      return { ...s, badgeText, badgeColor };
    });
  }, [courseSessionsRaw, selectedDate]);

  const sessionsForSelectedDay = useMemo(() => {
    if (isWeekendDate(selectedDate)) return [];
    const name = longDays[new Date(selectedDate).getDay()];
    return decoratedSessions.filter((s) => s.day === name);
  }, [decoratedSessions, selectedDate]);

  const [manualSessionKey, setManualSessionKey] = useState('');
  useEffect(() => {
    const first = sessionsForSelectedDay[0]?.key || '';
    setManualSessionKey(first);
  }, [selectedCourseCode, selectedDate, sessionsForSelectedDay.length]);

  const selectedSession = useMemo(() => {
    return decoratedSessions.find((s) => s.key === manualSessionKey) || sessionsForSelectedDay[0] || null;
  }, [decoratedSessions, manualSessionKey, sessionsForSelectedDay]);

  const hasActiveSession = !!selectedSession;

  const sessionGroups = useMemo(() => {
    if (!selectedCourseCode) return [];
    if (selectedSession && selectedSession.classGroupKeys.length) return selectedSession.classGroupKeys.slice().sort();
    const set = allowedGroupsByCourse.get(selectedCourseCode);
    if (set && set.size) return Array.from(set).sort();
    // Return unique groups from roster instead of hardcoded defaults
    const rosterGroups = new Set((rosters[selectedCourseCode] || []).map(s => s.sectionKey).filter(Boolean));
    return rosterGroups.size > 0 ? Array.from(rosterGroups).sort() : ['default'];
  }, [selectedSession, allowedGroupsByCourse, selectedCourseCode, rosters]);

  const sessionCapacity = selectedSession?.capacity ?? null;

  const baseStudents = useMemo(() => {
    if (!selectedCourseCode) return [];
    return rosters[selectedCourseCode] || [];
  }, [rosters, selectedCourseCode]);

  const studentsForSessionAll = useMemo(() => {
    if (!selectedSession) return [];
    const set = new Set(sessionGroups);
    const list = baseStudents.filter((s) => set.has(s.sectionKey));
    const limited = sessionCapacity ? list.slice(0, sessionCapacity) : list;
    return limited.map((s) => {
      const canonicalId = String(s.id || '').trim();
      const studentId = /^[a-z]{2}\d{3}[a-z]{2}$/i.test(canonicalId)
        ? canonicalId.toLowerCase()
        : studentCode({ email: s.email, fullName: s.fullName, year: ACADEMIC_YEAR }).toLowerCase();
      const studyYear = s.studyYear || 1;
      const termText = `${studyYear}. rok ${ACADEMIC_YEAR} WS`;
      return {
        id: canonicalId,
        name: s.fullName,
        studentId,
      email: s.email || '',
      gradeKey: KEY_WS,
      gradeText: termText,
      section: s.sectionKey,
      sectionKey: s.sectionKey,
      photo: s.photo || null,
      attendanceRate: s.attendanceRate ?? 100,
      recentAttendance: s.recentAttendance || []
      };
    });
  }, [selectedSession, baseStudents, sessionGroups, sessionCapacity]);

  const [attendanceByDate, setAttendanceByDate] = useState({});
  useEffect(() => {
    const map = {};
    // Build from real attendance data
    Object.entries(realAttendanceData).forEach(([key, status]) => {
      const [studentId, date] = key.split('|');
      if (!date) return;
      if (!map[date]) map[date] = {};
      map[date][studentId] = status;
    });
    // Also merge any locally stored attendance (for unsaved changes)
    const courseBlock = asRecord(attendanceStore[selectedCourseCode]);
    Object.entries(courseBlock).forEach(([date, day]) => {
      if (!map[date]) map[date] = {};
      Object.entries(asRecord(day)).forEach(([sid, st]) => {
        map[date][sid] = st;
      });
    });
    setAttendanceByDate(map);
  }, [realAttendanceData, selectedCourseCode, attendanceStore]);

  const dateStatuses = attendanceByDate[selectedDate] || {};

  const studentsForSessionWithStatus = useMemo(() => {
    return studentsForSessionAll.map((s) => ({
      ...s,
      status: dateStatuses[s.id] ?? 'present'
    }));
  }, [studentsForSessionAll, dateStatuses]);

  const studentById = useMemo(() => {
    const m = new Map();
    studentsForSessionWithStatus.forEach((st) => m.set(st.id, st));
    return m;
  }, [studentsForSessionWithStatus]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [attendanceRateFilter, setAttendanceRateFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch != null) setSearchTerm(urlSearch);
    const urlStatus = searchParams.get('status');
    if (urlStatus != null) setStatusFilter(urlStatus);
    const urlRate = searchParams.get('rate');
    if (urlRate != null) setAttendanceRateFilter(urlRate);
    const urlGroup = searchParams.get('group');
    if (urlGroup != null) setGroupFilter(urlGroup);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (statusFilter) params.set('status', statusFilter);
    if (attendanceRateFilter) params.set('rate', attendanceRateFilter);
    if (groupFilter) params.set('group', groupFilter);
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== currentSearch) {
      navigate({ pathname: '/attendance-tracking', search: newSearch }, { replace: true });
    }
  }, [searchTerm, statusFilter, attendanceRateFilter, groupFilter, navigate]);

  // Generate unique group options from current session groups
  const uniqueGroupOptions = useMemo(() => {
    const groups = new Set();
    studentsForSessionAll.forEach((s) => {
      if (s.sectionKey) groups.add(s.sectionKey);
      if (s.section && s.section !== s.sectionKey) groups.add(s.section);
    });
    // Also include sessionGroups
    sessionGroups.forEach((g) => {
      if (g && g !== 'default') groups.add(g);
    });
    return Array.from(groups).sort();
  }, [studentsForSessionAll, sessionGroups]);

  const filteredStudents = useMemo(() => {
    let filtered = studentsForSessionWithStatus;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
          (s) =>
              s.name.toLowerCase().includes(q) ||
              String(s.studentId).toLowerCase().includes(q) ||
              (s.email || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) filtered = filtered.filter((s) => s.status === statusFilter);
    if (attendanceRateFilter) {
      filtered = filtered.filter((s) => {
        switch (attendanceRateFilter) {
          case 'excellent': return s.attendanceRate >= 95;
          case 'good': return s.attendanceRate >= 85 && s.attendanceRate < 95;
          case 'fair': return s.attendanceRate >= 75 && s.attendanceRate < 85;
          case 'poor': return s.attendanceRate < 75;
          default: return true;
        }
      });
    }
    if (groupFilter) {
      filtered = filtered.filter((s) => s.sectionKey === groupFilter || s.section === groupFilter);
    }
    return filtered;
  }, [studentsForSessionWithStatus, searchTerm, statusFilter, attendanceRateFilter, groupFilter]);

  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, groupFilter, selectedClass, selectedDate, manualSessionKey]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / perPage));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageStart = (page - 1) * perPage;
  const pageEnd = Math.min(filteredStudents.length, page * perPage);
  const pagedStudents = filteredStudents.slice(pageStart, pageStart + perPage);

  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const present = filteredStudents.filter((s) => s.status === 'present').length;
    const absent = filteredStudents.filter((s) => s.status === 'absent').length;
    const late = filteredStudents.filter((s) => s.status === 'late').length;
    const excused = filteredStudents.filter((s) => s.status === 'excused').length;
    const chronicAbsences = filteredStudents.filter((s) => s.attendanceRate < 75).length;
    return { total, present, absent, late, excused, chronicAbsences };
  }, [filteredStudents]);

  const attendanceTrendData = useMemo(() => {
    const allDates = new Set(Object.keys(asRecord(attendanceByDate)));
    const last7 = Array.from(allDates).sort().slice(-7);
    return last7.map((d) => {
      const statuses = attendanceByDate[d] || {};
      const list = studentsForSessionAll.map((s) => statuses[s.id] || 'present');
      const presentCount = list.filter((st) => st === 'present' || st === 'late' || st === 'excused').length;
      const rate = Math.round((presentCount / Math.max(1, list.length)) * 100);
      return { id: d, date: d.slice(5), attendanceRate: rate };
    });
  }, [attendanceByDate, studentsForSessionAll]);

  const { push: pushNotif, addActivity: addAct } = useNotifications();

  const notifyAttendance = (student, prev, next) => {
    const corrId = `att_${selectedDate}_${student.id}`;
    const meta = statusMeta(next);
    const notif = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: meta.type,
      category: 'alerts',
      title: `Attendance ${next}: ${student.name}`,
      message: `${selectedDate} • ${student.section} • ${selectedCourseName}`,
      time: new Date().toISOString(),
      unread: true,
      href: '/attendance-tracking',
      meta: {
        corrId,
        studentId: student.studentId,
        email: student.email,
        courseCode: selectedCourseCode,
        courseName: selectedCourseName,
        date: selectedDate,
        status: next,
        prevStatus: prev,
        group: student.sectionKey
      },
      requiresAction: meta.requiresAction,
      priority: meta.priority
    };
    pushNotif(notif);
    const activity = {
      id: `attact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      corrId,
      type: 'attendance',
      title: `${student.name} marked ${next}`,
      description: `${selectedDate} • ${student.section} • ${selectedCourseName}`,
      subject: selectedCourseCode,
      classId: selectedClass,
      teacher: userName,
      room: '',
      timestamp: new Date().toISOString(),
      requiresAction: meta.requiresAction,
      priority: meta.priority
    };
    addAct(activity);
  };

  const notifyBulk = (changedList) => {
    if (!changedList.length) return;
    const tally = changedList.reduce((acc, it) => { acc[it.new] = (acc[it.new] || 0) + 1; return acc; }, {});
    const cnt = (k) => tally[k] || 0;
    const corrId = `att_bulk_${selectedCourseCode}_${selectedDate}`;
    const title = `Bulk attendance update • ${selectedCourseName}`;
    const message = `Date ${selectedDate} • present ${cnt('present')} • late ${cnt('late')} • excused ${cnt('excused')} • absent ${cnt('absent')}`;
    const anyAbsent = cnt('absent') > 0;
    const notif = {
      id: `att_bulk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: anyAbsent ? 'warning' : 'success',
      category: 'alerts',
      title,
      message,
      time: new Date().toISOString(),
      unread: true,
      href: '/attendance-tracking',
      meta: {
        corrId,
        courseCode: selectedCourseCode,
        courseName: selectedCourseName,
        date: selectedDate,
        counts: tally
      },
      requiresAction: anyAbsent,
      priority: anyAbsent ? 'high' : 'low'
    };
    push(notif);
    const activity = {
      id: `attact_bulk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      corrId,
      type: 'attendance',
      title,
      description: message,
      subject: selectedCourseCode,
      classId: selectedClass,
      teacher: userName,
      room: '',
      timestamp: new Date().toISOString(),
      requiresAction: anyAbsent,
      priority: anyAbsent ? 'high' : 'low'
    };
    addActivity(activity);
  };

  const handleAttendanceChange = async (studentId, newStatus) => {
    const prevStatus = (attendanceByDate[selectedDate] || {})[studentId] || 'present';
    const student = studentById.get(studentId);
    setAttendanceByDate((prev) => {
      const day = prev[selectedDate] ? { ...prev[selectedDate] } : {};
      day[studentId] = newStatus;
      const nextState = { ...prev, [selectedDate]: day };
      persistDay(selectedCourseCode, selectedDate, day);
      return nextState;
    });
    if (student && prevStatus !== newStatus) {
      notifyAttendance(student, prevStatus, newStatus);
    }
    // Save to API for persistent storage
    try {
      await markAttendance({
        courseCode: selectedCourseCode,
        studentId: studentId,
        studentEmail: student?.email || '',
        date: selectedDate,
        status: newStatus,
        classGroupKey: selectedClass || ''
      });
    } catch (err) {
      logger.error('Failed to save attendance to API:', err);
    }
  };

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const handleBulkUpdate = async (studentIds, status, customUpdates = null) => {
    const before = attendanceByDate[selectedDate] || {};
    const updates = customUpdates ? customUpdates : studentIds.map((id) => ({ id, status }));
    const changedList = [];
    const day = { ...before };
    updates.forEach((u) => {
      const prev = day[u.id] ?? 'present';
      const next = u.status;
      day[u.id] = next;
      if (prev !== next) changedList.push({ id: u.id, old: prev, new: next });
    });
    setAttendanceByDate((prev) => {
      const nextState = { ...prev, [selectedDate]: day };
      persistDay(selectedCourseCode, selectedDate, day);
      return nextState;
    });
    if (changedList.length) notifyBulk(changedList);
    
    // Save to API for persistent storage
    try {
      const students = updates.map(u => {
        const student = studentById.get(u.id);
        return {
          studentId: u.id,
          studentEmail: student?.email || '',
          status: u.status
        };
      });
      await bulkMarkAttendance({
        courseCode: selectedCourseCode,
        date: selectedDate,
        classGroupKey: selectedClass || '',
        students
      });
    } catch (err) {
      logger.error('Failed to save bulk attendance to API:', err);
    }
  };

  const handleCopyPreviousDay = (subset) => {
    const prevDate = addDays(selectedDate, -1);
    const prevMap = attendanceByDate[prevDate] || {};
    const list = Array.isArray(subset) && subset.length ? subset : studentsForSessionWithStatus;
    const updates = list.map((s) => ({ id: s.id, status: prevMap[s.id] ?? 'present' }));
    handleBulkUpdate(list.map(s => s.id), 'present', updates);
  };

  const handleExportReport = () => {
    const csvContent = [
      ['Date', 'Student ID', 'Name', 'Semester', 'Class', 'Status', 'Attendance Rate'],
      ...filteredStudents.map((s) => [
        selectedDate,
        s.studentId,
        s.name,
        s.gradeText,
        s.section,
        s.status,
        `${s.attendanceRate}%`
      ])
    ].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setAttendanceRateFilter('');
    setGroupFilter('');
  };

  const dynamicSideMargin = isSidebarCollapsed ? 'ipad:ml-16 md:ml-16 lg:ml-16' : 'ipad:ml-72 md:ml-72 lg:ml-72';

  const nowSessionsAll = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayName = longDays[now.getDay()];
    return (timetableEntries || [])
        .filter((t) => String(t.teacherEmail || '').toLowerCase() === teacherEmailLc && t.day === todayName)
        .map((t, idx) => {
          const [s, e] = String(t.slot || '').split('-').map((x) => (x || '').trim());
          const sm = parseTimeToMin(s);
          const em = parseTimeToMin(e);
          const course = findCourseByCode?.(t.courseCode);
          const roomObj = roomByName(t.room);
          return {
            key: `now|${t.courseCode}|${t.day}|${t.slot}|${idx}`,
            courseCode: t.courseCode,
            courseName: course?.nameEn || course?.name || t.courseCode,
            day: t.day,
            slot: t.slot,
            start: s,
            end: e,
            startMin: sm,
            endMin: em,
            room: t.room || '',
            capacity: roomObj?.capacity ?? null,
            classGroupKeys: Array.isArray(t.classGroupKeys) ? t.classGroupKeys.slice().map(normalizeGroupKey).filter(Boolean) : [],
            isNow: sm != null && em != null && nowMin >= sm && nowMin < em
          };
        })
        .filter((x) => x.isNow);
  }, []);

  const [pendingJump, setPendingJump] = useState(null);
  useEffect(() => {
    if (!pendingJump) return;
    if (selectedCourseCode !== pendingJump.courseCode) return;
    const todayName = longDays[new Date().getDay()];
    const s = decoratedSessions.find((x) => x.day === todayName && `${x.start}-${x.end}` === pendingJump.slot);
    if (s) {
      setManualSessionKey(s.key);
      setPendingJump(null);
    }
  }, [pendingJump, selectedCourseCode, decoratedSessions]);

  const handleJumpNow = (ns) => {
    setSelectedDate(todayStr());
    setSelectedClass(maisId('class', ns.courseCode));
    setPendingJump({ courseCode: ns.courseCode, slot: ns.slot });
  };

  return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header userRole={userRole} userName={userName} onLogout={() => logger.debug('Logout')} />
        <RoleSidebar
            userRole={userRole}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
          <main className="flex-1 px-3 ipad:px-6 pt-3 pb-6">
            <NavigationBreadcrumb />
            <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} className="mb-3">
              <AttendanceHeader
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onDateStep={(delta) => setSelectedDate(addDays(selectedDate, delta))}
                  selectedClass={selectedClass}
                  onClassChange={setSelectedClass}
                  classes={safeClasses}
                  userRole={userRole}
                  canEdit={true}
                  canGoPrev={true}
                  canGoNext={true}
                  onExportReport={handleExportReport}
                  onBulkAction={() => setIsBulkModalOpen(true)}
              />
            </Reveal>
            <Reveal as={motion.p} delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true} className="text-sm sm:text-base text-muted-foreground -mt-1 mb-4">
              Record, review, and export student attendance for each session.
            </Reveal>
            <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true} className="mb-4">
              <SessionPicker
                  sessions={sessionsForSelectedDay}
                  selectedKey={selectedSession?.key || ''}
                  onSelect={(k) => setManualSessionKey(k)}
                  nowSessions={nowSessionsAll}
                  onJumpNow={handleJumpNow}
              />
            </Reveal>
            {!hasActiveSession && (
                <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true} className="mb-6">
                  <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="CalendarX" size={18} className="text-muted-foreground" />
                      <h3 className="font-semibold text-foreground">
                        No sessions for {selectedDate === todayStr() ? 'today' : selectedDate}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isWeekendDate(selectedDate) ? 'Weekend: no timetable.' : 'Pick another date or jump to a current session.'}
                    </p>
                    {nowSessionsAll.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nowSessionsAll.map((ns) => (
                              <Button key={ns.key} size="sm" iconName="Zap" onClick={() => handleJumpNow(ns)}>
                                Go to {ns.courseName} {ns.start}–{ns.end}
                              </Button>
                          ))}
                        </div>
                    )}
                  </div>
                </Reveal>
            )}
            {hasActiveSession && (
                <>
                  <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true} className="mb-6">
                    <AttendanceStats stats={stats} selectedClass={selectedClass} userRole={userRole} />
                  </Reveal>
                  <Reveal delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="keycap" waitForLoaders={true} className="mb-6">
                    <QuickActionPanel userRole={userRole} onQuickAction={() => {}} />
                  </Reveal>
                  <Reveal delay={ANIMATION_DELAYS.PAGINATION} variant="keycap" waitForLoaders={true} as={motion.section} className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                    <div className="xl:col-span-2">
                      <AttendanceChart data={attendanceTrendData} chartType="line" title="Attendance Trend (Last 7 Days)" />
                    </div>
                    <div>
                      <AttendanceChart
                          data={attendanceTrendData.slice(-5)}
                          chartType="radial"
                          title="Average Attendance (Last 5 Days)"
                      />
                    </div>
                  </Reveal>
                  <Reveal delay={ANIMATION_DELAYS.FILTERS + 0.06} variant="keycap" waitForLoaders={true} className="mb-6">
                    <AttendanceFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        attendanceRateFilter={attendanceRateFilter}
                        onAttendanceRateFilterChange={setAttendanceRateFilter}
                        groupFilter={groupFilter}
                        onGroupFilterChange={setGroupFilter}
                        availableGroups={uniqueGroupOptions}
                        onClearFilters={handleClearFilters}
                    />
                  </Reveal>
                  <Reveal delay={ANIMATION_DELAYS.PAGINATION + 0.02} variant="keycap" waitForLoaders={true} as={motion.section} className="mb-8">
                    <div className="bg-card glass-card rounded-xl border border-border p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-foreground">
                          Student Attendance
                          <span className="ml-2 text-sm text-muted-foreground">
                      ({filteredStudents.length} of {studentsForSessionAll.length} students{sessionCapacity ? ` • cap ${sessionCapacity}` : ''})
                    </span>
                        </h2>
                        <div className="text-sm text-muted-foreground">
                          Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 ipad:grid-cols-2 gap-4 lg:block lg:columns-2 lg:gap-6">
                        {pagedStudents.map((student) => (
                            <div key={student.id} className="mb-0 lg:mb-4 break-inside-avoid" style={{ breakInside: 'avoid' }}>
                              <StudentAttendanceCard
                                  student={student}
                                  onAttendanceChange={handleAttendanceChange}
                                  isEditable={true}
                                  showHistory={true}
                              />
                            </div>
                        ))}
                      </div>
                      {filteredStudents.length > 0 && totalPages > 1 && (
                          <div className="mt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card glass-card rounded-xl border border-border p-3 sm:p-4">
                            <div className="order-2 lg:order-1 text-sm text-muted-foreground min-w-0">
                              Showing {pageStart + 1} to {pageEnd} of {filteredStudents.length} students
                            </div>
                            <div className="order-1 lg:order-2 w-full lg:w-auto">
                              <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} className="justify-between lg:justify-end" />
                            </div>
                          </div>
                      )}
                      {filteredStudents.length === 0 && (
                          <div className="text-center py-12 bg-card glass-card rounded-xl border border-border">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                              <Icon name="Users" size={24} className="text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">No students in this session</h3>
                            <p className="text-muted-foreground mb-4">Select another session above or adjust filters</p>
                          </div>
                      )}
                    </div>
                  </Reveal>
                </>
            )}
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
              containerClassName="px-3 ipad:px-6"
          />
        </div>
        <BulkActionsModal
            isOpen={isBulkModalOpen}
            onClose={() => setIsBulkModalOpen(false)}
            students={pagedStudents}
            onBulkUpdate={handleBulkUpdate}
            onCopyPreviousDay={() => handleCopyPreviousDay(pagedStudents)}
            canEdit={true}
            canCopyPreviousDay={true}
            selectedClass={selectedClass}
            userRole={userRole}
        />
      </div>
  );
};

const AttendanceTracking = () => {
  return (
    <ToastsProvider>
      <AttendanceTrackingInner />
      <ToastViewport position="top-right" />
    </ToastsProvider>
  );
};

export default AttendanceTracking;