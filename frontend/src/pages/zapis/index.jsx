// src/pages/zapis/index.jsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import TabBar from '../../components/ui/TabBar';

import { useAuth } from '../../contexts/AuthContext';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';

import ZIndexFix from './components/ZIndexFix';
import SectionHeader from './components/SectionHeader';
import DataTable from './components/DataTable';
import QuickActionPanel from '../../components/ui/QuickActionPanel';

import {
    norm,
    dtISO,
    creditsOf,
    asString,
    downloadBlob,
    printNow,
    H
} from './utils/zapisUtils';
import { fetchCourses, fetchScheduleForCourse, fetchScheduleEvents, confirmEnrollment, fetchStudentEnrollments, fetchStudents, fetchCourseEnrollmentReadiness, syncCoursesFacultyProgram } from '../../data/maisApiAdapter';
import api from '../../utils/apiClient';
import DataLoader from '../../components/ui/DataLoader';
import { formatLastLogin } from '../../utils/datetime';
import { extractApiErrorMessage } from '../../utils/apiErrors';
import useUserPreference from '../../hooks/useUserPreference';
import useDataUpdates from '../../hooks/useDataUpdates';
import useEnrollmentHub from '../../hooks/useEnrollmentHub';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../constants/animations';

import { createLogger } from '../../utils/logger';
const logger = createLogger('index');

// Current academic period constants
const CURRENT_ACAD_YEAR = '2025/2026';
const CURRENT_SEMESTER = 'WS';

