// src/pages/teacher-dashboard/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import ClassOverviewCard from './components/ClassOverviewCard';
import TodaySchedulePanel from './components/TodaySchedulePanel';
import NotificationCenter from './components/NotificationCenter';
import GradeBookQuickAccess from './components/GradeBookQuickAccess';
import RecentActivityPanel from './components/RecentActivityPanel';
import QuickStatsOverview from './components/QuickStatsOverview';
import NewsPanel from '../../components/news/NewsPanel';
import NewsModal from '../../components/news/NewsModal';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import { motion } from 'framer-motion';
import Reveal from '../../components/motion/Reveal';

import { fetchStudents, fetchCourses, fetchFaculty, fetchTeacherTimetable, fetchTeacherCourseRoster } from '../../data/maisApiAdapter';
import DataLoader from '../../components/ui/DataLoader';
import { buildGradebookForTeacher } from '../../data/gradebookApiAdapter';
import { getActivities } from '../../data/activitiesApi';
import { getTeacherAttendanceSummary, getCourseAttendanceStats } from '../../data/attendanceApi';
import { maisId } from '../../utils/ids';
import { displayNameFrom } from '../../utils/displayName';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { formatLastLogin } from '../../utils/datetime';

import { createLogger } from '../../utils/logger';
import { ANIMATION_DELAYS } from '../../constants/animations';
const logger = createLogger('index');

