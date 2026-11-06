// src/pages/student-dashboard/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import { motion } from 'framer-motion';
import Reveal from '../../components/motion/Reveal';

import TodaySchedulePanel from '../teacher-dashboard/components/TodaySchedulePanel';
import RecentActivityPanel from '../teacher-dashboard/components/RecentActivityPanel';
import QuickStatsOverview from '../teacher-dashboard/components/QuickStatsOverview';
import NotificationCenter from '../teacher-dashboard/components/NotificationCenter';
import NewsPanel from '../../components/news/NewsPanel';

import { useAuth } from '../../contexts/AuthContext';
import { studentCode } from '../../utils/ids';
import { formatLastLogin } from '../../utils/datetime';
import { ANIMATION_DELAYS } from '../../constants/animations';

import WelcomeHeader from './components/WelcomeHeader';
import ArchivedStudyBanner from './components/ArchivedStudyBanner';
import MyCoursesGrid from './components/MyCoursesGrid';
import DeadlinesPanel from './components/DeadlinesPanel';

import {
    stripTitles,
    degreeShort,
    programNameFromStudy,
    buildAllWeekSchedule,
    buildStudentSchedule,
    computeStatsForStudent,
    buildMyCourses,
    buildUpcomingDeadlines
} from './utils/studentDashboardUtils';
import { fetchCourses, fetchScheduleEvents, fetchStudents, fetchStudentEnrollments, fetchStudentGrades } from '../../data/maisApiAdapter';
import api from '../../utils/apiClient';
import DataLoader from '../../components/ui/DataLoader';
import useUserPreference from '../../hooks/useUserPreference';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';

const STUDENT_ID_REGEX = /^[a-z]{2}\d{3}[a-z]{2}$/i;
const normalizeStudentId = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return STUDENT_ID_REGEX.test(trimmed) ? trimmed.toLowerCase() : '';
};

const extractProfileStudentId = (profile) => {
    if (!profile) return '';
    return normalizeStudentId(profile.studentId || profile?.student?.studentId || '');
};

