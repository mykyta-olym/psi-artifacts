// src/pages/student-studies/StudentStudies.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import {
    CURRENT_YEAR,
    ARCH_YEAR,
    KEY_CURR_WS,
    KEY_CURR_SS,
    KEY_ARCH_WS,
    KEY_ARCH_SS,
    SELECTED_STUDY_KEY,
    guessLoggedStudent,
    generateFinanceSymbols,
    buildScheduleSnapshot,
    buildStudentStudiesFromApi
} from './utils/studentStudiesUtils';
import ZIndexFix from './components/ZIndexFix';
import TabsNav from './components/TabsNav';
import OverviewView from './components/OverviewView';
import CoursesView from './components/CoursesView';
import CourseDetailsView from './components/CourseDetailsView';
import ScholarshipsView from './components/ScholarshipsView';
import FinancingView from './components/FinancingView';
import { ToastsProvider, ToastViewport } from '../../components/ui/Toasts';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import useUserPreference from '../../hooks/useUserPreference';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

const StudentStudies = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const userRole = 'student';
    const { user, userProfile } = useAuth();
    const { isBlocked } = useGlobalLoaderBlocking();
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const selectedStudyPreference = useUserPreference(SELECTED_STUDY_KEY, null);
    const selectedStudy = selectedStudyPreference.value;

    const baseStudent = useMemo(() => {
        if (user?.email) {
            return {
                id: selectedStudy?.studentId || '',
                personId: selectedStudy?.personId || '',
                fullName: user.full_name || user.email.split('@')[0],
                email: user.email,
                studyYear: userProfile?.year || 1
            };
        }
        return guessLoggedStudent();
    }, [user, userProfile, selectedStudy]);
    const displayName = useProfileDisplayName(user?.name) || user?.name || 'Student';

    // Default to current studies when selection is missing
    const isArchived = selectedStudy ? !selectedStudy.ongoing : false;
    const [term, setTerm] = useState(KEY_CURR_WS);

    useEffect(() => {
        if (selectedStudyPreference.loading) return;
        setTerm((prev) => {
            if (isArchived) {
                return prev === KEY_ARCH_SS || prev === KEY_ARCH_WS ? prev : KEY_ARCH_SS;
            }
            return prev === KEY_CURR_SS || prev === KEY_CURR_WS ? prev : KEY_CURR_WS;
        });
    }, [isArchived, selectedStudyPreference.loading]);

    useEffect(() => {
        if (isArchived && term !== KEY_ARCH_SS && term !== KEY_ARCH_WS) setTerm(KEY_ARCH_SS);
        if (!isArchived && term !== KEY_CURR_WS && term !== KEY_CURR_SS) setTerm(KEY_CURR_WS);
    }, [isArchived, term]);

    const [apiStudies, setApiStudies] = useState(null);
    useEffect(() => {
        if (selectedStudyPreference.loading) return;
        let mounted = true;
        const payload = {
            ...baseStudent,
            id: selectedStudy?.studentId || baseStudent?.id || ''
        };
            (async () => {
            try {
                const built = await buildStudentStudiesFromApi(payload);
                if (mounted) setApiStudies(built);
            } catch {
                if (mounted) setApiStudies(null);
            }
            })();
        return () => { mounted = false; };
    }, [baseStudent, selectedStudy?.studentId, selectedStudyPreference.loading]);

    // Listen for data updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        if (!payload || !payload.type) return;
        
        // Refresh on grade, enrollment, or student data updates
        if (payload.type === 'grade.updated' || payload.type === 'enrollment.updated' || payload.type === 'student.updated') {
            // Re-fetch student studies data
            const payload = {
                ...baseStudent,
                id: selectedStudy?.studentId || baseStudent?.id || ''
            };
            buildStudentStudiesFromApi(payload).then(built => {
                setApiStudies(built);
            }).catch(() => {
                // Silently fail, keep existing data
            });
        }
    }, [baseStudent, selectedStudy?.studentId]);

    useDataUpdates(handleDataUpdate);

    const studentId = useMemo(() => selectedStudy?.studentId || baseStudent?.id || '', [selectedStudy, baseStudent]);

    const studies = useMemo(() => {
        if (apiStudies) return apiStudies;
        return { courses: [], earnedCredits: 0, totalCredits: 0, gpa: 0, attendanceAvg: 0, scheduleEntries: [] };
    }, [apiStudies]);
    const finance = useMemo(() => {
        const symbols = generateFinanceSymbols(baseStudent);
        return { ...symbols, payments: [] }; // Real payments are fetched in FinancingView
    }, [baseStudent]);
    const scheduleToday = useMemo(
        () => buildScheduleSnapshot(studies.courses, studies.scheduleEntries || []),
        [studies.courses, studies.scheduleEntries]
    );

    const overviewTrend = useMemo(() => {
        // Aggregate weekly trends from all courses into a single overall trend
        const allTrends = (studies.courses || []).flatMap(c => c.weeklyTrend || []);
        if (!allTrends.length) return [];
        
        // Group by date and calculate average attendance rate
        const byDate = new Map();
        allTrends.forEach(t => {
            const key = t.date || t.id;
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key).push(t.attendanceRate);
        });
        
        return Array.from(byDate.entries())
            .map(([date, rates]) => ({
                id: date,
                date,
                attendanceRate: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [studies]);

    const facts = useMemo(() => {
        const creditsPassed = studies?.earnedCredits ?? 0;
        const creditsRequired = studies?.totalCredits ?? 0;
            return {
            program: selectedStudy?.programName || selectedStudy?.programCode || userProfile?.program || '',
            year: String(selectedStudy?.ospYear || baseStudent?.studyYear || '1'),
            term: isArchived ? 'Archived' : 'Current',
            studentNo: selectedStudy?.personId || selectedStudy?.studentId || baseStudent?.personId || baseStudent?.id || '—',
            started: '—',
            ends: '—',
            length: isArchived ? 3 : 2,
            weightedStudy: typeof studies?.gpa === 'number' && !Number.isNaN(studies.gpa) ? studies.gpa.toFixed(2) : '—',
            weightedClosed: typeof studies?.gpa === 'number' && !Number.isNaN(studies.gpa) ? studies.gpa.toFixed(2) : '—',
            creditsPassed,
            creditsRequired,
            p: creditsPassed,
            pv: Math.max(creditsRequired - creditsPassed, 0),
            v: 0,
                recognized: 0
            };
    }, [selectedStudy, baseStudent, studies, isArchived, userProfile]);

    const dynamicSide = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    useEffect(() => {
        if (!isArchived && term === KEY_CURR_SS) setTerm(KEY_CURR_WS);
    }, [isArchived, term]);

    const params = new URLSearchParams(location.search);
    const current = params.get('view') || 'overview';
    const selectedCourseId = params.get('course') || null;
    const selectedCourse = useMemo(() => studies.courses.find((c) => c.id === selectedCourseId), [selectedCourseId, studies.courses]);

    const navigateUpdate = (q) => navigate({ search: `?${q.toString()}` });

    const go = (v) => {
        const q = new URLSearchParams(location.search);
        q.set('view', v);
        q.delete('course');
        navigateUpdate(q);
    };

    const openCourse = (id) => {
        const q = new URLSearchParams(location.search);
        q.set('view', 'courses');
        q.set('course', id);
        navigateUpdate(q);
    };

    const backToCourses = () => {
        const q = new URLSearchParams(location.search);
        q.set('view', 'courses');
        q.delete('course');
        navigateUpdate(q);
    };

    useEffect(() => {
        const q = new URLSearchParams(location.search);
        const openCode = q.get('open');
        if (!openCode) return;
        const found = studies.courses.find(c => String(c.code).toUpperCase() === String(openCode).toUpperCase());
        if (!found) return;
        q.set('view', 'courses');
        q.set('course', found.id);
        q.delete('open');
        navigate({ search: `?${q.toString()}` }, { replace: true });
    }, [location.search, studies.courses, navigate]);

    return (
        <ToastsProvider>
            <div className="min-h-screen bg-background overflow-x-hidden student-studies-zfix">
                <ZIndexFix />
                <Header userRole={userRole} userName={displayName} onLogout={() => navigate('/login')} />
                <RoleSidebar userRole={userRole} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
                <div className={`${dynamicSide} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Student Studies">
                    <main className="flex-1">
                        <div className="p-4 sm:p-6">
                            <NavigationBreadcrumb />
                            <TabsNav current={current} onGo={go} />
                            {current === 'overview' && (
                                <OverviewView
                                    isArchived={isArchived}
                                    term={term}
                                    setTerm={setTerm}
                                    studies={studies}
                                    overviewTrend={overviewTrend}
                                    yearLabel={isArchived ? ARCH_YEAR : CURRENT_YEAR}
                                    scheduleToday={scheduleToday}
                                    onOpen={openCourse}
                                    facts={facts}
                                />
                            )}
                            {current === 'courses' && !selectedCourse && <CoursesView studies={studies} onOpen={openCourse} />}
                            {current === 'courses' && selectedCourse && <CourseDetailsView course={selectedCourse} onBack={backToCourses} isArchived={isArchived} />}
                            {current === 'scholarships' && <ScholarshipsView gpa={studies.gpa} studentId={studentId} />}
                            {current === 'financing' && <FinancingView finance={finance} studentId={studentId} />}
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
                        containerClassName="px-4 sm:px-6"
                    />
                </div>
                <ToastViewport position="top-right" />
            </div>
        </ToastsProvider>
    );
};

export default StudentStudies;