const WEEK_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const norm = (s='') => s.toString().trim().toLowerCase();
const to12h = (hhmm='08:00') => {
  const [h,m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${String(h12).padStart(2,'0')}:${String(m || 0).padStart(2,'0')} ${ampm}`;
};
const asYear = (periodSk='') => {
  const m = String(periodSk).match(/(\d+)\.\s*rok/i);
  return m ? m[1] : '1';
};
const hourStart = (hhmm) => `${String(parseInt(hhmm.split(':')[0],10)).padStart(2,'0')}:00`;
const nextHour  = (hhmm) => {
  const h = (parseInt(hhmm.split(':')[0],10) + 1);
  return `${String(h).padStart(2,'0')}:00`;
};
const mapSlotToHour = (slot='09:00-10:00') => {
  const [s] = slot.split('-');
  const start = hourStart(s);
  const end = nextHour(start);
  return { start, end };
};
const todayName = () => weekdayNames[new Date().getDay()];
const isToday = (day) => norm(day) === norm(todayName());
const teacherDept = (t) => {
  if (!t || typeof t !== 'object') return '—';
  if (Array.isArray(t.departments) && t.departments.length) return t.departments[0];
  if (t.department) return t.department;
  if (t.primaryDepartment) return t.primaryDepartment;
  return '—';
};
const H = (s) => { let h=2166136261>>>0; const x=String(s||''); for (let i=0;i<x.length;i++){ h^=x.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };

const resolveTeacherFromLists = (facultyList = [], userEmail = '') => {
  const mail = String(userEmail || '').trim();
  if (mail) {
    const t = facultyList.find(f => norm(f.email) === norm(mail));
    if (t) return t;
  }
  return facultyList[0] || null;
};

const lessonsForTeacher = (tt = []) => tt || [];

const courseOfLocal = (row, coursesList=[]) => {
  const code = row?.courseCode || row?.code || '';
  return (coursesList || []).find(c => String(c.code) === String(code)) || null;
};
const subjectOf = (row, coursesList=[]) => {
  const c = courseOfLocal(row, coursesList);
  return c?.nameEn || c?.nameSk || row?.courseCode || 'Course';
};
const gradeTextOf = (row, coursesList=[]) => {
  const c = courseOfLocal(row, coursesList);
  return `Year ${asYear(c?.periodSk || '')}`;
};
const timeOf = (row) => {
  if (row.slot) return mapSlotToHour(row.slot);
  const start = row.time ? hourStart(row.time) : '08:00';
  const end = row.endTime || nextHour(start);
  return { start, end };
};

const normalizeGroupKey = (raw) => {
  if (!raw && raw !== 0) return '';
  const s = String(raw).toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
  const m = s.match(/^(\d{1,2})-?sk$/) || s.match(/^sk-?(\d{1,2})$/) || s.match(/^(\d{1,2})$/);
  if (!m) return '';
  const n = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${n}-sk`;
};
const groupLabel = (k) => {
  const m = String(k || '').match(/(\d{1,2})/);
  if (!m) return String(k || '');
  const n = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${n}. sk`;
};

const extractYear = (s={}) => {
  const raw = s['year'] ?? s['studyYear'] ?? s['grade'] ?? s['classYear'] ?? s['level'] ?? '';
  const m = String(raw).match(/(\d+)/);
  return m ? String(m[1]) : '';
};

const extractCourseCodesFromStudent = (s={}) => {
  const bag = new Set();
  const pushCode = (c) => {
    const code = (c && typeof c === 'object') ? (c['code'] || c['courseCode'] || c['id']) : c;
    if (!code) return;
    bag.add(String(code).toUpperCase());
  };
  const arrs = [
    s['courseCodes'],
    s['courses'],
    s['enrolledCourses'],
    s['subjects'],
    s['plan'],
    s['enrollments'],
    s['schedule']
  ].filter(Boolean);
  arrs.forEach(a => {
    if (Array.isArray(a)) a.forEach(v => pushCode(v));
    else if (typeof a === 'object') Object.values(a || {}).forEach(v => pushCode(v));
  });
  if (Array.isArray(s['grades'])) s['grades'].forEach(g => pushCode(g?.['courseCode'] || g?.['code']));
  return Array.from(bag.values());
};

const buildEnrollmentIndex = (studentsList = [], coursesList = []) => {
  const byCourse = new Map();
  const byYear   = new Map();
  const add = (map, key, val) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(val); };

  const codesPerYear = new Map();
  coursesList.forEach(c=>{
    const y = String(asYear(c?.periodSk || '1'));
    if (!codesPerYear.has(y)) codesPerYear.set(y, []);
    const code = (c?.code || c?.id || '').toString().toUpperCase();
    if (code) codesPerYear.get(y).push(code);
  });

  studentsList.forEach(s=>{
    const sid = s['id'] || s['email'] || s['code'] || JSON.stringify(s).slice(0,16);
    const year = extractYear(s);
    if (year) add(byYear, String(year), sid);

    let codes = extractCourseCodesFromStudent(s);
    if (!codes.length) {
      const pool = (year && codesPerYear.get(String(year))) || [];
      const base = pool.length ? pool : coursesList
          .map(c => (c?.code || c?.id || '').toString().toUpperCase())
          .filter(Boolean);
      const want = Math.min(4, Math.max(2, (H(s['email'] || sid) % 4)));
      const seen = new Set();
      let i=0;
      while (seen.size < Math.min(want, base.length) && i < base.length*2) {
        const pick = base[ H(`${sid}|${i}`) % base.length ];
        seen.add(pick); i++;
      }
      codes = Array.from(seen.values());
    }
    codes.forEach(code => add(byCourse, String(code).toUpperCase(), sid));
  });

  return { byCourse, byYear };
};

const buildClassesData = (timetableForTeacher, rosterCountsByEventId, coursesList = []) => {
  const lessons = lessonsForTeacher(timetableForTeacher);
  const map = new Map();

  lessons.forEach((row) => {
    const course = courseOfLocal(row, coursesList);
    const code = (course?.code || row.courseCode || '').toString().toUpperCase();
    const subjectName = subjectOf(row, coursesList);
    const yearText = gradeTextOf(row, coursesList);
    const grade = yearText.replace('Year ', '');
    const rawGroupKeys = row.classGroupKeys || row.groups || row.classGroups || [];
    const groupKeys = Array.from(new Set(rawGroupKeys.map(normalizeGroupKey).filter(Boolean)));
    // Include type in classId to differentiate between P, CL, S, etc.
    // Ensure type is always uppercase and defaults to 'CL' if missing
    const type = String(row.type || row.Type || 'CL').toUpperCase().trim() || 'CL';
    // For CL (quiz) classes, use fallback '01-sk' if no groups; for other types, create one entry without group
    const groupList = groupKeys.length ? groupKeys : (type === 'CL' ? ['01-sk'] : []);
    const baseCount = row.id && rosterCountsByEventId && Number.isFinite(rosterCountsByEventId[row.id])
      ? Math.max(0, rosterCountsByEventId[row.id] || 0)
      : 0;

    // Always create entries for all types, ensuring P and CL are separate
    if (groupList.length === 0 && type !== 'CL') {
      // For non-CL classes without groups, create one entry
      const classId = maisId('CLASS', `${code}|${grade}|nogroup|${type}`);
      if (!map.has(classId)) {
        map.set(classId, {
          id: classId,
          subject: subjectName,
          grade,
          sectionKey: null,
          section: null,
          studentCount: baseCount,
          attendanceRate: null,
          pendingGrades: null,
          nextClass: null,
          _code: code,
          _year: grade,
          _type: type,
        });
      } else {
        const existing = map.get(classId);
        existing.studentCount = Math.max(existing.studentCount || 0, baseCount);
      }
    } else {
      // For CL classes or classes with groups, create entries for each group
      groupList.forEach((gk) => {
        // Include type in classId to ensure P and CL classes are separate
        const classId = maisId('CLASS', `${code}|${grade}|${gk}|${type}`);
        if (!map.has(classId)) {
          map.set(classId, {
            id: classId,
            subject: subjectName,
            grade,
            sectionKey: gk || null,
            section: gk ? groupLabel(gk) : null,
            studentCount: baseCount,
            attendanceRate: null,
            pendingGrades: null,
            nextClass: null,
            _code: code,
            _year: grade,
            _type: type,
          });
        } else {
          const existing = map.get(classId);
          existing.studentCount = Math.max(existing.studentCount || 0, baseCount);
        }
      });
    }
  });

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  lessons
    .filter((r) => isToday(r.day))
    .forEach((r) => {
      const course = courseOfLocal(r, coursesList);
      const code = (course?.code || r.courseCode || '').toString().toUpperCase();
      const yearText = gradeTextOf(r);
      const grade = yearText.replace('Year ', '');
      const { start } = timeOf(r);
      const [h, m] = start.split(':').map(Number);
      const startMinutes = h * 60 + m;
      const rawGroupKeys = r.classGroupKeys || r.groups || r.classGroups || [];
      const groupList = Array.from(new Set(rawGroupKeys.map(normalizeGroupKey).filter(Boolean)));
      // Ensure type is always uppercase and defaults to 'CL' if missing
      const type = String(r.type || r.Type || 'CL').toUpperCase().trim() || 'CL';
      const finalGroups = groupList.length ? groupList : (type === 'CL' ? ['01-sk'] : []);
      
      if (finalGroups.length === 0 && type !== 'CL') {
        // For non-CL classes without groups, use 'nogroup' as identifier
        const cid = maisId('CLASS', `${code}|${grade}|nogroup|${type}`);
        const entry = map.get(cid);
        if (entry && startMinutes >= nowMinutes) {
          if (!entry.nextClass || startMinutes < entry.nextClass._m) {
            entry.nextClass = { time: to12h(start), room: r.room || '', _m: startMinutes };
          }
        }
      } else {
        finalGroups.forEach((gk) => {
          // Include type in classId to match the classId used above
          const cid = maisId('CLASS', `${code}|${grade}|${gk}|${type}`);
          const entry = map.get(cid);
          if (entry && startMinutes >= nowMinutes) {
            if (!entry.nextClass || startMinutes < entry.nextClass._m) {
              entry.nextClass = { time: to12h(start), room: r.room || '', _m: startMinutes };
            }
          }
        });
      }
    });

  // Debug: log all created classes
  // logger.debug('buildClassesData - created classes:', Array.from(map.values()).map(c => ({ subject: c.subject, type: c._type, section: c.section })));

  return Array.from(map.values());
};

const buildTodaySchedule = (timetableForTeacher, coursesList=[]) => {
  const L = lessonsForTeacher(timetableForTeacher);
  const byDay = (day) => L.filter(r => norm(r.day) === norm(day));
  // Only show classes for today - don't fallback to other days
  const list = byDay(todayName());
  // Include type in the schedule to differentiate P, CL, S, etc.
  // This ensures all class types are counted separately
  return list
      .map(row => {
        const { start, end } = timeOf(row);
        const type = String(row.type || row.Type || 'CL').toUpperCase().trim() || 'CL';
        return {
          subject: subjectOf(row, coursesList),
          grade: gradeTextOf(row, coursesList).replace('Year ', ''),
          startTime: start,
          endTime: end,
          room: row.room || '',
          type: type, // Include type to differentiate classes
          _uniqueKey: `${subjectOf(row, coursesList)}|${start}|${type}`, // Unique key for deduplication by type
        };
      })
      // Remove duplicates based on unique key (same subject, time, and type)
      .filter((item, index, self) => 
        index === self.findIndex((t) => t._uniqueKey === item._uniqueKey)
      )
      .sort((a,b) => a.startTime.localeCompare(b.startTime));
};

const buildGradeBookData = () => ({
  totalAssignments: 0,
  pendingGrades: 0,
  averageGrade: 0,
  recentAssignments: [],
  gradeDistribution: [
    { range: 'A (90-100%)', count: 0, percentage: 0 },
    { range: 'B (80-89%)', count: 0, percentage: 0 },
    { range: 'C (70-79%)', count: 0, percentage: 0 },
    { range: 'D (60-69%)', count: 0, percentage: 0 },
    { range: 'F (<60%)', count: 0, percentage: 0 },
  ],
  missingAssignments: 0,
});

const makeNotification = (base) => ({
  id: '',
  category: 'messages',
  type: 'info',
  title: '',
  message: '',
  time: new Date(),
  unread: false,
  priority: 'low',
  actionRequired: false,
  actionText: '',
  href: '',
  ...base
});

const synthNotifications = () => ([]);

const synthActivities = () => ([]);

const buildQuickStats = ({ totalStudents = null, classesToday = null, pendingGrades = null, attendanceRate = null, averageGrade = null }) => ({
  totalStudents: Number.isFinite(totalStudents) && totalStudents > 0 ? totalStudents : null,
  classesToday: Number.isFinite(classesToday) ? classesToday : null,  // Allow 0
  pendingGrades: Number.isFinite(pendingGrades) ? pendingGrades : null,  // Allow 0
  attendanceRate: Number.isFinite(attendanceRate) && attendanceRate > 0 ? Math.round(attendanceRate) : null,
  averageGrade: Number.isFinite(averageGrade) && averageGrade > 0 ? Math.round(averageGrade) : null,
  studentChange: null,
  gradeChange: null,
  attendanceChange: null
});

const splitGradeKey = (key) => {
  const k = String(key || '');
  const sep = '::';
  const pos = k.indexOf(sep);
  if (pos >= 0) return [k.slice(0, pos), k.slice(pos + sep.length)];
  const up = k.toUpperCase();
  const idxAsg = up.lastIndexOf('ASG-');
  if (idxAsg > 0) {
    const dashBefore = k[idxAsg - 1] === '-' ? idxAsg - 1 : idxAsg;
    const sid = k.slice(0, dashBefore);
    const aid = k.slice(dashBefore + 1);
    return [sid, aid];
  }
  const m = k.match(/^(.*?)-(\w{2,}|[0-9a-f-]{4,})$/i);
  if (m) return [m[1], m[2]];
  const last = k.lastIndexOf('-');
  if (last > 0) return [k.slice(0, last), k.slice(last + 1)];
  return [k, ''];
};

const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return num;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    // try yyyy-MM-dd manually
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
  return new Date(ts);
};

const formatDateShort = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const percentageFromGrade = (grade, assignment) => {
  const totalPoints = Number(assignment?.totalPoints ?? assignment?.TotalPoints ?? 0) || 0;
  let pct = Number(grade?.percentage ?? grade?.Percentage ?? 0) || 0;
  if ((!pct || pct <= 0) && totalPoints > 0) {
    const points = Number(grade?.points ?? grade?.Points ?? 0) || 0;
    if (totalPoints > 0) pct = (points / totalPoints) * 100;
  }
  return clampPercent(Math.round(pct));
};

const detectSectionKey = (students = []) => {
  const set = new Set();
  (students || []).forEach((s) => {
    const raw = s?.sectionKey || s?.groupKey || s?.section || '';
    const normalized = normalizeGroupKey(raw);
    if (normalized) set.add(normalized);
  });
  if (set.size === 1) return Array.from(set)[0];
  return '';
};

const dayIndexOf = (day) => {
  const idx = weekdayNames.findIndex((d) => norm(d) === norm(day || ''));
  return idx >= 0 ? idx : 0;
};

const computeNextClassForCourse = (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const now = new Date();
  const nowDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best = null;

  entries.forEach((entry) => {
    const { start } = timeOf(entry);
    const startParts = String(start || '08:00').split(':').map((v) => parseInt(v, 10));
    const startMinutes = (startParts[0] || 0) * 60 + (startParts[1] || 0);
    const entryDay = dayIndexOf(entry.day || entry.Day);
    let diffDays = (entryDay - nowDay + 7) % 7;
    let minutesAway = diffDays * 24 * 60 + (startMinutes - nowMinutes);
    if (minutesAway < 0) minutesAway += 7 * 24 * 60;
    if (!best || minutesAway < best.offset) {
      best = {
        offset: minutesAway,
        time: to12h(start || '08:00'),
        room: entry.room || entry.Room || '',
      };
    }
  });

  if (!best) return null;
  return { time: best.time, room: best.room };
};

const buildGradebookSummary = (gradebook, timetableEntries = [], coursesList = [], attendanceSummary = null) => {
  // Build attendance map from real API data
  const attendanceByCourse = new Map();
  if (attendanceSummary && Array.isArray(attendanceSummary.byCourse)) {
    attendanceSummary.byCourse.forEach(c => {
      const code = String(c.courseCode || '').toUpperCase();
      if (code) attendanceByCourse.set(code, c.attendanceRate ?? 0);
    });
  }
  const overallAttendanceRate = attendanceSummary?.overallRate ?? null;

  if (!gradebook) {
    return {
      classes: [],
      gradeBook: {
        totalAssignments: 0,
        pendingGrades: 0,
        averageGrade: 0,
        recentAssignments: [],
        gradeDistribution: [
          { range: 'A (90-100%)', count: 0, percentage: 0 },
          { range: 'B (80-89%)', count: 0, percentage: 0 },
          { range: 'C (70-79%)', count: 0, percentage: 0 },
          { range: 'D (60-69%)', count: 0, percentage: 0 },
          { range: 'F (<60%)', count: 0, percentage: 0 },
        ],
        missingAssignments: 0,
      },
      totalStudents: 0,
      attendanceAverage: overallAttendanceRate ?? 0,
      activities: [],
      notifications: [],
    };
  }

  const courseMap = new Map((coursesList || []).map((c) => [String(c?.code || c?.Code || '').toUpperCase(), c]));
  const classStudentsRaw = gradebook.classStudents;
  const classStudentsMap = classStudentsRaw instanceof Map
    ? classStudentsRaw
    : new Map(Array.isArray(classStudentsRaw)
      ? classStudentsRaw
      : Object.entries(classStudentsRaw || {}));

  const classesRaw = Array.isArray(gradebook.classes) ? gradebook.classes : [];
  const classById = new Map();
  classesRaw.forEach((cls) => {
    const id = cls?.id || cls?.Id;
    if (!id) return;
    const code = String(cls?.code || cls?.Code || '').toUpperCase();
    const name = cls?.name || cls?.Name || cls?.subject || cls?.Subject || code;
    const grade = cls?.grade || cls?.Grade || '';
    const sessions = Array.isArray(cls?.sessions)
      ? cls.sessions
      : Array.isArray(cls?.Sessions)
        ? cls.Sessions
        : [];
    classById.set(id, {
      id,
      code,
      name,
      grade,
      sessions,
    });
  });

  const assignmentsRaw = Array.isArray(gradebook.assignments) ? gradebook.assignments : [];
  const assignments = assignmentsRaw.map((a) => ({
    ...a,
    id: a?.id || maisId('asg', `${a?.classId ?? ''}|${a?.name ?? ''}|${a?.dueDate ?? ''}`),
  }));
  const assignmentsById = new Map(assignments.map((a) => [a.id, a]));

  const gradesRaw = Array.isArray(gradebook.gradeRecords) ? gradebook.gradeRecords : [];
  const normalizedGrades = gradesRaw.map((g) => ({
    studentId: g?.studentId || g?.StudentId || '',
    assignmentId: g?.assignmentId || g?.AssignmentId || '',
    points: Number(g?.points ?? g?.Points ?? 0) || 0,
    percentage: Number(g?.percentage ?? g?.Percentage ?? 0) || 0,
    letterGrade: g?.letterGrade || g?.LetterGrade || '',
    lastUpdated: g?.lastUpdated || g?.LastUpdated || '',
  }));

  const finalGradeRaw = Array.isArray(gradebook.finalGrades) ? gradebook.finalGrades : [];
  const finalGrades = finalGradeRaw.map((g) => ({
    studentId: g?.studentId || g?.StudentId || '',
    continuousPoints: Number(g?.continuousPoints ?? g?.ContinuousPoints ?? 0) || 0,
    examPoints: Number(g?.examPoints ?? g?.ExamPoints ?? 0) || 0,
    totalPoints: Number(g?.totalPoints ?? g?.TotalPoints ?? 0) || 0,
    continuousPercent: Number(g?.continuousPercent ?? g?.ContinuousPercent ?? 0) || 0,
    examPercent: Number(g?.examPercent ?? g?.ExamPercent ?? 0) || 0,
    totalPercent: Number(g?.totalPercent ?? g?.TotalPercent ?? 0) || 0,
    letterGrade: (g?.letterGrade || g?.LetterGrade || '').trim(),
    lastUpdated: g?.lastUpdated || g?.LastUpdated || '',
  }));

  if (!normalizedGrades.length && gradebook.grades) {
    Object.entries(gradebook.grades).forEach(([key, value]) => {
      const [studentId, assignmentId] = splitGradeKey(key);
      normalizedGrades.push({
        studentId,
        assignmentId,
        points: Number(value?.points ?? 0) || 0,
        percentage: Number(value?.percentage ?? 0) || 0,
        letterGrade: value?.letterGrade || '',
        lastUpdated: value?.lastUpdated || '',
      });
    });
  }

  const gradesByAssignment = new Map();
  normalizedGrades.forEach((g) => {
    if (!g.assignmentId) return;
    if (!gradesByAssignment.has(g.assignmentId)) gradesByAssignment.set(g.assignmentId, []);
    gradesByAssignment.get(g.assignmentId).push(g);
  });

  const timetableByCourse = new Map();
  (timetableEntries || []).forEach((entry) => {
    const code = String(entry?.courseCode || entry?.CourseCode || '').toUpperCase();
    if (!code) return;
    if (!timetableByCourse.has(code)) timetableByCourse.set(code, []);
    timetableByCourse.get(code).push(entry);
  });

  const assignmentDetails = [];
  const classStats = new Map();
  const gradePercentages = [];

  assignments.forEach((assignment) => {
    const classId = assignment.classId || assignment.ClassId || '';
    const classInfo = classById.get(classId) || null;
    const students = classStudentsMap.get(classId) || [];
    const totalStudents = Array.isArray(students) ? students.length : 0;
    const gradeEntries = gradesByAssignment.get(assignment.id) || [];
    const gradedCount = gradeEntries.length;
    const pending = Math.max(0, totalStudents - gradedCount);
    const dueDateObj = parseDateSafe(assignment.dueDate || assignment.DueDate || null);
    const subject = classInfo?.name || classInfo?.subject || assignment.name || assignment.Name || assignment.courseCode || assignment.CourseCode || 'Assignment';
    gradeEntries.forEach((entry) => {
      const pct = percentageFromGrade(entry, assignment);
      gradePercentages.push(pct);
    });

    if (!classStats.has(classId)) {
      classStats.set(classId, {
        totalStudents,
        pendingGrades: 0,
        gradedSubmissions: 0,
        totalSubmissions: 0,
        assignments: [],
      });
    }
    const stats = classStats.get(classId);
    if (totalStudents > stats.totalStudents) stats.totalStudents = totalStudents;
    stats.pendingGrades += pending;
    stats.gradedSubmissions += gradedCount;
    stats.totalSubmissions += totalStudents;
    stats.assignments.push({ assignmentId: assignment.id, gradedCount, totalSubmissions: totalStudents, pending });

    assignmentDetails.push({
      id: assignment.id,
      title: assignment.name || assignment.Name || 'Assignment',
      subject,
      dueDate: formatDateShort(dueDateObj),
      dueDateDate: dueDateObj,
      gradedCount,
      totalSubmissions: totalStudents,
      classId,
      courseCode: classInfo?.code || assignment.courseCode || assignment.CourseCode || '',
      pending,
      sectionKey: detectSectionKey(students),
    });
  });

  const gradeDistributionBuckets = [
    { label: 'A (90-100%)', min: 90, max: 100 },
    { label: 'B (80-89%)', min: 80, max: 89 },
    { label: 'C (70-79%)', min: 70, max: 79 },
    { label: 'D (60-69%)', min: 60, max: 69 },
    { label: 'F (<60%)', min: 0, max: 59 },
  ];

  const gradeDistribution = gradeDistributionBuckets.map((bucket) => ({ range: bucket.label, count: 0, percentage: 0 }));
  const distributionSamples = finalGrades.length
    ? finalGrades.map((g) => {
        if (Number.isFinite(g.totalPercent)) return clampPercent(Math.round(g.totalPercent));
        const letter = String(g.letterGrade || '').toUpperCase();
        switch (letter) {
          case 'A': return 95;
          case 'B': return 85;
          case 'C': return 75;
          case 'D': return 65;
          case 'E': return 55;
          case 'FX':
          case 'F': return 40;
          default: return 0;
        }
      })
    : gradePercentages;
  distributionSamples.forEach((pct) => {
    for (let i = 0; i < gradeDistributionBuckets.length; i += 1) {
      const bucket = gradeDistributionBuckets[i];
      const within = bucket.label.startsWith('F') ? pct < 60 : pct >= bucket.min && pct <= bucket.max;
      if (within) {
        gradeDistribution[i].count += 1;
        break;
      }
    }
  });
  const totalGradeEntries = distributionSamples.length || 1;
  gradeDistribution.forEach((bucket) => {
    bucket.percentage = Math.round((bucket.count / totalGradeEntries) * 100);
  });

  const totalPendingGrades = assignmentDetails.reduce((sum, item) => sum + Math.max(0, item.pending), 0);
  const totalAssignments = assignments.length;
  const averageGrade = distributionSamples.length
    ? Math.round(distributionSamples.reduce((a, b) => a + b, 0) / distributionSamples.length)
    : 0;
  const missingAssignments = assignmentDetails.filter((a) => a.pending > 0).length;

  const classes = [];
  const totalStudentIds = new Set();
  const attendanceRates = [];

  classById.forEach((cls) => {
    const students = classStudentsMap.get(cls.id) || [];
    students.forEach((s) => {
      if (s?.id) totalStudentIds.add(s.id);
    });
    const stats = classStats.get(cls.id);
    const totalStudents = stats?.totalStudents ?? (Array.isArray(students) ? students.length : 0) ?? 0;
    const sectionKey = detectSectionKey(students);
    const courseEntries = timetableByCourse.get(cls.code) || [];
    const nextClass = computeNextClassForCourse(courseEntries);
    // Use real attendance data from API if available, otherwise show 0 (no data)
    const courseCodeUpper = String(cls.code || '').toUpperCase();
    const attendanceRate = attendanceByCourse.has(courseCodeUpper)
      ? clampPercent(Math.round(attendanceByCourse.get(courseCodeUpper)))
      : (overallAttendanceRate !== null ? clampPercent(Math.round(overallAttendanceRate)) : 0);
    attendanceRates.push(attendanceRate);

    classes.push({
      id: cls.id,
      subject: cls.name,
      grade: asYear(courseMap.get(cls.code)?.periodSk || cls.grade || '1'),
      sectionKey,
      section: sectionKey ? groupLabel(sectionKey) : '',
      studentCount: totalStudents,
      pendingGrades: stats?.pendingGrades || 0,
      attendanceRate,
      nextClass,
      _code: cls.code,
    });
  });

  // Only include assignments with real due dates and valid data
  const recentAssignments = assignmentDetails
    .filter((a) => {
      // Only include if it has a valid due date and is not a placeholder
      if (!a.dueDateDate || !Number.isFinite(a.dueDateDate.getTime())) return false;
      // Only include if it has real submission data
      if (!Number.isFinite(a.totalSubmissions) || a.totalSubmissions <= 0) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const aTime = a.dueDateDate ? a.dueDateDate.getTime() : 0;
      const bTime = b.dueDateDate ? b.dueDateDate.getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  const now = new Date();
  // Only consider assignments with real data
  const validAssignments = assignmentDetails.filter((a) => {
    if (!a.dueDateDate || !Number.isFinite(a.dueDateDate.getTime())) return false;
    if (!Number.isFinite(a.totalSubmissions) || a.totalSubmissions <= 0) return false;
    return true;
  });
  const overdueAssignments = validAssignments.filter((a) => a.pending > 0 && a.dueDateDate && a.dueDateDate.getTime() < now.getTime());
  const dueSoonAssignments = validAssignments
    .filter((a) => a.pending > 0 && a.dueDateDate && a.dueDateDate.getTime() >= now.getTime())
    .sort((a, b) => (a.dueDateDate?.getTime() || Infinity) - (b.dueDateDate?.getTime() || Infinity));

  const notifications = [];
  if (totalPendingGrades > 0) {
    notifications.push({
      id: 'notif-pending-grades',
      category: 'grades',
      type: 'warning',
      title: 'Pending grading tasks',
      message: `${totalPendingGrades} submissions need grading across ${totalAssignments} assignment${totalAssignments === 1 ? '' : 's'}.`,
      time: new Date().toISOString(),
      unread: true,
      priority: 'high',
      actionRequired: true,
      actionText: 'Review grades',
      href: '/grade-management',
    });
  }
  if (overdueAssignments.length) {
    const mostOverdue = overdueAssignments.sort((a, b) => (a.dueDateDate?.getTime() || 0) - (b.dueDateDate?.getTime() || 0))[0];
    notifications.push({
      id: 'notif-overdue-assignment',
      category: 'alerts',
      type: 'warning',
      title: 'Overdue assignment needs attention',
      message: `${mostOverdue.title} is overdue with ${mostOverdue.pending} pending submission${mostOverdue.pending === 1 ? '' : 's'}.`,
      time: new Date().toISOString(),
      unread: true,
      priority: 'high',
      actionRequired: true,
      actionText: 'Open gradebook',
      href: '/grade-management',
    });
  }
  if (dueSoonAssignments.length) {
    const nextDue = dueSoonAssignments[0];
    notifications.push({
      id: 'notif-upcoming-assignment',
      category: 'announcements',
      type: 'info',
      title: 'Upcoming assignment deadline',
      message: `${nextDue.title} is due ${nextDue.dueDate}${nextDue.pending ? ` • ${nextDue.pending} pending` : ''}.`,
      time: new Date().toISOString(),
      unread: true,
      priority: 'medium',
      actionRequired: nextDue.pending > 0,
      actionText: nextDue.pending > 0 ? 'Grade submissions' : 'View assignment',
      href: '/grade-management',
    });
  }

  const activities = [];
  const latestGrade = normalizedGrades
    .slice()
    .sort((a, b) => (Date.parse(b.lastUpdated || '') || 0) - (Date.parse(a.lastUpdated || '') || 0))[0];
  if (latestGrade && assignmentsById.has(latestGrade.assignmentId)) {
    const assignment = assignmentsById.get(latestGrade.assignmentId);
    activities.push({
      id: `act-grade-${latestGrade.assignmentId}-${latestGrade.studentId}`,
      type: 'submissions',
      title: `Graded ${assignment.name}`,
      description: `${assignment.name} updated`,
      timestamp: latestGrade.lastUpdated || new Date().toISOString(),
      requiresAction: false,
      assignmentId: latestGrade.assignmentId,
    });
  }
  if (dueSoonAssignments.length) {
    const nextDue = dueSoonAssignments[0];
    activities.push({
      id: `act-due-${nextDue.id}`,
      type: 'announcement',
      title: `Upcoming due: ${nextDue.title}`,
      description: `${nextDue.subject} • Due ${nextDue.dueDate}`,
      timestamp: nextDue.dueDateDate ? nextDue.dueDateDate.toISOString() : new Date().toISOString(),
      requiresAction: nextDue.pending > 0,
      assignmentId: nextDue.id,
    });
  }

  return {
    classes,
    gradeBook: {
      totalAssignments,
      pendingGrades: totalPendingGrades,
      averageGrade,
      recentAssignments,
      gradeDistribution,
      missingAssignments,
    },
    totalStudents: totalStudentIds.size,
    attendanceAverage: overallAttendanceRate !== null 
      ? Math.round(overallAttendanceRate) 
      : (attendanceRates.length
        ? Math.round(attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length)
        : 0),
    activities,
    notifications,
  };
};

const TeacherDashboardPage = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [newsRefreshTrigger, setNewsRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const { notify } = useToasts();
  const { isBlocked } = useGlobalLoaderBlocking();
  const toastGuards = useRef({});
  const myClassesRef = useRef(null);
  
  const guardedNotify = useCallback(
    (key, payload) => {
      if (key) {
        const now = Date.now();
        const lockMs = payload?.lockMs ?? 3200;
        const prev = toastGuards.current[key] ?? 0;
        if (now - prev < lockMs) return;
        toastGuards.current[key] = now;
      }
      if (typeof payload === 'function') notify(payload());
      else notify(payload);
    },
    [notify]
  );

  useEffect(() => {
    const t = setInterval(()=>setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Scroll to My Classes section
  const scrollToMyClasses = useCallback(() => {
    if (myClassesRef.current) {
      myClassesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const { user } = useAuth();
  const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
  const [facultyList, setFacultyList] = useState([]);
  const [studentsList, setStudentsList] = useState([]); // legacy; not used for counts anymore
  const [coursesList, setCoursesList] = useState([]);
  const [rosterCounts, setRosterCounts] = useState({});
  const [timetableForTeacher, setTimetableForTeacher] = useState([]);
  const [totalStudentsCount, setTotalStudentsCount] = useState(null);
  const [activities, setActivities] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null); // Real attendance from API
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTimetable, setLoadingTimetable] = useState(true);
  const [loadingGradebook, setLoadingGradebook] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const isLoading = loadingSummary || loadingTimetable || loadingGradebook || loadingActivities;

  useEffect(() => {
    let mounted = true;
    setLoadingSummary(true);
    (async () => {
      try {
        const [fac, stu, crs, studentsTotal] = await Promise.all([
          fetchFaculty({ page: 1, pageSize: 200, sort: 'fullName', order: 'asc' }),
          fetchStudents({ page: 1, pageSize: 400, sort: 'fullName', order: 'asc' }),
          fetchCourses(),
          fetchStudents({ page: 1, pageSize: 1 }, { includeTotal: true }),
        ]);
        if (!mounted) return;
        setFacultyList(fac || []);
        setStudentsList(stu || []);
        setCoursesList(crs || []);
        // Extract total students count from API response
        if (studentsTotal && typeof studentsTotal === 'object' && 'total' in studentsTotal) {
          setTotalStudentsCount(Number.isFinite(studentsTotal.total) ? studentsTotal.total : null);
        } else {
          setTotalStudentsCount(null);
        }
      } catch (err) {
        if (mounted) {
          guardedNotify('teacher-summary-load', { title: 'Network error', description: 'Unable to load faculty or courses.', variant: 'error', lockMs: 5000 });
          setFacultyList([]);
          setStudentsList([]);
          setCoursesList([]);
          setTotalStudentsCount(null);
        }
      } finally {
        if (mounted) setLoadingSummary(false);
      }
    })();
    return () => { mounted = false; };
  }, []); // Empty deps - load once on mount

  // Load activities
  useEffect(() => {
    let mounted = true;
    setLoadingActivities(true);
    (async () => {
      try {
        const response = await getActivities({ 
          sort: 'time', 
          dir: 'desc', 
          page: 1, 
          perPage: 20 
        });
        if (!mounted) return;
        const items = response?.items || response?.activities || [];
        logger.debug('[teacher-dashboard] Activities loaded:', items.length);
        setActivities(Array.isArray(items) ? items : []);
      } catch (err) {
        logger.error('[teacher-dashboard] Failed to load activities:', err);
        if (mounted) {
          setActivities([]);
          guardedNotify('teacher-activities-load', { 
            title: 'Activities unavailable', 
            description: 'Unable to load recent activities.', 
            variant: 'error', 
            lockMs: 5000 
          });
        }
      } finally {
        if (mounted) setLoadingActivities(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingTimetable(true);
    (async () => {
      try {
        const mail = String(user?.email || '').toLowerCase();
        if (!mail) {
          if (mounted) {
            setTimetableForTeacher([]);
            setRosterCounts({});
          }
          return;
        }
        const tt = await fetchTeacherTimetable(mail);
        if (!mounted) return;
        setTimetableForTeacher(tt || []);
        // After timetable is available, fetch roster per distinct course to build counts by schedule event id
        const codes = Array.from(new Set((tt || []).map(r => r.courseCode).filter(Boolean)));
        const counts = {};
        for (const code of codes) {
          const { entries, roster } = await fetchTeacherCourseRoster(mail, code);
          const byEvent = new Map();
          (entries || []).forEach(e => { if (e?.id) byEvent.set(String(e.id), new Set()); });
          // Count unique students per event (not just roster entries, as one student can have multiple enrollments)
          // Use PersonId if available, otherwise fall back to studentId
          logger.debug(`[teacher-dashboard] Processing roster for course ${code}:`, {
            entriesCount: entries?.length || 0,
            rosterCount: roster?.length || 0,
            roster: roster
          });
          (roster || []).forEach(r => {
            const evId = String(r.scheduleEventId || '');
            if (!evId) return;
            // Try to use PersonId first (to handle students with multiple records like kb079if-bc and kb079if-ing)
            const personId = String(r.personId || r.PersonId || '').trim();
            const studentId = String(r.studentId || '').trim();
            const uniqueKey = personId || studentId;
            if (!uniqueKey) return;
            const studentSet = byEvent.get(evId);
            if (studentSet) {
              studentSet.add(uniqueKey);
              logger.debug(`[teacher-dashboard] Added student to event ${evId}:`, { personId, studentId, uniqueKey, currentCount: studentSet.size });
            }
          });
          // Convert Sets to counts
          byEvent.forEach((studentSet, k) => { 
            counts[k] = studentSet.size;
            logger.debug(`[teacher-dashboard] Final count for event ${k}:`, counts[k], 'students:', Array.from(studentSet));
          });
        }
        if (mounted) setRosterCounts(counts);
      } catch {
        if (mounted) {
          setTimetableForTeacher([]);
          setRosterCounts({});
          guardedNotify('teacher-timetable-load', { title: 'Timetable unavailable', description: 'Unable to refresh schedule data right now.', variant: 'error', lockMs: 5000 });
        }
      } finally {
        if (mounted) setLoadingTimetable(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.email]);

  // Listen for data updates via SignalR
  const handleDataUpdate = useCallback((payload) => {
    if (!payload?.type) return;
    
    logger.debug('[teacher-dashboard] Data update received', payload);
    
    // Reload activities on activity updates
    if (payload.type === 'activity_created' || 
        payload.type === 'activity.updated' ||
        payload.type === 'ActivityCreated' ||
        payload.type === 'ActivityUpdated' ||
        payload.type?.toLowerCase().includes('activity')) {
      logger.debug('[teacher-dashboard] Reloading activities due to:', payload.type);
      (async () => {
        try {
          const response = await getActivities({ 
            sort: 'time', 
            dir: 'desc', 
            page: 1, 
            perPage: 20 
          });
          const items = response?.items || response?.activities || [];
          logger.debug('[teacher-dashboard] Activities reloaded:', items.length);
          setActivities(Array.isArray(items) ? items : []);
        } catch (err) {
          logger.error('[teacher-dashboard] Failed to reload activities:', err);
        }
      })();
    }
    
    // Reload data on updates
    if (payload.type === 'schedule.updated' || 
        payload.type === 'enrollment.updated' || 
        payload.type === 'assignment.updated') {
      // Reload timetable and summary
      (async () => {
        try {
          const mail = String(user?.email || '').toLowerCase();
          if (!mail) return;
          
          const [stu, crs, studentsTotal, tt] = await Promise.all([
            fetchStudents({ page: 1, pageSize: 400, sort: 'fullName', order: 'asc' }),
            fetchCourses(),
            fetchStudents({ page: 1, pageSize: 1 }, { includeTotal: true }),
            fetchTeacherTimetable(mail),
          ]);
          
          // Don't reload faculty - it doesn't change frequently
          setStudentsList(stu || []);
          setCoursesList(crs || []);
          if (studentsTotal && typeof studentsTotal === 'object' && 'total' in studentsTotal) {
            setTotalStudentsCount(Number.isFinite(studentsTotal.total) ? studentsTotal.total : null);
          }
          setTimetableForTeacher(tt || []);
          
          // Reload roster counts
          const codes = Array.from(new Set((tt || []).map(r => r.courseCode).filter(Boolean)));
          const counts = {};
          for (const code of codes) {
            const { entries, roster } = await fetchTeacherCourseRoster(mail, code);
            const byEvent = new Map();
            (entries || []).forEach(e => { if (e?.id) byEvent.set(String(e.id), new Set()); });
            (roster || []).forEach(r => {
              const evId = String(r.scheduleEventId || '');
              if (!evId) return;
              const personId = String(r.personId || r.PersonId || '').trim();
              const studentId = String(r.studentId || '').trim();
              const uniqueKey = personId || studentId;
              if (!uniqueKey) return;
              const studentSet = byEvent.get(evId);
              if (studentSet) {
                studentSet.add(uniqueKey);
              }
            });
            byEvent.forEach((studentSet, k) => { counts[k] = studentSet.size; });
          }
          setRosterCounts(counts);
        } catch {
          // Ignore errors
        }
      })();
    }
  }, [user?.email]);

  useDataUpdates(handleDataUpdate);

  useEffect(() => {
    if (!isLoading) {
      // Mark as complete only once, never reset
      if (!initialLoadComplete) {
        setInitialLoadComplete(true);
      }
    }
  }, [isLoading, initialLoadComplete]);

  const teacher = useMemo(() => resolveTeacherFromLists(facultyList, user?.email || ''), [facultyList, user?.email]);
  const baseTeacherName = useMemo(
      () => displayNameFrom(teacher || {}, { privacy: false }),
      [teacher]
  );
  const liveName = useProfileDisplayName(baseTeacherName);

  const teacherDisplayName = useMemo(() => {
    // Use only API data, no static fallbacks
    const candidates = [
      liveName,
      baseTeacherName,
      teacher?.fullName,
      teacher?.full_name,
      teacher?.name,
      user?.full_name,
    ];
    const pretty = candidates.find((val) => val && !String(val).includes('@'));
    return pretty || user?.email || 'Teacher';
  }, [liveName, baseTeacherName, teacher, user]);

  const teacherInfo = useMemo(() => ({
      name: teacherDisplayName,
      role: 'teacher',
    employeeId: teacher?.employeeId || teacher?.id || '—',
      department: teacherDept(teacher),
  }), [teacher, teacherDisplayName]);

  const [gradebookPayload, setGradebookPayload] = useState(null);

  useEffect(() => {
    let active = true;
    const emailLower = String(user?.email || '').toLowerCase();
    if (!emailLower) {
      setGradebookPayload(null);
      setLoadingGradebook(false);
      return () => { active = false; };
    }
    setLoadingGradebook(true);
    (async () => {
      try {
        const [gb, attSummary] = await Promise.all([
          buildGradebookForTeacher(emailLower),
          getTeacherAttendanceSummary(emailLower).catch(() => null)
        ]);
        if (!active) return;
        setGradebookPayload(gb);
        setAttendanceSummary(attSummary);
      } catch {
        if (!active) return;
        setGradebookPayload(null);
        setAttendanceSummary(null);
        guardedNotify('teacher-gradebook-sync', { title: 'Gradebook sync failed', description: 'Unable to refresh grades right now.', variant: 'error', lockMs: 5000 });
      } finally {
        if (active) setLoadingGradebook(false);
      }
    })();
    return () => { active = false; };
  }, [user?.email, notify]);

  const gradebookSummary = useMemo(
      () => buildGradebookSummary(gradebookPayload, timetableForTeacher, coursesList, attendanceSummary),
      [gradebookPayload, timetableForTeacher, coursesList, attendanceSummary]
  );

  const legacyClasses = useMemo(
      () => buildClassesData(timetableForTeacher, rosterCounts, coursesList),
      [timetableForTeacher, rosterCounts, coursesList]
  );

  // Always use legacyClasses (from buildClassesData) as it properly handles all class types (P, CL, S, etc.)
  // gradebookSummary.classes may not include all types or may be incomplete
  // Filter to show only CL (Class/Lab) types in "My Classes" - these are the classes with groups that can be graded
  const classesData = legacyClasses.filter(c => {
    const type = String(c?._type || '').toUpperCase().trim();
    return type === 'CL';
  });
  const todaySchedule = useMemo(
      () => buildTodaySchedule(timetableForTeacher, coursesList),
      [timetableForTeacher, coursesList]
  );

  const gradeBookData = useMemo(() => {
    if (gradebookSummary.gradeBook && typeof gradebookSummary.gradeBook.totalAssignments === 'number') {
      return gradebookSummary.gradeBook;
    }
    return buildGradeBookData();
  }, [gradebookSummary.gradeBook]);

  const totalStudentsGlobal = useMemo(() => {
    // Priority: 1) gradebook total, 2) API total count, 3) sum from classes
    if (gradebookSummary.totalStudents && gradebookSummary.totalStudents > 0) {
      return gradebookSummary.totalStudents;
    }
    if (totalStudentsCount !== null && Number.isFinite(totalStudentsCount) && totalStudentsCount > 0) {
      return totalStudentsCount;
    }
    const sumFromClasses = classesData.reduce(
        (sum, cls) => sum + (Number.isFinite(cls.studentCount) ? cls.studentCount : 0),
        0
    );
    return sumFromClasses > 0 ? sumFromClasses : null;
  }, [gradebookSummary.totalStudents, totalStudentsCount, classesData]);

  const hasGradebookMetrics = useMemo(() => (
    gradeBookData && (Number.isFinite(gradeBookData.totalAssignments) && gradeBookData.totalAssignments > 0)
  ) || (Number.isFinite(gradeBookData?.pendingGrades) && gradeBookData.pendingGrades > 0)
    || (Number.isFinite(gradeBookData?.averageGrade) && gradeBookData.averageGrade > 0), [gradeBookData]);

  // Navigate to first pending assignment in grade management
  const navigateToPendingGrades = useCallback(() => {
    // Find first assignment with pending grades
    const firstPendingAssignment = gradeBookData?.recentAssignments?.find(a => a.pending > 0);
    
    if (firstPendingAssignment && firstPendingAssignment.courseCode) {
      // Navigate to grade management with course filter in URL
      navigate(`/grade-management?course=${encodeURIComponent(firstPendingAssignment.courseCode)}`);
    } else {
      // Fallback to grade management without filters
      navigate('/grade-management');
    }
  }, [gradeBookData, navigate]);

  const quickStats = useMemo(() => buildQuickStats({
    totalStudents: totalStudentsGlobal,
    classesToday: todaySchedule.length,
    pendingGrades: hasGradebookMetrics ? gradeBookData.pendingGrades : null,
    attendanceRate: gradebookSummary.attendanceAverage,
    averageGrade: hasGradebookMetrics ? gradeBookData.averageGrade : null,
  }), [
    totalStudentsGlobal,
    todaySchedule.length,
    hasGradebookMetrics,
    gradeBookData.pendingGrades,
    gradeBookData.averageGrade,
    gradebookSummary.attendanceAverage,
  ]);

  const recentActivities = useMemo(() => (
    activities.length ? activities : synthActivities(classesData)
  ), [activities, classesData]);

  const summaryNotifications = useMemo(() => (
    gradebookSummary.notifications.length
      ? gradebookSummary.notifications
      : synthNotifications()
  ), [gradebookSummary.notifications]);

  const { setNotifications: setGlobalNotifications } = useNotifications() || {};

  useEffect(() => {
    if (typeof setGlobalNotifications === 'function' && Array.isArray(summaryNotifications)) {
      setGlobalNotifications(summaryNotifications);
    }
  }, [setGlobalNotifications, summaryNotifications]);

  const handleLogout = () => {
    navigate('/');
  };

  const handleEditNews = (newsItem) => {
    setEditingNews(newsItem);
    setNewsModalOpen(true);
  };

  const handleCreateNews = () => {
    setEditingNews(null);
    setNewsModalOpen(true);
  };

  const handleNewsModalClose = () => {
    setNewsModalOpen(false);
    setEditingNews(null);
  };

  const handleNewsSuccess = () => {
    setNewsRefreshTrigger((prev) => prev + 1);
    handleNewsModalClose();
  };

  const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

  return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Header
            userRole="teacher"
            userName={teacherInfo?.name}
            onLogout={handleLogout}
        />

        <RoleSidebar
            userRole="teacher"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Teacher dashboard">
          <main className="flex-1">
            <div className="px-6 pt-3 pb-6">
              <NavigationBreadcrumb />
              {(!initialLoadComplete && isLoading) && (
                <DataLoader
                  label="Synchronizing latest classroom data…"
                  description="Pulling gradebook, timetable, and activity feed."
                  details={[
                    'Faculty index • course roster • student snapshots',
                    'Timetable & assignment analytics • attendance rollup',
                    'Notifications, quick stats, and live panels refresh',
                  ]}
                  fullScreen
                />
              )}

              <Reveal as={motion.section} variant="keycap" className="mb-6" aria-labelledby="welcome-title" delay={ANIMATION_DELAYS.HERO} waitForLoaders={true}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h1 id="welcome-title" className="text-2xl font-bold text-foreground mb-1 truncate">
                      Welcome back, {teacherInfo?.name}
                    </h1>
                    <Reveal variant="keycap" delay={ANIMATION_DELAYS.SUBTITLE} waitForLoaders={true}>
                      <p className="text-muted-foreground">
                        {(teacherInfo?.department && teacherInfo.department !== '—') ? teacherInfo.department : '—'} • Employee ID: {teacherInfo?.employeeId || '—'}
                      </p>
                    </Reveal>
                  </div>
                  <Reveal variant="keycap" delay={ANIMATION_DELAYS.SUBTITLE + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {currentTime?.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {currentTime?.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                      <Button
                          variant="outline"
                          iconName="Calendar"
                          onClick={() => {
                            document.querySelector('#today-schedule-title')?.scrollIntoView({ behavior: 'auto', block: 'start' });
                          }}
                      >
                        View Schedule
                      </Button>
                    </div>
                  </Reveal>
                </div>
              </Reveal>

              <Reveal as={motion.div} variant="keycap" className="mb-6" delay={ANIMATION_DELAYS.SUMMARY_CARDS} waitForLoaders={true}>
                <QuickStatsOverview 
                  statsData={quickStats} 
                  onScrollToMyClasses={scrollToMyClasses}
                  onNavigateToPendingGrades={navigateToPendingGrades}
                />
              </Reveal>

              <Reveal as={motion.section} variant="keycap" className="mb-6" aria-labelledby="quick-actions-title" delay={ANIMATION_DELAYS.FILTERS} waitForLoaders={true}>
                <h2 id="quick-actions-title" className="sr-only">Quick Actions</h2>
                <QuickActionPanel userRole="teacher" onQuickAction={undefined} />
              </Reveal>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <Reveal as={motion.div} variant="keycap" className="xl:col-span-2 space-y-6" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} waitForLoaders={true}>
                  <section aria-labelledby="my-classes-title">
                    <div ref={myClassesRef}>
                      <h2 id="my-classes-title" className="text-lg font-semibold text-foreground mb-4">
                        My Classes
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classesData?.map((classData, idx) => (
                          <Reveal
                            as={motion.div}
                            variant="pop"
                            key={classData?.id}
                            delay={ANIMATION_DELAYS.SIDEBAR_PANEL + ANIMATION_DELAYS.STEP * (idx + 1)}
                            className="h-full"
                            waitForLoaders={true}
                          >
                            <ClassOverviewCard classData={classData} />
                          </Reveal>
                      ))}
                    </div>
                    {(!classesData || classesData.length === 0) && (
                        <Reveal variant="keycap" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                            No classes found for you yet.
                          </div>
                        </Reveal>
                    )}
                  </section>

                  <Reveal as={motion.div} variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT} waitForLoaders={true}>
                    <TodaySchedulePanel scheduleData={todaySchedule} />
                  </Reveal>
                </Reveal>

                <Reveal as={motion.div} variant="slideScale" className="space-y-6 xl:sticky xl:top-20 self-start" delay={ANIMATION_DELAYS.MAIN_CONTENT} waitForLoaders={true}>
                  <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                    <NotificationCenter />
                  </Reveal>

                  <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP * 2} waitForLoaders={true}>
                    <NewsPanel 
                      canEdit={true} 
                      onEdit={handleEditNews}
                      onCreate={handleCreateNews}
                      refreshTrigger={newsRefreshTrigger}
                    />
                  </Reveal>

                  <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP * 3} waitForLoaders={true}>
                    <GradeBookQuickAccess
                        gradeBookData={gradeBookData}
                        coursesList={coursesList}
                        timetableEntries={timetableForTeacher}
                        facultyList={facultyList}
                    />
                  </Reveal>
                </Reveal>
              </div>

              <Reveal as={motion.section} variant="keycap" className="mb-6" aria-labelledby="recent-activity-title" delay={ANIMATION_DELAYS.ACTIVITY} waitForLoaders={true}>
                <h2 id="recent-activity-title" className="sr-only">Recent Activity</h2>
                <RecentActivityPanel activities={recentActivities} />
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
          />
        </div>

        <NewsModal 
          isOpen={newsModalOpen}
          onClose={handleNewsModalClose}
          newsItem={editingNews}
          onSuccess={handleNewsSuccess}
        />
      </div>
  );
};

const TeacherDashboard = () => {
  return (
      <ToastsProvider>
        <TeacherDashboardPage />
        <ToastViewport position="top-right" />
      </ToastsProvider>
  );
};

export default TeacherDashboard;