const StudentDashboardInner = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
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
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const selectedStudyResult = useSelectedStudyValue();
    const selectedStudy = selectedStudyResult.value;
    const selectedStudyLoading = selectedStudyResult.loading;

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
            return;
        }
        if (user.role !== 'student') {
            navigate('/teacher-dashboard', { replace: true });
            return;
        }
        if (selectedStudyLoading) return;
        if (!selectedStudy) {
            const ret = encodeURIComponent('/student-dashboard');
            navigate(`/study-select?return=${ret}`, { replace: true });
        }
    }, [user, navigate, selectedStudy, selectedStudyLoading]);
    const isArchived = !!selectedStudy && !selectedStudy.ongoing;

    const email = user?.email || '';
    const fullNameRaw = userProfile?.full_name || user?.full_name || email.split('@')[0] || 'Student';
    const fullName = stripTitles(fullNameRaw);

    const displayYear = Number(selectedStudy?.ospYear || userProfile?.year || 1);

    const initialProfileStudentId = useMemo(() => extractProfileStudentId(userProfile), [userProfile]);
    const [studentDbId, setStudentDbId] = useState(initialProfileStudentId);
    const [displayStudentId, setDisplayStudentId] = useState(initialProfileStudentId);
    const [studentLookupAttempted, setStudentLookupAttempted] = useState(false);

    useEffect(() => {
        if (!initialProfileStudentId) return;
        setStudentDbId((prev) => (prev ? prev : initialProfileStudentId));
        setDisplayStudentId((prev) => (prev ? prev : initialProfileStudentId));
    }, [initialProfileStudentId]);

    const fallbackStudentCode = useMemo(
        () => studentCode({ email, fullName: fullNameRaw, year: String(displayYear) }).toLowerCase(),
        [email, fullNameRaw, displayYear]
    );

    const facultyLabel = selectedStudy?.faculty || userProfile?.faculty || 'FEI';
    const programLabel = programNameFromStudy(selectedStudy, userProfile?.program || 'Informatics');
    const degree = degreeShort(selectedStudy?.programCode);
    const subtitle = `${facultyLabel} • ${programLabel}${degree ? ` (${degree})` : ''} • Year ${displayYear} • Student ID: ${displayStudentId || '—'}`;

    const [events, setEvents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [cohortSize, setCohortSize] = useState(0);
    const [enrollments, setEnrollments] = useState([]);
    const [grades, setGrades] = useState([]);
    const [studentFromDb, setStudentFromDb] = useState(null); // Store full student data from DB

    const studentRaw = useMemo(
        () => ({
            id: (displayStudentId || fallbackStudentCode).toLowerCase(),
            email,
            faculty: facultyLabel,
            program: programLabel,
            studyYear: displayYear,
            fullName,
            className: studentFromDb?.className || studentFromDb?.class || '' // Add className from DB
        }),
        [displayStudentId, fallbackStudentCode, email, facultyLabel, programLabel, displayYear, fullName, studentFromDb]
    );
    const [loadingBootstrap, setLoadingBootstrap] = useState(true);
    const [loadingEnrollments, setLoadingEnrollments] = useState(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoadingBootstrap(true);
        (async () => {
            try {
                const [crs, ev, studs] = await Promise.all([
                    fetchCourses(),
                    fetchScheduleEvents(),
                    fetchStudents({ q: email, page: 1, pageSize: 50 }),
                ]);
                if (!mounted) return;
                setCourses(Array.isArray(crs) ? crs : []);
                setEvents(Array.isArray(ev) ? ev : []);
                const me = (Array.isArray(studs) ? studs : []).find((s) => (s.email || '').toLowerCase() === (email || '').toLowerCase())
                    || (Array.isArray(studs) ? studs[0] : null);
                setStudentFromDb(me); // Store full student data
                // Always use PersonId as primary identifier for enrollments
                // PersonId is the actual student ID (e.g., "kb079if"), while id might be a composite like "kb079if-bc"
                const personId = me?.personId || '';
                const personIdNormalized = normalizeStudentId(personId);
                // Use PersonId if available (even if it doesn't match format), otherwise fallback to id
                // Priority: 1) PersonId (normalized if matches format), 2) PersonId as-is, 3) id
                const dbId = personIdNormalized || (personId ? personId.toLowerCase() : '') || me?.id || '';
                console.log('[student-dashboard] Setting studentDbId (using PersonId as primary):', {
                    dbId,
                    personId: me?.personId,
                    id: me?.id,
                    personIdNormalized,
                    idNormalized: normalizeStudentId(me?.id || '')
                });
                setStudentDbId(dbId);
                if (personIdNormalized) {
                    setDisplayStudentId(personIdNormalized);
                } else if (personId) {
                    // If personId exists but doesn't match format, use it anyway (might be valid but different format)
                    setDisplayStudentId(personId.toLowerCase());
                }
                // Fetch students by year to get cohort size
                // Use includeTotal to get X-Total-Count header from API
                const yearParam = Number(studentRaw.studyYear);
                if (!Number.isFinite(yearParam) || yearParam <= 0) {
                    if (mounted) setCohortSize(0);
                    return;
                }
                const studsByYearResult = await fetchStudents({ year: yearParam, page: 1, pageSize: 1000 }, { includeTotal: true });
                if (!mounted) return;
                // Extract total from result object
                let totalCount = 0;
                if (studsByYearResult && typeof studsByYearResult === 'object' && !Array.isArray(studsByYearResult)) {
                    if ('total' in studsByYearResult && Number.isFinite(studsByYearResult.total)) {
                        totalCount = Math.max(0, studsByYearResult.total);
                    } else if (Array.isArray(studsByYearResult.items)) {
                        totalCount = studsByYearResult.items.length;
                    }
                } else if (Array.isArray(studsByYearResult)) {
                    totalCount = studsByYearResult.length;
                }
                setCohortSize(totalCount);
            } catch (error) {
                if (mounted) {
                    setCourses([]);
                    setEvents([]);
                    setCohortSize(0);
                }
            } finally {
                if (mounted) {
            setStudentLookupAttempted(true);
                    setLoadingBootstrap(false);
                }
            }
        })();
        return () => { mounted = false; };
    }, [studentRaw.studyYear, email]);

    useEffect(() => {
        if (!studentLookupAttempted) return;
        if (displayStudentId) return;
        setDisplayStudentId(fallbackStudentCode);
    }, [studentLookupAttempted, displayStudentId, fallbackStudentCode]);

    // Load enrollments once we know the DB student id
    const loadEnrollments = React.useCallback(async () => {
        if (!studentDbId) {
            console.log('[student-dashboard] loadEnrollments skipped: no studentDbId');
            setEnrollments([]);
            setGrades([]);
            setLoadingEnrollments(false);
            return;
        }
        console.log('[student-dashboard] loadEnrollments called with studentDbId:', studentDbId);
        setLoadingEnrollments(true);
        try {
            // Invalidate cache to ensure fresh data
            api.invalidateCache(`/enrollments/${studentDbId}`);
            api.invalidateCache('/enrollments');
            // Try to fetch enrollments with studentDbId, but also try with studentFromDb.id if different
            let list = await fetchStudentEnrollments(studentDbId);
            // If no enrollments found and we have a different id, try with that
            if ((!list || list.length === 0) && studentFromDb?.id && studentFromDb.id !== studentDbId) {
                console.log('[student-dashboard] No enrollments found with studentDbId, trying with studentFromDb.id:', studentFromDb.id);
                api.invalidateCache(`/enrollments/${studentFromDb.id}`);
                list = await fetchStudentEnrollments(studentFromDb.id);
            }
            const enrollmentsArray = Array.isArray(list) ? list : [];
            console.log('[student-dashboard] Loaded enrollments:', {
                studentDbId,
                count: enrollmentsArray.length,
                enrollments: enrollmentsArray.map(e => ({
                    courseCode: e.courseCode || e.code,
                    scheduleEventId: e.scheduleEventId || e.scheduleEventID || e.schedule_event_id,
                    academicYear: e.academicYear,
                    semester: e.semester,
                    fullEnrollment: e // Log full enrollment for debugging
                })),
                eventsCount: events?.length || 0,
                eventsCourseCodes: Array.from(new Set((events || []).map(e => e.courseCode || e.code).filter(Boolean)))
            });
            setEnrollments(enrollmentsArray);
            const gs = await fetchStudentGrades(studentDbId);
            setGrades(Array.isArray(gs) ? gs : []);
        } catch (e) {
            console.error('[student-dashboard] Error loading enrollments:', e);
            setEnrollments([]);
            setGrades([]);
        } finally {
            setLoadingEnrollments(false);
        }
    }, [studentDbId, studentFromDb]);
    
    useEffect(() => {
        loadEnrollments();
    }, [loadEnrollments]);
    
    // Listen for data updates via SignalR
    const handleDataUpdate = React.useCallback((payload) => {
        if (!payload?.type) return;
        
        console.log('[student-dashboard] Data update received', payload);
        
        // Reload enrollments and grades on enrollment/grade updates
        if (payload.type === 'enrollment.updated' || payload.type === 'grade.updated') {
            // Check if this update is for the current student
            // Compare both studentDbId and personId, as backend might send either
            const payloadStudentId = String(payload.studentId || '').trim().toLowerCase();
            const currentStudentDbId = String(studentDbId || '').trim().toLowerCase();
            const currentPersonId = String(studentFromDb?.personId || '').trim().toLowerCase();
            const currentId = String(studentFromDb?.id || '').trim().toLowerCase();
            
            // Also check if payloadStudentId matches any part of currentId (e.g., "kb079if-ing" vs "kb079if")
            const currentIdParts = currentId.split('-');
            const payloadMatchesIdPart = currentIdParts.some(part => part === payloadStudentId);
            
            const isForCurrentStudent = !payloadStudentId || // If no studentId in payload, reload for all
                                       payloadStudentId === currentStudentDbId ||
                                       payloadStudentId === currentPersonId ||
                                       payloadStudentId === currentId ||
                                       payloadMatchesIdPart ||
                                       (payloadStudentId && currentStudentDbId && payloadStudentId === currentStudentDbId);
            
            console.log('[student-dashboard] Enrollment update check:', {
                payloadType: payload.type,
                payloadStudentId,
                currentStudentDbId,
                currentPersonId,
                currentId,
                currentIdParts,
                payloadMatchesIdPart,
                isForCurrentStudent,
                payloadFull: payload
            });
            
            if (isForCurrentStudent || !payloadStudentId) {
                console.log('[student-dashboard] Reloading enrollments due to enrollment/grade update', {
                    payloadType: payload.type,
                    payloadStudentId,
                    currentStudentDbId,
                    isForCurrentStudent
                });
                // Reload enrollments first, then schedule events
                (async () => {
                    try {
                        // Force reload enrollments
                        console.log('[student-dashboard] Calling loadEnrollments...');
                        await loadEnrollments();
                        // Wait a bit for enrollments to load, then reload schedule events
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Invalidate cache and reload schedule events
                        console.log('[student-dashboard] Reloading schedule events...');
                        api.invalidateCache('/schedule/events');
                        const events = await fetchScheduleEvents();
                        console.log('[student-dashboard] Reloaded schedule events after enrollment:', {
                            eventsCount: events?.length || 0,
                            events: Array.isArray(events) ? events.slice(0, 10).map(e => ({
                                id: e.id,
                                courseCode: e.courseCode || e.code,
                                day: e.day,
                                type: e.type
                            })) : []
                        });
                        setEvents(Array.isArray(events) ? events : []);
                    } catch (e) {
                        console.error('[student-dashboard] Error reloading schedule events:', e);
                    }
                })();
                // Also reload student data to get updated className
                (async () => {
                    try {
                        if (email) {
                            const studs = await fetchStudents({ q: email, page: 1, pageSize: 10 });
                            const me = (Array.isArray(studs) ? studs : []).find(s => (s.email||'').toLowerCase() === email.toLowerCase()) || (Array.isArray(studs) ? studs[0] : null);
                            if (me) {
                                console.log('[student-dashboard] Reloaded student data:', { id: me.id, personId: me.personId, className: me.className });
                                setStudentFromDb(me);
                                // Update studentDbId if personId is available and valid
                                const personId = normalizeStudentId(me?.personId || '');
                                const idFromId = normalizeStudentId(me?.id || '');
                                const canonicalId = personId || idFromId;
                                if (canonicalId && canonicalId !== studentDbId) {
                                    const dbId = canonicalId || (me?.personId && !normalizeStudentId(me.personId) ? me.personId.toLowerCase() : '') || me?.id || '';
                                    setStudentDbId(dbId);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[student-dashboard] Error reloading student data:', e);
                        guardedNotify('student-dashboard-reload-error', 'error', 'Failed to reload student data', { title: 'Error' });
                    }
                })();
            }
        }
        
        // Reload schedule events on schedule updates
        if (payload.type === 'schedule.updated') {
            console.log('[student-dashboard] Reloading schedule events due to schedule update');
            (async () => {
                try {
                    api.invalidateCache('/schedule/events');
                    const events = await fetchScheduleEvents();
                    console.log('[student-dashboard] Reloaded schedule events:', events?.length || 0);
                    setEvents(Array.isArray(events) ? events : []);
                } catch (e) {
                    console.error('[student-dashboard] Error reloading schedule events:', e);
                    guardedNotify('student-dashboard-schedule-reload-error', 'error', 'Failed to reload schedule events', { title: 'Error' });
                }
            })();
        }
    }, []); // Empty dependencies - all data fetched inline
    
    useDataUpdates(handleDataUpdate);

    useEffect(() => {
        if (!loadingBootstrap && !loadingEnrollments) {
            // Mark as complete only once, never reset
            if (!initialLoadComplete) {
                setInitialLoadComplete(true);
            }
        }
    }, [loadingBootstrap, loadingEnrollments, initialLoadComplete]);

    const weekSchedule = useMemo(() => {
        const result = buildAllWeekSchedule(studentRaw, events, courses, enrollments);
        console.log('[student-dashboard] weekSchedule computed:', {
            eventsCount: events?.length || 0,
            enrollmentsCount: enrollments?.length || 0,
            weekScheduleCount: result?.length || 0
        });
        return result;
    }, [studentRaw, events, courses, enrollments]);
    
    const todaySchedule = useMemo(() => {
        const result = buildStudentSchedule(studentRaw, events, courses, enrollments);
        console.log('[student-dashboard] todaySchedule computed:', {
            eventsCount: events?.length || 0,
            enrollmentsCount: enrollments?.length || 0,
            todayScheduleCount: result?.length || 0,
            result: result?.slice(0, 3).map(e => ({ subject: e.subject, day: e.day, startTime: e.startTime }))
        });
        return result;
    }, [studentRaw, events, courses, enrollments]);
    const quickStats = useMemo(() => computeStatsForStudent(studentRaw, weekSchedule, cohortSize), [studentRaw, weekSchedule, cohortSize]);

    const myCourses = useMemo(() => {
        // Map confirmed enrollments to grid cards; if no enrollment => empty list
        if (!Array.isArray(enrollments) || enrollments.length === 0) return [];
        const byCode = new Map();
        (courses || []).forEach(c => byCode.set(String(c.code||c.id), c));
        const gradeByCourse = new Map((grades||[]).map(g => [String(g.courseCode), g]));
        const cards = [];
        enrollments.forEach(en => {
            const code = String(en.courseCode || en.code || '').trim(); if (!code) return;
            const c = byCode.get(code);
            const id = `${code}`;
            const g = gradeByCourse.get(code) || null;
            const pct = Number.isFinite(g?.totalPercent) ? Math.max(0, Math.min(100, Math.round(g.totalPercent))) : 0;
            const letter = (g?.letterGrade && typeof g.letterGrade === 'string') ? g.letterGrade : '';
            cards.push({
                id,
                code,
                name: c?.nameEn || c?.nameSk || code,
                credits: c?.credits ?? 0,
                progress: pct,
                currentGrade: pct,
                letter,
                completion: c?.completionSk || en?.completion || '',
                profile: c?.profile || '',
            });
        });
        // de-duplicate by code in case
        const seen = new Set();
        return cards.filter(it => { if (seen.has(it.code)) return false; seen.add(it.code); return true; });
    }, [enrollments, courses, grades]);
    // Deadlines will be empty until we have real assignment data from API
    const deadlines = useMemo(() => buildUpcomingDeadlines(studentRaw, enrollments, []), [studentRaw, enrollments]);

    const handleLogout = () => {
        navigate('/');
    };

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Header userRole="student" userName={fullName} onLogout={handleLogout} />
            <RoleSidebar
                userRole="student"
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Student dashboard">
                <main className="flex-1">
                    <div className="p-6">
                        <NavigationBreadcrumb />
                        {(!initialLoadComplete && (loadingBootstrap || loadingEnrollments)) && (
                          <DataLoader
                            label="Preparing your study dashboard…"
                            description="Fetching courses, schedule, and academic stats."
                            details={[
                              'Course catalogue • personal timetable • cohort peers',
                              'Enrollment history • credit summary • grade timeline',
                              'Upcoming deadlines and notification center refresh',
                            ]}
                            fullScreen
                          />
                        )}
                        {!isArchived ? (
                            <>
                                <Reveal as={motion.div} variant="keycap" delay={ANIMATION_DELAYS.HERO} waitForLoaders={true}>
                                <WelcomeHeader
                                    fullName={fullName}
                                    subtitle={subtitle}
                                    currentTime={currentTime}
                                    onViewSchedule={() => {
                                        document.querySelector('#today-schedule-title')?.scrollIntoView({ behavior: 'auto', block: 'start' });
                                    }}
                                />
                                </Reveal>

                                <Reveal as={motion.div} variant="keycap" className="mb-6" delay={ANIMATION_DELAYS.SUMMARY_CARDS} waitForLoaders={true}>
                                    <QuickStatsOverview statsData={quickStats} />
                                </Reveal>

                                <Reveal as={motion.section} variant="keycap" className="mb-6" aria-labelledby="quick-actions-title" delay={ANIMATION_DELAYS.FILTERS} waitForLoaders={true}>
                                    <h2 id="quick-actions-title" className="sr-only">Quick Actions</h2>
                                    <QuickActionPanel userRole="student" onQuickAction={() => {}} />
                                </Reveal>

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                                    <Reveal as={motion.div} variant="keycap" className="xl:col-span-2 space-y-6" delay={ANIMATION_DELAYS.SIDEBAR_PANEL} waitForLoaders={true}>
                                        <Reveal variant="pop" delay={ANIMATION_DELAYS.SIDEBAR_PANEL + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                                            <MyCoursesGrid courses={myCourses} />
                                        </Reveal>
                                        <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT} waitForLoaders={true}>
                                            <TodaySchedulePanel scheduleData={todaySchedule} />
                                        </Reveal>
                                    </Reveal>

                                    <Reveal as={motion.div} variant="slideScale" className="space-y-6 xl:sticky xl:top-20 self-start" delay={ANIMATION_DELAYS.MAIN_CONTENT} waitForLoaders={true}>
                                        <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP} waitForLoaders={true}>
                                            <DeadlinesPanel deadlines={deadlines} onOpenAll={() => navigate('/terminy?tab=register')} />
                                        </Reveal>
                                        <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP * 2} waitForLoaders={true}>
                                            <NotificationCenter />
                                        </Reveal>
                                        <Reveal variant="keycap" delay={ANIMATION_DELAYS.MAIN_CONTENT + ANIMATION_DELAYS.STEP * 3} waitForLoaders={true}>
                                            <NewsPanel canEdit={false} />
                                        </Reveal>
                                    </Reveal>
                                </div>

                                <Reveal as={motion.section} variant="keycap" className="mb-6" aria-labelledby="recent-activity-title" delay={ANIMATION_DELAYS.ACTIVITY} waitForLoaders={true}>
                                    <h2 id="recent-activity-title" className="sr-only">Recent Activity</h2>
                                    <RecentActivityPanel />
                                </Reveal>
                            </>
                        ) : (
                            <>
                                <Reveal as={motion.div} variant="keycap" delay={ANIMATION_DELAYS.HERO} waitForLoaders={true}>
                                <WelcomeHeader
                                    fullName={fullName}
                                    subtitle={subtitle}
                                    currentTime={currentTime}
                                    onViewSchedule={() => {}}
                                />
                                </Reveal>
                                <Reveal as={motion.div} variant="keycap" delay={ANIMATION_DELAYS.SUMMARY_CARDS} waitForLoaders={true}>
                                <ArchivedStudyBanner onOpenSelection={() => navigate('/study-select?reset=1')} />
                                </Reveal>
                            </>
                        )}
                    </div>
                </main>

                <PageFooter
                    left={[
                        'MAIS 2.0 • Student Portal',
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
        </div>
    );
};

const StudentDashboard = () => {
    return (
        <ToastsProvider>
            <StudentDashboardInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default StudentDashboard;