const ZapisPageInner = () => {
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
    const toastLocksRef = useRef({});
    const guardedNotify = useCallback((key, type, message, opts = {}) => {
        if (key) {
            const now = Date.now();
            const lock = opts.lockMs ?? 2600;
            const prev = toastLocksRef.current[key] ?? 0;
            if (now - prev < lock) return;
            toastLocksRef.current[key] = now;
        }
        notify(type, message, opts);
    }, [notify]);
    const { user, userProfile } = useAuth();
    const { value: selectedStudy } = useSelectedStudyValue();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);

    const email = user?.email || '';
    const fullName = userProfile?.full_name || user?.full_name || email.split('@')[0] || 'Student';
    const year = Number(userProfile?.year ?? 1);
    const studentFaculty = userProfile?.faculty || user?.faculty || '';
    const studentProgram = selectedStudy?.programName || userProfile?.program || user?.program || selectedStudy?.programCode || '';

    const [active, setActive] = useState('dashboard');

    // Fixed academic period (no semester selection)
    const acad = CURRENT_ACAD_YEAR;
    const semester = CURRENT_SEMESTER;

    const [search, setSearch] = useState('');

    const selectionPreferenceKey = useMemo(
        () => (email ? `zapis.selected.${email.toLowerCase()}` : null),
        [email],
    );
    const {
        value: storedSelection,
        setValue: saveSelectionPreference,
        loading: selectionLoading,
    } = useUserPreference(selectionPreferenceKey, []);
    const [selectedCodesArr, setSelectedCodesArr] = useState([]);
    const selectionHydratedRef = useRef(false);
    // Enrollment readiness status for each course - must be declared before toggleSelect
    const [courseReadiness, setCourseReadiness] = useState({}); // { [courseCode]: { isReady, hasClEvents, hasQuiz, message } }
    useEffect(() => {
        if (selectionHydratedRef.current) return;
        if (selectionLoading) return;
        selectionHydratedRef.current = true;
        if (Array.isArray(storedSelection)) {
            setSelectedCodesArr(storedSelection);
        } else {
            setSelectedCodesArr([]);
        }
    }, [selectionLoading, storedSelection]);
    const toggleSelect = useCallback((code) => {
        // Check if course is ready for enrollment
        const readiness = courseReadiness[code];
        const isReady = readiness?.isReady !== false; // Default to true if not loaded yet
        if (!isReady) {
            guardedNotify('zapis-not-ready', 'warning', readiness?.message || 'Course is not ready for enrollment', { title: 'Enrollment blocked', lockMs: 3000 });
            return;
        }
        setSelectedCodesArr((prev) => {
            const set = new Set(prev);
            if (set.has(code)) set.delete(code);
            else set.add(code);
            return Array.from(set);
        });
    }, [courseReadiness, guardedNotify]);
    useEffect(() => {
        if (!selectionHydratedRef.current) return;
        saveSelectionPreference(selectedCodesArr);
    }, [selectedCodesArr, saveSelectionPreference]);
    // Selected schedule slots per course (event id) - supports all event types
    // Structure: { [courseCode]: { [eventType]: scheduleEventId } }
    // eventType can be: 'p', 'cl', 's', 'cons', 'exam', etc. (lowercase of event type)
    const [selectedSlots, setSelectedSlots] = useState({}); // { [courseCode]: { [type]: string } }

    // Courses available for the current semester/year
    const [allCourses, setAllCourses] = useState([]);
    const [availableCourses, setAvailableCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingSchedules, setLoadingSchedules] = useState(true);
    const [loadingEnrollment, setLoadingEnrollment] = useState(true);
    // All schedule events grouped by course, used to show all courses that have schedules
    const [allSchedulesByCourse, setAllSchedulesByCourse] = useState({}); // { [courseCode]: [events] }
    const scheduledCourseCodes = useMemo(() => new Set(Object.keys(allSchedulesByCourse||{})), [allSchedulesByCourse]);
    React.useEffect(() => { (async () => {
        try {
            const list = await fetchCourses();
            const courses = Array.isArray(list) ? list : [];
            
            // Log courses missing faculty/program for debugging
            const coursesWithoutFacultyOrProgram = courses.filter(
                c => !c?.faculty || !c?.program
            );
            if (coursesWithoutFacultyOrProgram.length > 0) {
                logger.debug('[zapis] Some courses missing faculty/program:', {
                    count: coursesWithoutFacultyOrProgram.length,
                    sample: coursesWithoutFacultyOrProgram.slice(0, 5).map(c => ({ 
                        code: c.code, 
                        name: c.nameEn || c.nameSk,
                        faculty: c.faculty || '(missing)',
                        program: c.program || '(missing)'
                    }))
                });
            }
            
            setAllCourses(courses);
        } catch {
            setAllCourses([]);
        } finally {
            setLoadingCourses(false);
        }
    })(); }, []);
    React.useEffect(() => {
        const sem = String(semester || 'WS');

        const normalizeSemesterKey = (value) => {
            const token = String(value || '').trim().toUpperCase();
            if (!token) return '';
            if (/ZS|ZIM|WS|WT|WINTER|FALL/.test(token)) return 'WINTER';
            if (/LS|LET|SS|ST|SUMMER|SPRING/.test(token)) return 'SUMMER';
            if (/ALL|ANY/.test(token)) return 'ANY';
            return '';
        };

        const selectedSemesterKey = normalizeSemesterKey(sem);

        const matchesAcademicYear = (course) => {
            const selectedYear = Number(year) || 0;
            if (!selectedYear) return true;
            const rawPeriod = String(course?.periodSk || course?.period || '').toUpperCase();
            const yearMatches = rawPeriod.match(/20\d{2}/g);
            if (!yearMatches || yearMatches.length === 0) return true;
            return yearMatches.some((yr) => {
                const parsed = Number(yr);
                return parsed === selectedYear || parsed === selectedYear + 1;
            });
        };

        const filterByPeriod = (course) => {
            const courseSemesterKey = normalizeSemesterKey(course?.periodSk || course?.period || course?.semester);
            if (!courseSemesterKey || courseSemesterKey === 'ANY') {
                return matchesAcademicYear(course);
            }
            if (!selectedSemesterKey || selectedSemesterKey === courseSemesterKey) {
                return matchesAcademicYear(course);
            }
            if (course?.code === '26001198' || course?.code === '26000647') {
                logger.debug('[zapis] Course filtered out: semester mismatch', {
                    code: course?.code,
                    periodSk: course?.periodSk,
                    semesterSelected: sem,
                    selectedSemesterKey,
                    courseSemesterKey,
                });
            }
            return false;
        };

        // Filter by student's Faculty and Program
        const filterByFacultyAndProgram = (c) => {
            const courseFaculty = String(c?.faculty || '').trim();
            const courseProgram = String(c?.program || '').trim();
            const hasCourseProgram = courseProgram.length > 0;
            const hasStudentProgram = studentProgram && studentProgram.length > 0;
            
            // Log for debugging (all courses without program or specific ones)
            if (!hasCourseProgram || c?.code === '26001198' || c?.code === '26000647') {
                logger.debug('[zapis] Course filter check:', {
                    code: c.code,
                    courseFaculty: courseFaculty || '(empty)',
                    courseProgram: courseProgram || '(empty)',
                    studentFaculty: studentFaculty || '(empty)',
                    studentProgram: studentProgram || '(empty)',
                    hasCourseProgram,
                    hasStudentProgram
                });
            }
            
            // Step 1: Faculty must match (if student has faculty)
            if (studentFaculty && studentFaculty.length > 0) {
                if (!courseFaculty || courseFaculty.length === 0 || courseFaculty.toUpperCase() !== studentFaculty.toUpperCase()) {
                    if (!hasCourseProgram || c?.code === '26001198' || c?.code === '26000647') {
                        logger.debug('[zapis] Course filtered out: faculty mismatch', { 
                            courseFaculty: courseFaculty || '(empty)', 
                            studentFaculty 
                        });
                    }
                    return false;
                }
            }
            
            // Step 2: If course has a specific program, it MUST match student's program exactly
            // Only courses without a program (null/empty) can be shared across programs
            if (hasCourseProgram) {
                // Course has a specific program - must match student's program exactly
                if (hasStudentProgram && courseProgram.toUpperCase() !== studentProgram.toUpperCase()) {
                    if (c?.code === '26001198' || c?.code === '26000647') {
                        logger.debug('[zapis] Course filtered out: program mismatch (course has specific program)', { 
                            courseProgram, 
                            studentProgram,
                            courseFaculty,
                            studentFaculty
                        });
                    }
                    return false;
                }
                // If course has program and student doesn't, allow if faculty matches (already checked in Step 1)
                if (!hasStudentProgram) {
                    // Course has program but student doesn't - allow if faculty matches
                    return true;
                }
                // Both have programs and they match - allow
                return true;
            }
            
            // Step 3: Course doesn't have program
            // If student has program, allow if faculty matches (course is shared across programs)
            if (hasStudentProgram) {
                // Course doesn't have program - allow if faculty matches (already checked in Step 1)
                return true;
            }
            
            // Step 4: Neither has program - allow if faculty matches (or no faculty filter)
            // If neither has program, allow if faculty matches (already checked in Step 1)
            return true;
        };
        
        const byCode = new Map((allCourses || []).map(c => [String(c.code), c]));
        
        // Debug: check courses without program
        const coursesWithoutProgram = (allCourses || []).filter(c => {
            const courseProgram = String(c?.program || '').trim();
            return courseProgram.length === 0;
        });
        if (coursesWithoutProgram.length > 0) {
            logger.debug('[zapis] Courses without program:', {
                count: coursesWithoutProgram.length,
                sample: coursesWithoutProgram.slice(0, 5).map(c => {
                    const passesPeriod = filterByPeriod(c);
                    const passesFacultyProgram = filterByFacultyAndProgram(c);
                    const hasSchedule = scheduledCourseCodes.has(String(c.code));
                    return {
                        code: c.code,
                        name: c.nameEn || c.nameSk,
                        faculty: c.faculty || '(empty)',
                        program: c.program || '(empty)',
                        periodSk: c.periodSk || '(empty)',
                        hasSchedule,
                        passesPeriod,
                        passesFacultyProgram,
                        studentYear: year,
                        studentSemester: semester
                    };
                })
            });
        }
        
        // Recommended: courses matching student's year, selected semester, Faculty, Program AND having schedules
        // Debug: check each filter step
        const afterPeriodFilter = (allCourses || []).filter(filterByPeriod);
        const afterFacultyProgramFilter = afterPeriodFilter.filter(filterByFacultyAndProgram);
        const afterScheduleFilter = afterFacultyProgramFilter.filter((c) => scheduledCourseCodes.has(String(c.code)));
        
        logger.debug('[zapis] Filter steps:', {
            totalCourses: allCourses?.length || 0,
            afterPeriodFilter: afterPeriodFilter.length,
            afterFacultyProgramFilter: afterFacultyProgramFilter.length,
            afterScheduleFilter: afterScheduleFilter.length,
            scheduledCourseCodes: Array.from(scheduledCourseCodes),
            sampleAfterPeriod: afterPeriodFilter.slice(0, 3).map(c => ({
                code: c.code,
                periodSk: c.periodSk || '(empty)',
                faculty: c.faculty || '(empty)',
                program: c.program || '(empty)'
            })),
            sampleAfterFacultyProgram: afterFacultyProgramFilter.slice(0, 3).map(c => ({
                code: c.code,
                periodSk: c.periodSk || '(empty)',
                faculty: c.faculty || '(empty)',
                program: c.program || '(empty)'
            }))
        });
        
        const recommended = afterScheduleFilter;
        
        // Also include any course that has a schedule even if periodSk doesn't match (but still filter by Faculty/Program)
        for (const code of Array.from(scheduledCourseCodes)) {
            if (!byCode.has(String(code))) {
                logger.debug('[zapis] Scheduled course not found in courses list:', code);
                continue;
            }
            const course = byCode.get(String(code));
            if (!course) {
                logger.debug('[zapis] Course is null for code:', code);
                continue;
            }
            
            // Check if course passes faculty/program filter
            const passesFilter = filterByFacultyAndProgram(course);
            if (!passesFilter) {
                logger.debug('[zapis] Scheduled course filtered out by faculty/program:', {
                    code: course.code,
                    name: course.nameEn || course.nameSk,
                    faculty: course.faculty || '(empty)',
                    program: course.program || '(empty)',
                    studentFaculty,
                    studentProgram
                });
                continue;
            }
            
            const existing = recommended.find(r => String(r.code) === String(code));
            if (!existing) {
                logger.debug('[zapis] Adding course with schedule (periodSk may not match):', {
                    code: course.code,
                    name: course.nameEn || course.nameSk,
                    periodSk: course.periodSk || '(empty)',
                    faculty: course.faculty || '(empty)',
                    program: course.program || '(empty)',
                    passesPeriodFilter: filterByPeriod(course)
                });
                recommended.push(course);
            }
        }
        // As a safety, if a scheduled course isn't present in courses API, only add if it matches student's Faculty/Program
        // (We can't check Faculty/Program for fallback entries, so skip them to avoid showing wrong courses)
        // de-duplicate by code
        const dedup = Array.from(new Map(recommended.map(c => [String(c.code), c])).values());
        
        // Log for debugging
        logger.debug('[zapis] Available courses calculation:', {
            allCoursesCount: allCourses?.length || 0,
            scheduledCourseCodesCount: scheduledCourseCodes.size,
            coursesWithoutProgramCount: coursesWithoutProgram.length,
            recommendedCount: recommended.length,
            dedupCount: dedup.length,
            studentFaculty,
            studentProgram,
            year,
            semester,
            scheduledCourseCodes: Array.from(scheduledCourseCodes),
            sampleCourses: dedup.slice(0, 3).map(c => ({
                code: c.code,
                name: c.nameEn || c.nameSk,
                faculty: c.faculty || '(empty)',
                program: c.program || '(empty)',
                periodSk: c.periodSk || '(empty)'
            }))
        });
        
        setAvailableCourses(dedup);
    }, [allCourses, year, scheduledCourseCodes, semester, studentFaculty, studentProgram]);

    // Load enrollment readiness for all available courses
    React.useEffect(() => { (async () => {
        const readinessMap = {};
        for (const course of availableCourses) {
            const code = String(course?.code || '').trim();
            if (!code) continue;
            try {
                const readiness = await fetchCourseEnrollmentReadiness(code);
                if (readiness) {
                    readinessMap[code] = readiness;
                }
            } catch {
                // Ignore errors, course will be treated as not ready
            }
        }
        setCourseReadiness(readinessMap);
    })(); }, [availableCourses]);

    // Load all schedule events once and group by course so the selector shows all courses with schedules
    React.useEffect(() => { (async () => {
        try {
            const events = await fetchScheduleEvents();
            const grouped = {};
            for (const e of Array.isArray(events) ? events : []) {
                const code = String(e.courseCode || '');
                if (!code) continue;
                const [s,e2] = String(e.slot||'').split('-');
                const mapped = {
                    id: e.id || e.ID || e.Id || undefined,
                    key: `${code}|${e.day}|${e.slot}`,
                    courseCode: code,
                    day: e.day,
                    start: (s||'').trim(),
                    end: (e2||'').trim(),
                    room: e.room||'—',
                    teacher: e.teacherEmail||'',
                    type: (e.type || '').toString().toUpperCase(),
                    groups: e.classGroupKeys||[],
                    capacity: e.capacity||null
                };
                if (!grouped[code]) grouped[code] = [];
                grouped[code].push(mapped);
            }
            setAllSchedulesByCourse(grouped);
        } catch {
            setAllSchedulesByCourse({});
        } finally {
            setLoadingSchedules(false);
        }
    })(); }, []);

    const mySelected = useMemo(() => {
        // derive objects for Selected tab from selected codes
        const map = new Map((allCourses||[]).map(c => [String(c.code), c]));
        return (selectedCodesArr||[]).map((code) => {
            const c = map.get(String(code)) || { code, nameEn: code, credits: 6 };
            return {
                id: `${email}|${code}`,
                code,
                name: c.nameEn || c.name || code,
                type: c.typeSk || 'P',
                prof: c.profile || 'P',
                zav: c.completionSk || '—',
                credits: Number(c.credits || 6),
                faculty: 'FEI',
                requestAt: new Date(),
            };
        });
    }, [selectedCodesArr, allCourses, email]);

    const courseByCode = useMemo(() => {
        const out = {};
        for (const c of allCourses || []) out[String(c.code)] = c;
        return out;
    }, [allCourses]);

    // Helper function to check if two schedule events overlap in time
    const doEventsOverlap = useCallback((event1, event2) => {
        if (!event1 || !event2) return false;
        if (event1.day !== event2.day) return false; // Different days, no conflict
        
        // Parse time strings (format: "HH:MM")
        const parseTime = (timeStr) => {
            const [h, m] = (timeStr || '').split(':').map(Number);
            return (h || 0) * 60 + (m || 0); // Convert to minutes
        };
        
        const start1 = parseTime(event1.start);
        const end1 = parseTime(event1.end);
        const start2 = parseTime(event2.start);
        const end2 = parseTime(event2.end);
        
        // Check if time ranges overlap
        return !(end1 <= start2 || end2 <= start1);
    }, []);

    // Get all selected events across all courses for conflict checking
    const getAllSelectedEvents = useCallback(() => {
        const selected = [];
        for (const [courseCode, slots] of Object.entries(selectedSlots || {})) {
            if (!slots || typeof slots !== 'object') continue;
            const events = allSchedulesByCourse[courseCode] || [];
            for (const [slotType, eventId] of Object.entries(slots)) {
                if (!eventId) continue;
                const event = events.find(e => e.id === eventId);
                if (event) {
                    selected.push({ ...event, courseCode, slotType });
                }
            }
        }
        return selected;
    }, [selectedSlots, allSchedulesByCourse]);

    // Check if a new event conflicts with already selected P/CL/S events
    // Rule: Student can only enroll in ONE P, CL, or S event at the same time
    const checkTimeConflict = useCallback((newEvent, excludeCourseCode = null, excludeSlotType = null) => {
        if (!newEvent) return { conflict: false };
        
        // Only check conflicts for P, CL, and S types (and events without type, which are treated as CL)
        const newEventType = (newEvent.type || '').toUpperCase();
        const isNewEventPOrCLOrS = newEventType === 'P' || newEventType === 'CL' || newEventType === 'S' || !newEventType;
        if (!isNewEventPOrCLOrS) return { conflict: false };
        
        const selectedEvents = getAllSelectedEvents();
        for (const selected of selectedEvents) {
            // Skip if this is the same course and slot type being changed
            if (excludeCourseCode && selected.courseCode === excludeCourseCode) {
                if (excludeSlotType && selected.slotType === excludeSlotType) continue;
            }
            
            // Only check conflicts between P/CL/S types
            const selectedType = (selected.type || '').toUpperCase();
            const isSelectedPOrCLOrS = selectedType === 'P' || selectedType === 'CL' || selectedType === 'S' || !selectedType;
            if (!isSelectedPOrCLOrS) continue;
            
            // P, CL, and S can conflict with each other if at the same time
            // Student can only have ONE P, CL, or S event at the same time slot
            if (doEventsOverlap(selected, newEvent)) {
                const typeLabel = selectedType === 'P' ? 'P (Lecture/Practice)' : 
                                 selectedType === 'CL' ? 'CL (Class)' : 
                                 selectedType === 'S' ? 'S (Seminar)' : 
                                 'Practice';
                return {
                    conflict: true,
                    conflictingEvent: selected,
                    message: `Time conflict with ${selected.courseCode} (${typeLabel}) on ${selected.day} ${selected.start}-${selected.end}. You can only enroll in one P, CL, or S event at the same time.`,
                };
            }
        }
        return { conflict: false };
    }, [getAllSelectedEvents, doEventsOverlap]);

    const mySelectedFiltered = useMemo(() => {
        const q = norm(search);
        if (!q) return mySelected;
        return mySelected.filter((s) => norm(s.name).includes(q) || norm(s.code).includes(q));
    }, [mySelected, search]);

    const totalCredits = useMemo(() => mySelected.reduce((s, c) => s + Number(c.credits || 0), 0), [mySelected]);
    const minCredits = 30;

    const selectedCodes = useMemo(() => new Set(mySelected.map((s) => s.code)), [mySelected]);
    const [scheduleByCourse, setScheduleByCourse] = useState({});
    const [locked, setLocked] = useState(false);
    const [lockReason, setLockReason] = useState('');
    const [confirmedEnrollments, setConfirmedEnrollments] = useState([]);
    
    // detect lock based on existing confirmed enrollments for the current term (resolve DB student id by email)
    React.useEffect(() => { (async () => {
        try {
            const email = user?.email || '';
            if (!email) { setLoadingEnrollment(false); setConfirmedEnrollments([]); return; }
            const studs = await fetchStudents({ q: email, page: 1, pageSize: 10 });
            const me = (Array.isArray(studs) ? studs : []).find(s => (s.email||'').toLowerCase() === email.toLowerCase()) || (Array.isArray(studs) ? studs[0] : null);
            const sid = me?.id || '';
            if (!sid) { setLoadingEnrollment(false); setConfirmedEnrollments([]); return; }
            const list = await fetchStudentEnrollments(sid);
            setConfirmedEnrollments(Array.isArray(list) ? list : []);
            const anyForTerm = (list||[]).some(e => String(e.academicYear||'') === String(acad) && String(e.semester||'').toUpperCase() === String(semester||'').toUpperCase());
            if (anyForTerm) {
                setLocked(true);
                setLockReason('Enrollment already confirmed for this semester');
            }
        } catch {
            setConfirmedEnrollments([]);
        }
        finally {
            setLoadingEnrollment(false);
        }
    })(); }, [user?.email, acad, semester]);

    // Listen for data updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        if (!payload?.type) return;
        
        logger.debug('[zapis] Data update received', payload);
        
        // Reload courses and enrollments on updates
        if (payload.type === 'enrollment.updated' || 
            payload.type === 'schedule.updated' || 
            payload.type === 'assignment.updated') {
            // Reload courses
            (async () => {
                try {
                    const list = await fetchCourses();
                    setAllCourses(Array.isArray(list) ? list : []);
                } catch {
                    // Ignore errors
                }
            })();
            
            // Reload enrollments
            (async () => {
                try {
                    const email = user?.email || '';
                    if (!email) return;
                    const studs = await fetchStudents({ q: email, page: 1, pageSize: 10 });
                    const me = (Array.isArray(studs) ? studs : []).find(s => (s.email||'').toLowerCase() === email.toLowerCase()) || (Array.isArray(studs) ? studs[0] : null);
                    const sid = me?.id || '';
                    if (!sid) return;
                    const list = await fetchStudentEnrollments(sid);
                    const anyForTerm = (list||[]).some(e => String(e.academicYear||'') === String(acad) && String(e.semester||'').toUpperCase() === String(semester||'').toUpperCase());
                    if (anyForTerm) {
                        setLocked(true);
                        setLockReason('Enrollment already confirmed for this semester');
                    }
                } catch {
                    // Ignore errors
                }
            })();
            
            // Reload schedule events if schedule was updated (to get updated course Faculty/Program)
            if (payload.type === 'schedule.updated') {
                (async () => {
                    try {
                        const events = await fetchScheduleEvents();
                        const grouped = {};
                        for (const e of Array.isArray(events) ? events : []) {
                            const code = String(e.courseCode || '');
                            if (!code) continue;
                            const [s,e2] = String(e.slot||'').split('-');
                            const mapped = {
                                id: e.id || e.ID || e.Id || undefined,
                                key: `${code}|${e.day}|${e.slot}`,
                                courseCode: code,
                                day: e.day,
                                start: (s||'').trim(),
                                end: (e2||'').trim(),
                                room: e.room||'—',
                                teacher: e.teacherEmail||'',
                                type: (e.type || '').toString().toUpperCase(),
                                groups: e.classGroupKeys||[],
                                capacity: e.capacity||null
                            };
                            if (!grouped[code]) grouped[code] = [];
                            grouped[code].push(mapped);
                        }
                        setAllSchedulesByCourse(grouped);
                    } catch {
                        // Ignore errors
                    }
                })();
            }
            
            // Reload course readiness if schedule or assignment was updated
            if (payload.type === 'schedule.updated' || payload.type === 'assignment.updated') {
                (async () => {
                    try {
                        const list = await fetchCourses();
                        const courses = Array.isArray(list) ? list : [];
                        const readinessMap = {};
                        for (const c of courses) {
                            const code = c.code || '';
                            if (!code) continue;
                            try {
                                const readiness = await fetchCourseEnrollmentReadiness(code);
                                if (readiness) {
                                    readinessMap[code] = readiness;
                                }
                            } catch {
                                // Ignore errors
                            }
                        }
                        setCourseReadiness(readinessMap);
                    } catch {
                        // Ignore errors
                    }
                })();
            }
        }
    }, []); // Empty dependencies - user email, acad, and semester fetched inline

    useDataUpdates(handleDataUpdate);

    // Use EnrollmentHub for real-time enrollment updates
    useEnrollmentHub({
        onEnrollmentCreated: useCallback((payload) => {
            console.log('[Zapis] Enrollment created via EnrollmentHub:', payload);
            handleDataUpdate({ type: 'enrollment.updated', action: 'created', ...payload });
        }, [handleDataUpdate]),
        onEnrollmentUpdated: useCallback((payload) => {
            console.log('[Zapis] Enrollment updated via EnrollmentHub:', payload);
            handleDataUpdate({ type: 'enrollment.updated', action: 'updated', ...payload });
        }, [handleDataUpdate]),
        onEnrollmentCancelled: useCallback((payload) => {
            console.log('[Zapis] Enrollment cancelled via EnrollmentHub:', payload);
            handleDataUpdate({ type: 'enrollment.updated', action: 'cancelled', ...payload });
        }, [handleDataUpdate]),
        onEnrollmentConfirmed: useCallback((payload) => {
            console.log('[Zapis] Enrollment confirmed via EnrollmentHub:', payload);
            handleDataUpdate({ type: 'enrollment.updated', action: 'confirmed', ...payload });
        }, [handleDataUpdate])
    });

    React.useEffect(() => { (async () => {
        const out = {};
        for (const code of Array.from(selectedCodes)) {
            const arr = await fetchScheduleForCourse(code);
            out[code] = (arr||[]).map(e => {
                const [s,e2] = String(e.slot||'').split('-');
                return {
                    id: e.id || e.ID || e.Id || undefined,
                    key: `${code}|${e.day}|${e.slot}`,
                    courseCode: code,
                    day: e.day,
                    start: (s||'').trim(),
                    end: (e2||'').trim(),
                    room: e.room||'—',
                    teacher: e.teacherEmail||'',
                    type: (e.type || '').toString().toUpperCase(),
                    groups: e.classGroupKeys||[],
                    capacity: e.capacity||null
                };
            });
        }
        setScheduleByCourse(out);
    })(); }, [selectedCodesArr]);
    const scheduleRows = useMemo(() => {
        const rows = Array.from(selectedCodes).flatMap((c) => (scheduleByCourse[c] || []).map(r => ({...r, courseCode: c})) );
        return rows.sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start));
    }, [selectedCodes, scheduleByCourse]);

    const enrollmentWindow = useMemo(() => {
        // Enrollment is always open in this build; window kept for display only if needed
        const now = new Date();
        const start = now;
        const end = now;
        return { open: true, before: false, after: false, start, end };
    }, []);

    // Always allow online enrollment (button enabled based on selections and lock only)
    const canOnlineEnroll = true;

    const exportSelectedCSV = () => {
        const rows = [
            ['Course', 'Code', 'Type', 'Profile', 'Requirement', 'ECTS', 'Faculty', 'Requested at'],
            ...mySelectedFiltered.map((s) => [s.name, s.code, s.type, s.prof, s.zav, String(s.credits), s.faculty, dtISO(s.requestAt)]),
        ];
        const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `selected_courses_${acad}_${semester}.csv`);
        guardedNotify('zapis-export', 'success', 'CSV exported', { title: 'Export', lockMs: 2800 });
    };

    const exportScheduleCSV = () => {
        const rows = [
            ['Course', 'Code', 'Day', 'Start', 'End', 'Room', 'Groups', 'Capacity'],
            ...scheduleRows.map((r) => {
                const c = courseByCode?.[r.courseCode];
                return [c?.nameEn || c?.nameSk || c?.name || r.courseCode, r.courseCode, r.day, r.start, r.end, r.room, (r.groups || []).join(' | '), r.capacity ?? ''];
            }),
        ];
        const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `schedule_enrollment_${acad}_${semester}.csv`);
        guardedNotify('zapis-export', 'success', 'CSV exported', { title: 'Export', lockMs: 2800 });
    };

    const planByTerm = useMemo(() => {
        const ws = mySelected;
        const ss = mySelected.slice().reverse();
        return { ws, ss };
    }, [mySelected]);
    
    // Build confirmed enrollments by semester for Enrollment sheet
    const confirmedEnrollmentsBySemester = useMemo(() => {
        const fall = [];
        const spring = [];
        const courseMap = new Map((allCourses || []).map(c => [String(c.code), c]));
        const seenCodes = new Set(); // Track seen course codes to avoid duplicates
        
        for (const enr of confirmedEnrollments || []) {
            const code = String(enr.courseCode || '').trim();
            if (!code || seenCodes.has(code)) continue; // Skip duplicates
            
            const course = courseMap.get(code);
            const semester = String(enr.semester || '').toUpperCase();
            const enrollmentData = {
                code,
                name: course?.nameEn || course?.nameSk || course?.name || code,
                requirement: course?.completionSk || '—',
                credits: Number(course?.credits || 6),
                assessment: H(code) % 2 === 0 ? 'Graded credit' : 'Credit and exam',
            };
            
            if (semester === 'WS' || semester === 'FALL' || semester === 'WT') {
                fall.push(enrollmentData);
                seenCodes.add(code);
            } else if (semester === 'SS' || semester === 'SPRING' || semester === 'ST') {
                spring.push(enrollmentData);
                seenCodes.add(code);
            }
        }
        
        return { fall, spring };
    }, [confirmedEnrollments, allCourses]);

    const feeAmount = 33.7;
    const feeDue = '07/15/2025';
    const feeAccount = '7000151433/8180';
    const feeIban = 'SK8281800000007000151433';
    const feeVS = '2625011511';
    const feeSS = '26101';

    // Keycap-style animation that waits for loaders
    const fadeIn = (delay = 0, offset = 16) => ({
        initial: { opacity: 0, y: offset, rotateX: 45, scale: 0.95 },
        animate: isBlocked 
            ? { opacity: 0, y: offset, rotateX: 45, scale: 0.95 }
            : { opacity: 1, y: 0, rotateX: 0, scale: 1 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: isBlocked ? 0 : delay },
        style: { transformOrigin: 'center bottom', perspective: '1000px' },
    });

    const contentMotion = {
        initial: { opacity: 0, y: 18, rotateX: 45, scale: 0.95 },
        animate: isBlocked 
            ? { opacity: 0, y: 18, rotateX: 45, scale: 0.95 }
            : { opacity: 1, y: 0, rotateX: 0, scale: 1 },
        exit: { opacity: 0, y: -14 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        style: { transformOrigin: 'center bottom', perspective: '1000px' },
    };

    const renderActiveContent = () => {
        switch (active) {
            case 'dashboard':
                return (
                    <>
                        <motion.div
                            {...fadeIn()}
                            className="rounded-xl p-4 flex items-start gap-3 bg-primary/10 border border-primary/20 text-primary-foreground/90 shadow-lg shadow-black/25"
                        >
                            <Icon name="Info" size={18} className="mt-1 text-primary" />
                            <div className="text-sm leading-relaxed">
                                Select courses available for your current semester. Your selections are saved locally until you confirm online enrollment.
                            </div>
                        </motion.div>

                        <motion.div {...fadeIn(0.05)} className="space-y-4">
                            <SectionHeader
                                icon="FilePlus2"
                                title="Enrollment — available courses"
                                subtitle={`Year ${year} • ${CURRENT_SEMESTER} ${CURRENT_ACAD_YEAR}`}
                            />

                            <DataTable
                                id="enroll-avail"
                                head={[
                                    { key: 'predmet', label: 'Course' },
                                    { key: 'typ', label: 'Type' },
                                    { key: 'profil', label: 'Profile' },
                                    { key: 'uk', label: 'Assessment' },
                                    { key: 'kr', label: 'ECTS' },
                                    { key: 'act', label: 'Action' },
                                ]}
                                rows={(availableCourses || []).map((c) => {
                                    const enrolled = selectedCodesArr.includes(c.code);
                                    const code = String(c.code || '').trim();
                                    const readiness = courseReadiness[code];
                                    const isReady = readiness?.isReady !== false; // Default to true if not loaded yet
                                    const canEnroll = !locked && isReady;
                                    const readinessMessage = readiness?.message;
                                    
                                    return {
                                        key: `avail|${c.code}`,
                                        cols: [
                                            <div key="nm">
                                                <div className="font-medium">{c.nameEn || c.nameSk || c.code}</div>
                                                <div className="text-xs text-muted-foreground">{c.code}</div>
                                                {readinessMessage && !isReady && (
                                                    <div className="text-xs text-amber-500/90 mt-1 flex items-center gap-1">
                                                        <Icon name="AlertCircle" size={12} />
                                                        <span>{readinessMessage}</span>
                                                    </div>
                                                )}
                                            </div>,
                                            c.typeSk || 'P',
                                            (() => {
                                                const p = c.profile || '';
                                                if (p === 'PV') return 'PV (Compulsory)';
                                                if (p === 'PVP') return 'PVP (Compulsory Elective)';
                                                if (p === 'PP') return 'PP (Not Compulsory)';
                                                return p || '—';
                                            })(),
                                            (() => {
                                                const ct = String(c.completionSk || '').toLowerCase().trim();
                                                if (ct === 'cr') return 'Credit';
                                                if (ct === 'crex' || ct.includes('exam')) return 'Credit + Exam';
                                                return c.completionSk || '—';
                                            })(),
                                            String(c.credits || 6),
                                            <Button
                                                key="btn"
                                                size="xs"
                                                variant={enrolled ? 'outline' : 'default'}
                                                onClick={() => canEnroll && toggleSelect(c.code)}
                                                disabled={!canEnroll}
                                                title={!isReady ? readinessMessage : (locked ? lockReason : undefined)}
                                            >
                                                {enrolled ? 'Unenroll' : 'Enroll'}
                                            </Button>,
                                        ],
                                    };
                                })}
                            />
                        </motion.div>

                        <motion.div {...fadeIn(0.08)} className="space-y-4">
                            <SectionHeader
                                icon="FileStack"
                                title="Enrollment"
                                subtitle="Manage courses, schedule, and online enrollment"
                                right={
                                    <div className="flex flex-wrap items-center justify-end gap-3 w-full xl:w-auto">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            iconName="Printer"
                                            onClick={() => {
                                                printNow('zapis-dashboard-print');
                                                guardedNotify('zapis-print', 'info', 'Print dialog opened', {
                                                    title: 'Print',
                                                    lockMs: 2400,
                                                });
                                            }}
                                        >
                                            Print
                                        </Button>
                                    </div>
                                }
                            />

                            <div id="zapis-dashboard-print" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="glass-card rounded-xl border border-border p-4">
                                    <div className="text-sm text-muted-foreground">Credits — enrollment</div>
                                    <div className="mt-1 text-2xl font-bold">
                                        {totalCredits} / {minCredits}
                                    </div>
                                    <div className="mt-2 text-xs">{totalCredits < minCredits ? 'Minimum not met' : 'OK'}</div>
                                </div>
                                <div className="glass-card rounded-xl border border-border p-4">
                                    <div className="text-sm text-muted-foreground">Selected courses</div>
                                    <div className="mt-1 text-2xl font-bold">{mySelected.length}</div>
                                    <div className="mt-2 text-xs">
                                        {semester} {acad}
                                    </div>
                                </div>
                                <div className="glass-card rounded-xl border border-border p-4">
                                    <div className="text-sm text-muted-foreground">Online enrollment status</div>
                                    <div className={`mt-1 text-2xl font-bold ${canOnlineEnroll ? 'text-green-400' : 'text-zinc-300'}`}>
                                        {canOnlineEnroll ? 'Open' : 'Closed'}
                                    </div>
                                    <div className="mt-2 text-xs">
                                        Window {dtISO(enrollmentWindow.start)} – {dtISO(enrollmentWindow.end)}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                );
            case 'selected':
                return (
                    <>
                        <motion.div {...fadeIn()}>
                            <SectionHeader
                                icon="ListChecks"
                                title="Selected courses"
                                subtitle={`${totalCredits}/${minCredits} credits • ${CURRENT_SEMESTER} ${CURRENT_ACAD_YEAR}`}
                                right={
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto relative z-dropdown of-visible">
                                        <Select
                                            options={[
                                                { value: 'P', label: 'P' },
                                                { value: 'PV', label: 'PV' },
                                                { value: 'all', label: 'All' },
                                            ]}
                                            value="all"
                                            onChange={() => {}}
                                            className="w-full [&>button]:w-full [&>button]:truncate relative z-dropdown of-visible"
                                        />
                                        <Button variant="outline" size="sm" iconName="Download" onClick={exportSelectedCSV}>
                                            Export CSV
                                        </Button>
                                    </div>
                                }
                            />
                        </motion.div>

                        <motion.div {...fadeIn(0.05)} className="glass-card rounded-xl border border-border p-3 sm:p-4">
                            <div className="flex flex-wrap items-center gap-3 w-full">
                                <Input
                                    placeholder="Search course..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full sm:w-96 input"
                                />
                                <Button variant="ghost" size="sm" iconName="Sparkles" onClick={() => setSearch('')}>
                                    Clear
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    iconName="Printer"
                                    onClick={() => {
                                        printNow('zvolene-print');
                                        guardedNotify('zapis-print', 'info', 'Print dialog opened', { title: 'Print', lockMs: 2400 });
                                    }}
                                >
                                    Print
                                </Button>
                            </div>
                        </motion.div>

                        <motion.div {...fadeIn(0.1)}>
                            <DataTable
                                id="zvolene-print"
                                head={[
                                    { key: 'i', label: '#' },
                                    { key: 'predmet', label: 'Course' },
                                    { key: 'typ', label: 'Type' },
                                    { key: 'profil', label: 'Profile' },
                                    { key: 'zav', label: 'Requirement' },
                                    { key: 'kr', label: 'ECTS' },
                                    { key: 'fak', label: 'Faculty' },
                                    { key: 'req', label: 'Requested at' },
                                ]}
                                rows={mySelectedFiltered.map((s, idx) => ({
                                    key: String(s.id),
                                    cols: [
                                        idx + 1,
                                        <div className="flex items-center gap-2" key="nm">
                                            <Button variant="ghost" size="xs" iconName="FileSignature" />
                                            <span className="font-medium">{s.name}</span>
                                            <span className="text-xs text-muted-foreground">({s.code})</span>
                                        </div>,
                                        s.type,
                                        s.prof,
                                        s.zav,
                                        s.credits,
                                        s.faculty,
                                        s.requestAt.toLocaleString(),
                                    ],
                                }))}
                            />
                        </motion.div>
                    </>
                );
            case 'schedule':
                return (
                    <>
                        <motion.div {...fadeIn()}>
                            <SectionHeader
                                icon="CalendarDays"
                                title="Schedule enrollment"
                                subtitle={`Schedule slots for selected courses • ${CURRENT_SEMESTER} ${CURRENT_ACAD_YEAR}`}
                                right={
                                    <Button variant="outline" size="sm" iconName="Download" onClick={exportScheduleCSV}>
                                        Export CSV
                                    </Button>
                                }
                            />
                        </motion.div>

                        <motion.div {...fadeIn(0.05)}>
                            <DataTable
                                id="rozvrh-print"
                                head={[
                                    { key: 'predmet', label: 'Course' },
                                    { key: 'p', label: 'P (Lecture/Practice)' },
                                    { key: 'cl', label: 'CL (Class)' },
                                    { key: 's', label: 'S (Seminar)' },
                                ]}
                                rows={Array.from(scheduledCourseCodes)
                                    .filter((code) => selectedCodesArr.includes(code)) // Only show courses that were enrolled in "Enrollment" tab
                                    .map((code) => {
                                        const c = courseByCode?.[code];
                                        const rows = allSchedulesByCourse?.[code] || [];
                                        // P events: type === 'P' (Practice/Lecture)
                                        const pEvents = rows.filter((r) => r.type === 'P');
                                        // CL events: type === 'CL' (Class)
                                        const clEvents = rows.filter((r) => r.type === 'CL');
                                        // S (Seminar) events
                                        const sEvents = rows.filter((r) => r.type === 'S');
                                        if ((rows || []).length === 0) return null;
                                        const selectedSlotsForCourse = selectedSlots[code] || {};
                                        const selectedP = selectedSlotsForCourse.p || '';
                                        const selectedCL = selectedSlotsForCourse.cl || '';
                                        const selectedS = selectedSlotsForCourse.s || '';
                                        
                                        const handleSlotChange = (type, eventId) => {
                                            if (!eventId) {
                                                // Clear selection
                                                setSelectedSlots((prev) => {
                                                    const updated = { ...prev };
                                                    if (updated[code]) {
                                                        const newSlots = { ...updated[code] };
                                                        delete newSlots[type];
                                                        if (Object.keys(newSlots).length === 0) {
                                                            delete updated[code];
                                                        } else {
                                                            updated[code] = newSlots;
                                                        }
                                                    }
                                                    return updated;
                                                });
                                                return;
                                            }
                                            
                                            // Find the event being selected
                                            const event = rows.find(e => e.id === eventId);
                                            if (!event) return;
                                            
                                            // Check for time conflicts (exclude current course and slot type to allow changing selection)
                                            const conflict = checkTimeConflict(event, code, type);
                                            if (conflict.conflict) {
                                                guardedNotify('schedule-conflict', 'error', conflict.message, { 
                                                    title: 'Time conflict', 
                                                    lockMs: 4000 
                                                });
                                                return;
                                            }
                                            
                                            // Update selection
                                            setSelectedSlots((prev) => ({
                                                ...prev,
                                                [code]: {
                                                    ...(prev[code] || {}),
                                                    [type]: String(eventId),
                                                },
                                            }));
                                        };
                                        
                                        return {
                                            key: String(code),
                                            cols: [
                                                <div key="nm">
                                                    <div className="font-medium">{c?.nameEn || c?.nameSk || c?.name || code}</div>
                                                    <div className="text-xs text-muted-foreground">{code}</div>
                                                </div>,
                                                <div key="p">
                                                    {pEvents.length === 0 ? (
                                                        <div className="text-sm text-muted-foreground">—</div>
                                                    ) : (
                                                        <Select
                                                            options={[
                                                                { value: '', label: 'Select P slot...' },
                                                                ...pEvents.map((p) => ({
                                                                    value: p.id,
                                                                    label: `${p.day} ${p.start}-${p.end} • ${p.room} • ${p.teacher || '—'}`,
                                                                })),
                                                            ]}
                                                            value={selectedP}
                                                            onChange={(v) => handleSlotChange('p', String(v))}
                                                            disabled={locked}
                                                            className="min-w-[260px]"
                                                        />
                                                    )}
                                                </div>,
                                                <div key="cl">
                                                    {clEvents.length === 0 ? (
                                                        <div className="text-sm text-muted-foreground">—</div>
                                                    ) : (
                                                        <Select
                                                            options={[
                                                                { value: '', label: 'Select CL slot...' },
                                                                ...clEvents.map((cl) => ({
                                                                    value: cl.id,
                                                                    label: `${cl.day} ${cl.start}-${cl.end} • ${cl.room} • ${cl.teacher || '—'}`,
                                                                })),
                                                            ]}
                                                            value={selectedCL}
                                                            onChange={(v) => handleSlotChange('cl', String(v))}
                                                            disabled={locked}
                                                            className="min-w-[260px]"
                                                        />
                                                    )}
                                                </div>,
                                                <div key="s">
                                                    {sEvents.length === 0 ? (
                                                        <div className="text-sm text-muted-foreground">—</div>
                                                    ) : (
                                                        <Select
                                                            options={[
                                                                { value: '', label: 'Select S slot...' },
                                                                ...sEvents.map((s) => ({
                                                                    value: s.id,
                                                                    label: `${s.day} ${s.start}-${s.end} • ${s.room} • ${s.teacher || '—'}`,
                                                                })),
                                                            ]}
                                                            value={selectedS}
                                                            onChange={(v) => handleSlotChange('s', String(v))}
                                                            disabled={locked}
                                                            className="min-w-[260px]"
                                                        />
                                                    )}
                                                </div>,
                                            ],
                                        };
                                    })
                                    .filter(Boolean)}
                            />
                        </motion.div>
                    </>
                );
            case 'plan':
                return (
                    <>
                        <motion.div {...fadeIn()}>
                            <SectionHeader
                                icon="GraduationCap"
                                title="Recommended study plan"
                                subtitle={`Program ${studentProgram || '—'} • ${acad}`}
                                right={
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                                            {acad} • Year {year}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            iconName="Printer"
                                            onClick={() => {
                                                printNow('plan-print');
                                                guardedNotify('zapis-print', 'info', 'Print dialog opened', { title: 'Print', lockMs: 2400 });
                                            }}
                                        >
                                            Print
                                        </Button>
                                    </div>
                                }
                            />
                        </motion.div>

                        <motion.div id="plan-print" {...fadeIn(0.05)} className="space-y-6">
                            <div className="glass-card rounded-xl border border-border p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-foreground">Year 1 — Fall</h3>
                                    <span className="text-sm text-muted-foreground">
                                        Total credits: {planByTerm.ws.reduce((s, c) => s + creditsOf(c), 0)}
                                    </span>
                                </div>
                                <DataTable
                                    id="plan-ws"
                                    head={[
                                        { key: 'k', label: 'Code' },
                                        { key: 'n', label: 'Title' },
                                        { key: 'u', label: 'Assessment' },
                                        { key: 'kr', label: 'Credits' },
                                        { key: 't', label: 'Type' },
                                        { key: 'pp', label: 'Profile' },
                                        { key: 'r', label: 'Contact hours' },
                                        { key: 'd', label: 'Course details' },
                                    ]}
                                    rows={planByTerm.ws.map((c, i) => ({
                                        key: `${c.code}|ws|${i}`,
                                        cols: [
                                            c.code,
                                            c.name,
                                            H(c.code) % 2 === 0 ? 'Graded credit' : 'Credit and exam',
                                            c.credits,
                                            H(`${c.code}|t`) % 2 === 0 ? 'P' : 'PV',
                                            H(`${c.code}|pp`) % 3 === 0 ? 'PP' : '—',
                                            `S-${1 + (H(c.code) % 3)} CL-${1 + (H(`${c.code}|cl`) % 2)} per week`,
                                            <Button key="detail" size="xs" variant="outline" onClick={() => {}}>
                                                Details
                                            </Button>,
                                        ],
                                    }))}
                                />
                            </div>

                            <div className="glass-card rounded-xl border border-border p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-foreground">Year 1 — Spring</h3>
                                    <span className="text-sm text-muted-foreground">
                                        Total credits: {planByTerm.ss.reduce((s, c) => s + creditsOf(c), 0)}
                                    </span>
                                </div>
                                <DataTable
                                    id="plan-ss"
                                    head={[
                                        { key: 'k', label: 'Code' },
                                        { key: 'n', label: 'Title' },
                                        { key: 'u', label: 'Assessment' },
                                        { key: 'kr', label: 'Credits' },
                                        { key: 't', label: 'Type' },
                                        { key: 'pp', label: 'Profile' },
                                        { key: 'r', label: 'Contact hours' },
                                        { key: 'd', label: 'Course details' },
                                    ]}
                                    rows={planByTerm.ss.map((c, i) => ({
                                        key: `${c.code}|ss|${i}`,
                                        cols: [
                                            c.code,
                                            c.name,
                                            H(c.code) % 2 === 1 ? 'Graded credit' : 'Credit and exam',
                                            c.credits,
                                            H(`${c.code}|t2`) % 2 === 0 ? 'P' : 'PV',
                                            H(`${c.code}|pp2`) % 3 === 0 ? 'PP' : '—',
                                            `S-${1 + (H(c.code) % 3)} CL-${1 + (H(`${c.code}|cl2`) % 2)} per week`,
                                            <Button key="detail" size="xs" variant="outline" onClick={() => {}}>
                                                Details
                                            </Button>,
                                        ],
                                    }))}
                                />
                            </div>
                        </motion.div>
                    </>
                );
            case 'online':
                return (
                    <>
                        <motion.div {...fadeIn()}>
                            <SectionHeader
                                icon="ScanSearch"
                                title="Online study enrollment"
                                subtitle={acad || '—'}
                                right={
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                                            {acad} • {semester}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            iconName="Printer"
                                            onClick={() => {
                                                printNow('online-print');
                                                guardedNotify('zapis-print', 'info', 'Print dialog opened', { title: 'Print', lockMs: 2400 });
                                            }}
                                        >
                                            Print
                                        </Button>
                                        <Button
                                            size="sm"
                                            iconName="CheckCircle2"
                                            disabled={
                                                locked ||
                                                !canOnlineEnroll ||
                                                (() => {
                                                    // Check if at least one P, CL, or S slot is selected
                                                    const hasSelection = Object.entries(selectedSlots || {}).some(([, slots]) => {
                                                        if (!slots || typeof slots !== 'object') return false;
                                                        return !!(slots.p || slots.cl || slots.s);
                                                    });
                                                    return !hasSelection;
                                                })()
                                            }
                                            onClick={async () => {
                                                try {
                                                    // Build selections array from new structure
                                                    // Each course can have P, CL, and S selections
                                                    const selections = [];
                                                    const selectedCourses = [];
                                                    
                                                    for (const [courseCode, slots] of Object.entries(selectedSlots || {})) {
                                                        if (!slots || typeof slots !== 'object') continue;
                                                        
                                                        // Track selected courses
                                                        if (slots.p || slots.cl || slots.s) {
                                                            selectedCourses.push(courseCode);
                                                        }
                                                        
                                                        // Add P selection if present
                                                        if (slots.p) {
                                                            selections.push({ courseCode, scheduleEventId: slots.p });
                                                        }
                                                        // Add CL selection if present
                                                        if (slots.cl) {
                                                            selections.push({ courseCode, scheduleEventId: slots.cl });
                                                        }
                                                        // Add S (Seminar) selection if present
                                                        if (slots.s) {
                                                            selections.push({ courseCode, scheduleEventId: slots.s });
                                                        }
                                                    }
                                                    
                                                    if (selections.length === 0) {
                                                        notify('warning', 'Please select at least one P, CL, or S schedule slot', { title: 'No selection' });
                                                        return;
                                                    }
                                                    
                                                    // Validate course selection
                                                    // PV = Povinný (Mandatory), PP = Povinne voliteľný (Optional)
                                                    const pvCourses = []; // Mandatory
                                                    const ppCourses = []; // Optional
                                                    
                                                    console.log('[zapis] Validating courses:', {
                                                        selectedCourses,
                                                        allCoursesCount: allCourses?.length,
                                                        selectedSlots
                                                    });
                                                    
                                                    for (const courseCode of selectedCourses) {
                                                        // Try multiple ways to find the course
                                                        const course = allCourses.find(c => 
                                                            String(c.code || '').trim() === String(courseCode || '').trim() ||
                                                            String(c.code || '').trim().toUpperCase() === String(courseCode || '').trim().toUpperCase()
                                                        );
                                                        const courseType = (course?.typeSk || course?.type || '').trim().toUpperCase();
                                                        console.log('[zapis] Course lookup:', { 
                                                            courseCode, 
                                                            found: !!course, 
                                                            typeSk: course?.typeSk,
                                                            courseType
                                                        });
                                                        
                                                        // PV = Povinný (Mandatory)
                                                        if (courseType === 'PV') {
                                                            pvCourses.push(courseCode);
                                                        // PP = Optional
                                                        } else if (courseType === 'PP') {
                                                            ppCourses.push(courseCode);
                                                        } else if (course) {
                                                            // Unknown type - treat as optional
                                                            ppCourses.push(courseCode);
                                                        }
                                                    }
                                                    
                                                    console.log('[zapis] Course counts:', { pvCourses, ppCourses });
                                                    
                                                    // Check requirements: at least 1 course selected
                                                    const errors = [];
                                                    
                                                    const totalSelected = pvCourses.length + ppCourses.length;
                                                    if (totalSelected === 0) {
                                                        errors.push('You must select at least 1 course. Currently selected: 0');
                                                    }
                                                    
                                                    if (errors.length > 0) {
                                                        const errorMessage = errors.join('\n');
                                                        notify('warning', errorMessage, { 
                                                            title: 'Course Requirements Not Met',
                                                            duration: 8000 
                                                        });
                                                        return;
                                                    }
                                                    
                                                    // Show summary before confirmation
                                                    const summary = [
                                                        `Mandatory (PV): ${pvCourses.length} course${pvCourses.length !== 1 ? 's' : ''}`,
                                                        `Optional (PP): ${ppCourses.length} course${ppCourses.length !== 1 ? 's' : ''}`
                                                    ].join('\n');
                                                    
                                                    if (!window.confirm(`Confirm enrollment for ${semester} semester?\n\n${summary}\n\nThis action cannot be undone.`)) {
                                                        return;
                                                    }
                                                    
                                                    await confirmEnrollment({ academicYear: acad, semester, selections });
                                                    
                                                    // Invalidate caches to ensure fresh data
                                                    api.invalidateCache('/enrollments');
                                                    api.invalidateCache('/schedule/events');
                                                    
                                                    // Reload enrollments and schedules after confirmation
                                                    try {
                                                        const email = user?.email || '';
                                                        let studentId = null;
                                                        if (email) {
                                                            const studs = await fetchStudents({ q: email, page: 1, pageSize: 10 });
                                                            const me = (Array.isArray(studs) ? studs : []).find(s => (s.email||'').toLowerCase() === email.toLowerCase()) || (Array.isArray(studs) ? studs[0] : null);
                                                            studentId = me?.id || null;
                                                        }
                                                        
                                                        // Reload schedule events to show enrolled courses
                                                        const events = await fetchScheduleEvents();
                                                        const grouped = {};
                                                        const eventMap = new Map(); // Map event ID to event for quick lookup
                                                        for (const e of Array.isArray(events) ? events : []) {
                                                            const code = String(e.courseCode || '');
                                                            if (!code) continue;
                                                            const [s,e2] = String(e.slot||'').split('-');
                                                            const mapped = {
                                                                id: e.id || e.ID || e.Id || undefined,
                                                                key: `${code}|${e.day}|${e.slot}`,
                                                                courseCode: code,
                                                                day: e.day,
                                                                start: (s||'').trim(),
                                                                end: (e2||'').trim(),
                                                                room: e.room||'—',
                                                                teacher: e.teacherEmail||'',
                                                                type: (e.type || '').toString().toUpperCase(),
                                                                groups: e.classGroupKeys||[],
                                                                capacity: e.capacity||null
                                                            };
                                                            if (mapped.id) eventMap.set(mapped.id, mapped);
                                                            if (!grouped[code]) grouped[code] = [];
                                                            grouped[code].push(mapped);
                                                        }
                                                        setAllSchedulesByCourse(grouped);
                                                        
                                                        // Restore selectedSlots from confirmed enrollments using the loaded events
                                                        if (studentId) {
                                                            const list = await fetchStudentEnrollments(studentId);
                                                            const anyForTerm = (list||[]).some(e => String(e.academicYear||'') === String(acad) && String(e.semester||'').toUpperCase() === String(semester||'').toUpperCase());
                                                            if (anyForTerm) {
                                                                setLocked(true);
                                                                setLockReason('Enrollment already confirmed for this semester');
                                                                
                                                                const confirmedSlots = {};
                                                                for (const enr of list || []) {
                                                                    if (String(enr.academicYear||'') !== String(acad) || String(enr.semester||'').toUpperCase() !== String(semester||'').toUpperCase()) continue;
                                                                    if (!enr.scheduleEventId || !enr.courseCode) continue;
                                                                    
                                                                    const code = String(enr.courseCode);
                                                                    if (!confirmedSlots[code]) confirmedSlots[code] = {};
                                                                    
                                                                    // Find the event from the map to determine its type
                                                                    const event = eventMap.get(enr.scheduleEventId);
                                                                    if (event) {
                                                                        const eventType = (event.type || '').toUpperCase();
                                                                        const slotType = eventType === 'P' ? 'p' : eventType === 'CL' ? 'cl' : eventType === 'S' ? 's' : 'cl';
                                                                        confirmedSlots[code][slotType] = enr.scheduleEventId;
                                                                    }
                                                                }
                                                                setSelectedSlots(confirmedSlots);
                                                            }
                                                        }
                                                    } catch (reloadError) {
                                                        logger.error('Failed to reload data after enrollment:', reloadError);
                                                    }
                                                    
                                                    setTimeout(() => {
                                                        notify('success', 'Enrollment confirmed and saved to server', { title: 'Online enrollment' });
                                                    }, 300);
                                                    setLocked(true);
                                                    setLockReason('Enrollment confirmed');
                                                } catch (e) {
                                                    const msg = extractApiErrorMessage(e, 'Failed to confirm enrollment');
                                                    setTimeout(() => {
                                                        notify('error', msg, { title: 'Online enrollment' });
                                                    }, 100);
                                                }
                                            }}
                                        >
                                            Confirm enrollment
                                        </Button>
                                    </div>
                                }
                            />
                        </motion.div>

                        <motion.div id="online-print" {...fadeIn(0.05)} className="space-y-4">
                            <div className="glass-card rounded-xl border border-border p-4">
                                <h3 className="font-semibold mb-3">Enrollment fee decisions</h3>
                                <DataTable
                                    id="fees"
                                    head={[
                                        { key: 'd', label: 'Decision date' },
                                        { key: 'typ', label: 'Fee type' },
                                        { key: 'sum', label: 'Amount' },
                                        { key: 'due', label: 'Due date' },
                                        { key: 'cast', label: 'Installment amount' },
                                        { key: 'acc', label: 'Account number' },
                                        { key: 'vs', label: 'VS' },
                                        { key: 'ss', label: 'SS' },
                                        { key: 'uh', label: 'Paid' },
                                        { key: 'spl', label: 'Installments' },
                                    ]}
                                    rows={[
                                        {
                                            key: 'fee-1',
                                            cols: [
                                                '07/01/2025',
                                                'FEI_enrollment fee for newly admitted',
                                                `${feeAmount.toLocaleString('en-US', { minimumFractionDigits: 1 })} €`,
                                                feeDue,
                                                '33.7 €',
                                                <div key="acc">
                                                    {feeAccount}
                                                    <br />
                                                    {feeIban}
                                                </div>,
                                                feeVS,
                                                feeSS,
                                                '33.7 €',
                                                '0',
                                            ],
                                        },
                                    ]}
                                />
                            </div>

                            <div className="glass-card rounded-xl border border-border p-4">
                                <h3 className="font-semibold mb-2">Enrollment sheet</h3>
                                <div className="text-sm text-muted-foreground mb-3">
                                    Total enrolled credits overall: {
                                        confirmedEnrollmentsBySemester.fall.reduce((s, c) => s + c.credits, 0) +
                                        confirmedEnrollmentsBySemester.spring.reduce((s, c) => s + c.credits, 0)
                                    }
                                </div>

                                <div className="mb-4">
                                    <h4 className="font-semibold mb-2">Year 1 {acad || '2025/2026'} — Fall</h4>
                                    <DataTable
                                        id="zapisny-ws"
                                        head={[
                                            { key: 'p', label: 'Course' },
                                            { key: 'z', label: 'Requirement' },
                                            { key: 'k', label: 'Credits' },
                                            { key: 'u', label: 'Assessment' },
                                        ]}
                                        rows={confirmedEnrollmentsBySemester.fall.map((c, i) => ({
                                            key: `ws-${c.code}-${i}`,
                                            cols: [
                                                c.name,
                                                c.requirement,
                                                c.credits,
                                                c.assessment,
                                            ],
                                        }))}
                                    />
                                </div>

                                <div>
                                    <h4 className="font-semibold mb-2">Year 1 {acad || '2025/2026'} — Spring</h4>
                                    <DataTable
                                        id="zapisny-ss"
                                        head={[
                                            { key: 'p', label: 'Course' },
                                            { key: 'z', label: 'Requirement' },
                                            { key: 'k', label: 'Credits' },
                                            { key: 'u', label: 'Assessment' },
                                        ]}
                                        rows={confirmedEnrollmentsBySemester.spring.map((c, i) => ({
                                            key: `ss-${c.code}-${i}`,
                                            cols: [
                                                c.name,
                                                c.requirement,
                                                c.credits,
                                                c.assessment,
                                            ],
                                        }))}
                                    />
                                </div>

                                <div className="text-xs text-muted-foreground mt-4 leading-relaxed">
                                    After your enrollment is successfully confirmed at TUKE, prior obligations from previously enrolled programs will be credited in accordance
                                    with the study schedule. If anything looks off, please contact the study department.
                                </div>
                            </div>
                        </motion.div>
                    </>
                );
            default:
                return null;
        }
    };
    const dynamicSide = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    return (
        <div className="min-h-screen bg-background overflow-x-hidden zapis-zfix">
            <ZIndexFix />
            <Header userRole="student" userName={fullName} onLogout={() => {}} />
            <RoleSidebar userRole="student" isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
            <div className={`${dynamicSide} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
                <main className="flex-1">
                    <div className="px-6 pt-3 pb-6">
                        <NavigationBreadcrumb />
                        {(loadingCourses || loadingSchedules || loadingEnrollment) && (
                          <DataLoader
                            label="Preparing enrollment data…"
                            description="Gathering course catalog, schedules, and enrollment status."
                            details={[
                              'Semester course offerings • recommended paths • credits',
                              'Schedule matrices • collisions • preferred slots',
                              'Enrollment locks • historical registrations • capacity guardrails',
                            ]}
                            fullScreen
                          />
                        )}

                        <div className="glass-card rounded-xl border border-border p-3 sm:p-4 mb-4">
                            <TabBar
                                value={active}
                                onChange={setActive}
                                items={[
                                    { value: 'dashboard', label: 'Enrollment', icon: 'FileStack' },
                                    { value: 'selected', label: 'Selected courses', icon: 'ListChecks' },
                                    { value: 'schedule', label: 'Schedule enrollment', icon: 'CalendarDays' },
                                    { value: 'plan', label: 'Recommended study plan', icon: 'GraduationCap' },
                                    { value: 'online', label: 'Online study enrollment', icon: 'ScanSearch' },
                                ]}
                                className="gap-2"
                            />
                        </div>

                        

                        

                        <div className="grid xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)] gap-4 items-start">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={active}
                                    {...contentMotion}
                                    className="space-y-6 min-w-0"
                                >
                                    {renderActiveContent()}
                                </motion.div>
                            </AnimatePresence>

                            <motion.aside
                                initial={{ opacity: 0, x: 28 }}
                                animate={isBlocked ? {} : { opacity: 1, x: 0 }}
                                transition={{ duration: 0.45, delay: ANIMATION_DELAYS.SUMMARY_CARDS, ease: [0.16, 1, 0.3, 1] }}
                                className="hidden xl:block sticky top-24 space-y-4"
                            >
                                <QuickActionPanel
                                    userRole="student"
                                    className="glass-card rounded-xl border border-border bg-card/85 shadow-xl shadow-black/25"
                                    onQuickAction={undefined}
                                />
                                {lockReason && (
                                    <div className="glass-card rounded-xl border border-border px-4 py-3 text-xs text-amber-200/90 bg-amber-500/10">
                                        <div className="font-medium text-amber-300 mb-1">Enrollment locked</div>
                                        <div>{lockReason}</div>
                                    </div>
                                )}
                            </motion.aside>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: ANIMATION_DELAYS.SUMMARY_CARDS, ease: [0.16, 1, 0.3, 1] }}
                            className="xl:hidden mt-6 space-y-4"
                        >
                            <QuickActionPanel
                                userRole="student"
                                className="glass-card rounded-xl border border-border bg-card/85 shadow-lg shadow-black/25"
                                onQuickAction={undefined}
                            />
                            {lockReason && (
                                <div className="glass-card rounded-xl border border-border px-4 py-3 text-xs text-amber-200/90 bg-amber-500/10">
                                    <div className="font-medium text-amber-300 mb-1">Enrollment locked</div>
                                    <div>{lockReason}</div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </main>

                <PageFooter
                    left={[
                        'MAIS 2.0 • Student Portal',
                        lastLoginLabel,
                    ]}
                    actions={[
                        <Button key="help" variant="ghost" size="sm" iconName="HelpCircle">
                            Help
                        </Button>,
                    ]}
                    containerClassName="px-4 sm:px-6"
                />
            </div>
        </div>
    );
};

export default function ZapisPage() {
    return (
        <ToastsProvider>
            <ZapisPageInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
}