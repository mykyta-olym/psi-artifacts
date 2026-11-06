// src/pages/anketa/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import DataLoader from '../../components/ui/DataLoader';
import QuickActionPanel from '../../components/ui/QuickActionPanel';

import { useAuth } from '../../contexts/AuthContext';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import useDataUpdates from '../../hooks/useDataUpdates';
import useSurveysHub from '../../hooks/useSurveysHub';

import AnketaStyles from './components/styles';
import { Metric } from './components/ui';
import { H, pct, nowISO, endOfDayLocal, parseLocalDate, isWindowOpen, toSlug, formatRelativeTime } from './utils/utils';
import { readDefs, writeDefs, loadEntry, saveEntry, clearEntry, addResponse, getResponses, getResponsesSync, isAnketaStorageHydrated } from './components/storage';
import { seedSurveys } from './components/seeders';
import FiltersBarStudent from './components/filters';
import { SurveyCardStudent, TeacherManageCard } from './components/cards';
import AnalyticsBlock from './components/analytics';
import { SurveyModal, SurveyBuilderModal, ResponseDetailModal } from './components/modals';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { formatLastLogin } from '../../utils/datetime';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import TabBar from '../../components/ui/TabBar';
import AppIcon from '../../components/AppIcon';
import useUserPreference from '../../hooks/useUserPreference';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';

import { createLogger } from '../../utils/logger';
const logger = createLogger('index');

const BREADCRUMB_ANCHORS = {
    analytics: 'analytics'
};

const StudentEmptyStudy = ({ role, baseName, goSelectStudy, dynamicSideMargin, isSidebarCollapsed, onToggleSidebar }) => (
    <div className="min-h-screen bg-background overflow-x-hidden anketa-zfix">
        <AnketaStyles />
        <Header userRole={role} userName={baseName} onLogout={() => {}} />
        <RoleSidebar userRole={role} isCollapsed={isSidebarCollapsed} onToggleCollapse={onToggleSidebar} />
        <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
            <main className="flex-1">
                <div className="mt-8 flex items-center justify-center px-4 py-12">
                    <div className="max-w-lg w-full text-center bg-card border border-border rounded-xl p-6">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                            <span className="text-sm font-medium">📚</span>
                        </div>
                        <h1 className="text-xl font-bold mb-1">Select a study to continue</h1>
                        <p className="text-sm text-muted-foreground mb-5">You need to pick a study program before accessing surveys.</p>
                        <Button onClick={goSelectStudy} iconName="ChevronRight">Choose study</Button>
                    </div>
                </div>
            </main>
        </div>
    </div>
);

const AnketaPageInner = () => {
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
    const toastGuardsRef = useRef({});
    const guardedNotify = useCallback(
        (key, type, message, opts = {}) => {
            if (key) {
                const now = Date.now();
                const lockMs = opts.lockMs ?? 3200;
                const prev = toastGuardsRef.current[key] ?? 0;
                if (now - prev < lockMs) return;
                toastGuardsRef.current[key] = now;
            }
            notify(type, message, opts);
        },
        [notify]
    );
    const navigate = useNavigate();
    const { user, userProfile } = useAuth() || {};
    const role = (userProfile?.role || user?.role || 'student').toLowerCase();
    const isTeacher = role === 'teacher';
    const baseName = useProfileDisplayName(userProfile?.full_name || user?.full_name || user?.email?.split('@')[0] || (isTeacher ? 'Teacher' : 'Student'));
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    // lsTick must be declared before useEffect that uses it
    const [lsTick, setLsTick] = useState(0);
    useEffect(() => {
        const onHydrated = () => setLsTick((t) => t + 1);
        const onUpdated = () => setLsTick((t) => t + 1);
        window.addEventListener('anketa:storage:hydrated', onHydrated);
        window.addEventListener('anketa:storage:updated', onUpdated);
        return () => {
            window.removeEventListener('anketa:storage:hydrated', onHydrated);
            window.removeEventListener('anketa:storage:updated', onUpdated);
        };
    }, []);

    const ensureDefsOnce = useRef(false);
    // Note: Seed logic removed - backend hydration in storage.jsx handles initial data loading
    
    // Track if initial load is complete
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    const { value: selectedStudy, loading: selectedStudyLoading } = useSelectedStudyValue();
    const isArchived = !!selectedStudy && !selectedStudy.ongoing;
    const goSelectStudy = () => navigate(`/study-selection?return=${encodeURIComponent('/anketa')}`);

    // All hooks must be called before any conditional returns
    const [defs, setDefs] = useState([]);
    const [loadingSurveys, setLoadingSurveys] = useState(true);
    
    // Load surveys from backend on mount
    useEffect(() => {
        let mounted = true;
        
        const loadSurveys = async () => {
            setLoadingSurveys(true);
            try {
                const surveys = await readDefs();
                if (mounted) {
                    setDefs(surveys);
                    setInitialLoadComplete(true);
                }
            } catch (error) {
                console.error('[anketa] Failed to load surveys:', error);
                if (mounted) {
                    setDefs([]);
                }
            } finally {
                if (mounted) {
                    setLoadingSurveys(false);
                }
            }
        };

        loadSurveys();
        
        return () => {
            mounted = false;
        };
    }, [lsTick]);

    // Listen for data updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        if (!payload || !payload.type) return;
        
        // Refresh surveys on survey-related updates
        if (payload.type === 'survey.updated' || payload.type === 'survey.created' || payload.type === 'survey.deleted') {
            logger.debug('Survey update received via SignalR:', payload);
            // Trigger re-fetch by incrementing lsTick
            setLsTick((t) => t + 1);
        }
    }, []);

    useDataUpdates(handleDataUpdate);

    // Dedicated SurveysHub for real-time survey updates
    useSurveysHub({
        onSurveyCreated: useCallback(() => {
            logger.debug('Survey created via SurveysHub');
            setLsTick((t) => t + 1);
        }, []),
        onSurveyUpdated: useCallback(() => {
            logger.debug('Survey updated via SurveysHub');
            setLsTick((t) => t + 1);
        }, []),
        onSurveyDeleted: useCallback(() => {
            logger.debug('Survey deleted via SurveysHub');
            setLsTick((t) => t + 1);
        }, []),
        onSurveyResponseReceived: useCallback((payload) => {
            logger.debug('Survey response received via SurveysHub:', payload);
            if (role === 'teacher') {
                // Reload to show new response
                setLsTick((t) => t + 1);
            }
        }, [role])
    });

    const allForStudent = useMemo(() => {
        const list = (defs || []).filter(s => s.published);
        return list.map(s => {
            const entry = loadEntry(s.id);
            const open = isWindowOpen(s.openAt, s.closeAt);
            // Use hasResponded from backend if available, otherwise check local entry
            const hasSubmitted = s.hasResponded !== undefined ? s.hasResponded : !!entry?.submittedAt;
            const status = hasSubmitted ? 'submitted' : (open ? 'open' : 'closed');
            const answers = entry?.draft || {};
            const questions = Array.isArray(s.questions) ? s.questions : [];
            const required = questions.filter(q => q.required !== false).length;
            const answered = questions.filter(q => q.required !== false && !!answers[q.id]).length;
            const progress = pct(answered, required);
            // hasDraft is true if there's an entry with updatedAt (saved draft) and not submitted
            const hasDraftEntry = !hasSubmitted && !!entry?.updatedAt;
            return {
                ...s,
                status,
                progress,
                answered,
                required,
                hasDraft: hasDraftEntry,
                updatedAt: entry?.updatedAt || null,
                submittedAt: entry?.submittedAt || null,
            };
        });
    }, [defs, lsTick]);

    const draftStudent = useMemo(() => {
        return allForStudent.filter((s) => s.status !== 'submitted' && s.hasDraft);
    }, [allForStudent]);
    const countsStudent = useMemo(() => {
        const open = allForStudent.filter(s => s.status === 'open').length;
        const submitted = allForStudent.filter(s => s.status === 'submitted').length;
        const closed = allForStudent.filter(s => s.status === 'closed').length;
        return { open, submitted, closed, total: allForStudent.length };
    }, [allForStudent]);

    const [filters, setFilters] = useState({ category: 'all', status: 'all', search: '' });
    const filteredStudent = useMemo(() => {
        return allForStudent.filter(s => {
            if (filters.category !== 'all' && s.category !== filters.category) return false;
            if (filters.status !== 'all' && s.status !== filters.status) return false;
            if (filters.search) {
                const q = filters.search.trim().toLowerCase();
                const blob = `${s.title} ${s.meta?.courseName || ''} ${s.meta?.teacher || ''}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }
            return true;
        });
    }, [allForStudent, filters]);

    const openStudent = useMemo(() => filteredStudent.filter((s) => s.status === 'open'), [filteredStudent]);
    const draftStudentSorted = useMemo(() => draftStudent.slice().sort((a, b) => ((b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0))), [draftStudent]);
    const submittedStudent = useMemo(() => allForStudent.filter((s) => s.status === 'submitted'), [allForStudent]);
    const closedStudent = useMemo(() => allForStudent.filter((s) => s.status === 'closed'), [allForStudent]);

    const draftCount = useMemo(() => draftStudent.length, [draftStudent]);

    const closingSoonStudent = useMemo(() => {
        const now = new Date();
        const inThreeDays = 3 * 24 * 60 * 60 * 1000;
        return openStudent.filter((s) => {
            const end = endOfDayLocal(s.closeAt);
            if (!end) return false;
            const diff = end.getTime() - now.getTime();
            return diff >= 0 && diff <= inThreeDays;
        }).sort((a, b) => {
            const endA = endOfDayLocal(a.closeAt)?.getTime() || Infinity;
            const endB = endOfDayLocal(b.closeAt)?.getTime() || Infinity;
            return endA - endB;
        });
    }, [openStudent]);

    const [activeSurvey, setActiveSurvey] = useState(null);
    const [previewReadOnly, setPreviewReadOnly] = useState(false);
    const [tab, setTab] = useState(isTeacher ? 'manage' : 'surveys');
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderDraft, setBuilderDraft] = useState(null);
    const [selectedSurveyId, setSelectedSurveyId] = useState('');
    const [responseModalOpen, setResponseModalOpen] = useState(false);
    const [responseModalItem, setResponseModalItem] = useState(null);
    const [respFilters, setRespFilters] = useState({ q: '', from: '', to: '', sort: 'new' });
    const [respPage, setRespPage] = useState(1);
    const [studentTab, setStudentTab] = useState('available');
    const [studentInsightsSurveyId, setStudentInsightsSurveyId] = useState('__all__');
    const importInputRef = useRef(null);

    const teacherCounts = useMemo(() => {
        // Only count surveys owned by current teacher (exclude system/other teachers' surveys)
        const mine = (defs || []).filter(d => d.ownerId === user?.id);
        const open = mine.filter(s => isWindowOpen(s.openAt, s.closeAt) && s.published).length;
        const upcoming = mine.filter(s => {
            const start = parseLocalDate(s.openAt);
            return s.published && start && start.getTime() > new Date().getTime();
        }).length;
        const archived = mine.filter(s => {
            const end = endOfDayLocal(s.closeAt);
            return (!s.published) || (end && end.getTime() < new Date().getTime());
        }).length;
        const totalSub = mine.reduce((acc, s) => {
            const responses = getResponsesSync(s.id);
            return acc + (Array.isArray(responses) ? responses.length : 0);
        }, 0);
        return { open, upcoming, archived, total: mine.length, totalSub };
    }, [defs, lsTick, user?.id]);

    const teacherSurveyAnalytics = useMemo(() => {
        // Only show analytics for surveys owned by current teacher
        const mine = (defs || []).filter(d => d.ownerId === user?.id);
        return mine.map((s, idx) => {
            const responsesForSurvey = getResponsesSync(s.id) || [];
            const responsesCount = responsesForSurvey.length;
            const expected = Number(s.meta?.expectedResponses || s.meta?.participants || s.meta?.studentsCount || 40);
            const open = Boolean(s.published) && isWindowOpen(s.openAt, s.closeAt);
            const closed = !open;
            const status = responsesCount > 0 ? 'submitted' : (open ? 'open' : 'closed');
            const progress = Math.max(0, Math.min(100, Math.round((responsesCount / Math.max(1, expected)) * 100)));
            return {
                id: s.id || `survey-${idx}`,
                title: s.title || `Survey ${idx + 1}`,
                status,
                category: s.category || s.meta?.category || 'uncategorized',
                progress,
                openAt: s.openAt,
                closeAt: s.closeAt,
                responsesCount,
            };
        });
    }, [defs, lsTick, user?.id]);

    // Filter surveys owned by current teacher for UI display
    const teacherSurveys = useMemo(() => {
        return (defs || []).filter(d => d.ownerId === user?.id);
    }, [defs, user?.id]);

    const selectedSurvey = useMemo(() => defs.find(x => x.id === selectedSurveyId) || null, [defs, selectedSurveyId]);
    const selectedResponses = useMemo(() => selectedSurvey ? getResponsesSync(selectedSurvey.id) : [], [selectedSurvey, lsTick]);
    const filteredResponses = useMemo(() => {
        let list = selectedResponses || [];
        if (respFilters.q) {
            const q = respFilters.q.trim().toLowerCase();
            list = list.filter(r => (r.name || '').toLowerCase().includes(q));
        }
        if (respFilters.from) {
            const from = new Date(respFilters.from);
            list = list.filter(r => new Date(r.submittedAt || 0) >= from);
        }
        if (respFilters.to) {
            const to = new Date(respFilters.to);
            to.setHours(23, 59, 59, 999);
            list = list.filter(r => new Date(r.submittedAt || 0) <= to);
        }
        if (respFilters.sort === 'old') {
            list = list.slice().sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
        } else {
            list = list.slice().sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
        }
        return list;
    }, [selectedResponses, respFilters]);

    const studentInsightsSurvey = useMemo(() => {
        if (studentInsightsSurveyId === '__all__') return null;
        return defs.find(x => x.id === studentInsightsSurveyId) || null;
    }, [defs, studentInsightsSurveyId]);

    const studentInsightsResponses = useMemo(() => {
        return studentInsightsSurvey ? getResponsesSync(studentInsightsSurvey.id) : [];
    }, [studentInsightsSurvey, lsTick]);

    const notifications = useMemo(() => [], []);

    const studentActionTiles = useMemo(() => {
        const tiles = [];
        if (openStudent.length > 0) {
            tiles.push({ id: 'open', title: 'Available surveys', label: 'Available surveys', value: openStudent.length, helper: openStudent.length ? 'Complete open surveys to stay up to date.' : 'No active surveys right now.', icon: 'ClipboardList' });
        }
        if (draftCount > 0) {
            tiles.push({ id: 'drafts', title: 'Drafts pending', label: 'Drafts pending', value: draftCount, helper: draftCount ? `Last saved ${formatRelativeTime(draftStudentSorted[0]?.updatedAt, 'recently')}` : 'No drafts waiting for submission.', icon: 'FileClock' });
        }
        if (closingSoonStudent.length > 0) {
            tiles.push({ id: 'closing', title: 'Closing soon', label: 'Closing soon', value: closingSoonStudent.length, helper: closingSoonStudent.length ? `${closingSoonStudent[0]?.title || 'Survey'} closes ${closingSoonStudent[0]?.closeAt || 'soon'}` : 'All deadlines are in check.', icon: 'Timer' });
        }
        if (submittedStudent.length > 0) {
            tiles.push({ id: 'submitted', title: 'Submitted surveys', label: 'Submitted surveys', value: submittedStudent.length, helper: submittedStudent.length ? 'Great job! Review insights anytime.' : 'No submissions yet.', icon: 'CheckCircle2' });
        }
        return tiles;
    }, [openStudent, draftCount, draftStudentSorted, closingSoonStudent, submittedStudent]);

    useEffect(() => {
        // Use startTransition to avoid setState during render
        startTransition(() => {
            setRespPage(1);
        });
    }, [respFilters, selectedSurveyId]);
    useEffect(() => {
        if (responseModalItem) {
            // Use startTransition to avoid setState during render
            startTransition(() => {
                setResponseModalOpen(true);
            });
        }
    }, [responseModalItem]);
    useEffect(() => {
        if (!responseModalOpen && responseModalItem) {
            // Use startTransition to avoid setState during render
            startTransition(() => {
                setResponseModalItem(null);
            });
        }
    }, [responseModalOpen, responseModalItem]);
    useEffect(() => {
        const sync = () => {
            // Use startTransition to avoid setState during render
            startTransition(() => {
                setIsSidebarCollapsed(window.innerWidth < 1024);
            });
        };
        // Initial sync should also be deferred
        startTransition(() => sync());
        window.addEventListener('resize', sync);
        return () => window.removeEventListener('resize', sync);
    }, []);
    useEffect(() => {
        if (!isTeacher) return;
        if ((tab === 'responses' || tab === 'analytics') && !selectedSurveyId && defs.length > 0) {
            // Use startTransition to avoid setState during render
            startTransition(() => {
                setSelectedSurveyId(defs[0].id);
            });
        }
    }, [tab, defs, isTeacher, selectedSurveyId]);
    useEffect(() => {
        if (studentTab === 'insights') {
            if (studentInsightsSurveyId !== '__all__' && !allForStudent.some((s) => s.id === studentInsightsSurveyId)) {
                // Use startTransition to avoid setState during render
                startTransition(() => {
                    setStudentInsightsSurveyId('__all__');
                });
            }
        }
    }, [studentTab, allForStudent, studentInsightsSurveyId]);

    if (selectedStudyLoading && !selectedStudy && !isTeacher) {
        return (
            <div className="min-h-screen bg-background overflow-x-hidden anketa-zfix">
                <AnketaStyles />
                <Header userRole={role} userName={baseName} onLogout={() => {}} />
                <DataLoader
                    label="Loading study context…"
                    description="Preparing survey workspace for the selected study."
                    details={['Study preference • archived permissions']}
                    fullScreen
                />
            </div>
        );
    }

    if (!isTeacher && !selectedStudy) {
        return (
            <StudentEmptyStudy
                role={role}
                baseName={baseName}
                goSelectStudy={goSelectStudy}
                dynamicSideMargin={dynamicSideMargin}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={() => setIsSidebarCollapsed(s => !s)}
            />
        );
    }

    if (!isTeacher && isArchived) {
        return (
            <div className="min-h-screen bg-background overflow-x-hidden anketa-zfix">
                <AnketaStyles />
                <Header userRole={role} userName={baseName} onLogout={() => navigate('/login')} />
                <RoleSidebar userRole={role} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
                <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
                    <main className="flex-1">
                        <div className="px-6 pt-3 pb-6">
                            <NavigationBreadcrumb />
                            <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No surveys available.</div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    // Helper functions (not hooks, can be after conditional returns)
    const openSurvey = (s, readOnly = false) => { setPreviewReadOnly(readOnly); setActiveSurvey(s || null); };
    const closeSurvey = () => { setActiveSurvey(null); setPreviewReadOnly(false); };

    const handleSaveDraft = (draft) => {
        if (!activeSurvey) return;
        saveEntry(activeSurvey.id, { draft, submittedAt: null, updatedAt: nowISO() });
        setLsTick(t => t + 1);
        guardedNotify('anketa-draft-saved', 'success', 'Draft saved', { title: 'Draft saved', lockMs: 2000 });
    };
    const handleSubmit = async (answers) => {
        const timestamp = nowISO();
        saveEntry(activeSurvey.id, { draft: answers, submittedAt: timestamp, updatedAt: timestamp });
        const uid = activeSurvey.isAnonymous ? `anon_${H((user?.email || '') + activeSurvey.id)}` : (user?.id || `u_${H(user?.email || 'guest')}`);
        const name = activeSurvey.isAnonymous ? '' : (userProfile?.full_name || user?.full_name || user?.email || '');
        addResponse(activeSurvey.id, { id: `sub_${toSlug(activeSurvey.id)}_${Date.now()}`, uid, name, answers, submittedAt: nowISO() });
        setLsTick(t => t + 1);
        guardedNotify('anketa-submit-success', 'success', 'Survey submitted successfully', { title: 'Submitted', lockMs: 3000 });
        closeSurvey();
    };
    const handleQuickSaveDraft = (s) => {
        const entry = loadEntry(s.id) || {};
        const answers = entry.draft || {};
        const answerCount = Object.keys(answers).length;
        saveEntry(s.id, { draft: answers, submittedAt: null, updatedAt: nowISO() });
        setLsTick(t => t + 1);
        const msg = answerCount > 0 ? `Draft saved (${answerCount} answers)` : 'Draft saved';
        guardedNotify('anketa-quick-draft', 'success', msg, { title: 'Draft', lockMs: 2000 });
    };
    const handleRemoveLocal = (s) => {
        const ok = window.confirm('Remove local submission?');
        if (!ok) return;
        clearEntry(s.id);
        setLsTick(t => t + 1);
        guardedNotify('anketa-local-removed', 'success', 'Local copy removed', { title: 'Local data', lockMs: 2000 });
    };

    const openBuilderNew = () => {
        setBuilderDraft({
            id: null,
            title: '',
            category: 'course',
            isAnonymous: true,
            openAt: new Date().toISOString().slice(0, 10),
            closeAt: new Date().toISOString().slice(0, 10),
            questions: [],
            published: true,
            ownerId: user?.id || 'system'
        });
        setBuilderOpen(true);
    };
    const openBuilderEdit = (s) => { setBuilderDraft({ ...s }); setBuilderOpen(true); };
    const saveSurveyDef = (draft) => {
        if (!isTeacher) {
            notify('error', 'Only teachers can create/edit surveys', { title: 'Permission Denied' });
            return;
        }
        let next = [...defs];
        if (!draft.id) {
            draft.id = `survey_new_${Date.now()}`;
            next = [draft, ...next];
        } else {
            next = next.map(x => x.id === draft.id ? { ...x, ...draft } : x);
        }
        writeDefs(next);
        setBuilderOpen(false);
        setBuilderDraft(null);
        setLsTick(t => t + 1);
        notify('success', 'Survey saved', { title: 'Surveys' });
    };
    const duplicateSurvey = (s) => {
        const copy = { ...s, id: null, title: `${s.title} (copy)`, openAt: new Date().toISOString().slice(0, 10), closeAt: s.closeAt };
        openBuilderEdit(copy);
    };
    const togglePublished = (s) => {
        if (!isTeacher) return;
        const next = defs.map(x => x.id === s.id ? { ...x, published: !x.published } : x);
        writeDefs(next); setLsTick(t => t + 1);
        guardedNotify('anketa-publish-toggle', 'success', s.published ? 'Unpublished' : 'Published', { title: 'Surveys', lockMs: 2000 });
    };
    const deleteSurvey = (s) => {
        if (!isTeacher) return;
        if (!window.confirm('Delete this survey? This does not remove existing responses.')) return;
        const next = defs.filter(x => x.id !== s.id);
        writeDefs(next); setLsTick(t => t + 1);
        setTimeout(() => {
            notify('success', 'Survey deleted', { title: 'Surveys' });
        }, 100);
    };

    const exportDefs = () => {
        // Export only surveys owned by current teacher
        const myDefs = (defs || []).filter(d => d.ownerId === user?.id);
        const blob = new Blob([JSON.stringify(myDefs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `surveys_${Date.now()}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        guardedNotify('anketa-export-defs', 'success', `Exported ${myDefs.length} surveys`, { title: 'Export', lockMs: 2000 });
    };
    const importDefs = () => importInputRef.current?.click();
    const onImportFile = (file) => {
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                const arr = JSON.parse(String(r.result || '[]'));
                if (!Array.isArray(arr)) { guardedNotify('anketa-import-invalid', 'error', 'Invalid file', { title: 'Import', lockMs: 2500 }); return; }
                const normalized = arr.map(x => ({ ...x, id: x.id || `survey_${toSlug(x.title || Math.random().toString(36).slice(2))}_${Date.now()}`, ownerId: x.ownerId || (user?.id || 'system') }));
                if (isTeacher) {
                    writeDefs([...normalized, ...defs]);
                    setLsTick(t => t + 1);
                }
                notify('success', `Imported ${normalized.length} surveys`, { title: 'Import' });
            } catch { guardedNotify('anketa-import-failed', 'error', 'Failed to parse file', { title: 'Import', lockMs: 2500 }); }
        };
        r.readAsText(file);
    };

    const exportResultsJSON = (s) => {
        const arr = getResponsesSync(s.id);
        const blob = new Blob([JSON.stringify({ survey: s, responses: arr }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `responses_${toSlug(s.title)}_${s.id}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        guardedNotify('anketa-export-json', 'success', 'JSON exported', { title: 'Export', lockMs: 2000 });
    };
    const exportResultsCSV = (s) => {
        const arr = getResponsesSync(s.id);
        const headers = ['id', 'submittedAt', 'name', ...(s.questions || []).map(q => q.id)];
        const lines = [headers.join(',')];
        arr.forEach(r => {
            const row = [
                JSON.stringify(r.id),
                JSON.stringify(r.submittedAt),
                JSON.stringify(r.name || ''),
                ...(s.questions || []).map(q => {
                    const v = r.answers[q.id];
                    const cell = Array.isArray(v) ? v.join('; ') : (v ?? '');
                    return JSON.stringify(cell);
                })
            ];
            lines.push(row.join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `responses_${toSlug(s.title)}_${s.id}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        guardedNotify('anketa-export-csv', 'success', 'CSV exported', { title: 'Export', lockMs: 2000 });
    };

    const exportResultsCSVPlus = (s) => {
        const arr = getResponsesSync(s.id);
        const metaKeys = Object.keys(s.meta || {});
        const qcols = (s.questions || []).map(q => ({ key: q.id, header: `${q.id}: ${q.text}` }));
        const headers = [
            'surveyId', 'surveyTitle', 'category', 'isAnonymous', 'openAt', 'closeAt', 'ownerId',
            ...metaKeys.map(k => `meta.${k}`),
            'responseId', 'uid', 'name', 'submittedAt',
            ...qcols.map(c => c.header)
        ];
        const lines = [headers.join(',')];
        arr.forEach(r => {
            const base = [
                s.id, s.title, s.category, s.isAnonymous ? 'yes' : 'no', s.openAt, s.closeAt, s.ownerId,
                ...metaKeys.map(k => (s.meta?.[k] ?? '')),
                r.id, r.uid || '', r.name || '', r.submittedAt || ''
            ].map(v => JSON.stringify(v));
            const answers = qcols.map(c => {
                const v = r.answers[c.key];
                const cell = Array.isArray(v) ? v.join('; ') : (v ?? '');
                return JSON.stringify(cell);
            });
            lines.push([...base, ...answers].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `responses_detailed_${toSlug(s.title)}_${s.id}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        guardedNotify('anketa-export-csvplus', 'success', 'CSV+ exported', { title: 'Export', lockMs: 2000 });
    };

    // Helper constants for teacher responses view
    const respPerPage = 8;
    const respTotalPages = Math.max(1, Math.ceil(filteredResponses.length / respPerPage));
    const respSlice = filteredResponses.slice((respPage - 1) * respPerPage, (respPage - 1) * respPerPage + respPerPage);

    return (
        <div className="min-h-screen bg-background overflow-x-hidden anketa-zfix">
            <AnketaStyles />
            <Header userRole={role} userName={baseName} onLogout={() => navigate('/login')} />
            <RoleSidebar userRole={role} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Surveys">
                <main className="flex-1 min-h-0">
                    <div className="px-6 pt-3 pb-6">
                        <NavigationBreadcrumb />
                        {isTeacher ? (
                            <>
                                <Reveal variant="keycap" waitForLoaders={true} as={motion.section} delay={ANIMATION_DELAYS.HERO}>
                                    <div className="min-w-0 space-y-1 mb-4">
                                        <h1 className="text-2xl font-bold text-foreground truncate">Surveys — Teacher</h1>
                                        <p className="text-sm text-muted-foreground">Create, publish, and analyze surveys.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
                                        {[
                                            { key: 'open', label: 'OPEN', value: teacherCounts.open ?? 0 },
                                            { key: 'upcoming', label: 'UPCOMING', value: teacherCounts.upcoming ?? 0 },
                                            { key: 'archived', label: 'ARCHIVED/UNPUB', value: teacherCounts.archived ?? 0 },
                                            { key: 'total', label: 'TOTAL SURVEYS', value: teacherCounts.total ?? 0 },
                                            { key: 'totalSub', label: 'TOTAL RESPONSES', value: teacherCounts.totalSub ?? 0 },
                                        ].map((card, idx) => (
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
                                            </motion.div>
                                        ))}
                                    </div>
                                </Reveal>

                                <div className="space-y-6">
                                    <div className="bg-card glass-card rounded-lg border border-border p-3 sm:p-4">
                                        <TabBar
                                            ariaLabel="Survey sections"
                                            value={tab}
                                            onChange={setTab}
                                            items={[
                                                { value: 'manage', label: 'Manage', icon: 'Settings' },
                                                { value: 'responses', label: 'Responses', icon: 'Inbox' },
                                                { value: 'analytics', label: 'Analytics', icon: 'BarChart3' },
                                            ]}
                                            className="gap-2"
                                            buttonClassName="min-w-[120px] justify-center"
                                        />
                                    </div>

                                    {tab === 'manage' && (
                                        <>
                                            <Reveal variant="keycap" waitForLoaders={true} as={motion.section} delay={ANIMATION_DELAYS.FAST_STEP}>
                                                <QuickActionPanel userRole={role} className="w-full mb-6" />
                                            </Reveal>
                                            
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                <div className="text-sm text-muted-foreground">Create, import, publish, and maintain your surveys.</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button iconName="PlusCircle" onClick={openBuilderNew}>New survey</Button>
                                                    <Button variant="outline" iconName="Upload" onClick={importDefs}>Import</Button>
                                                    <Button variant="outline" iconName="Download" onClick={exportDefs}>Export all</Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                                                {teacherSurveys.map(s => (
                                                    <div key={s.id}>
                                                        <TeacherManageCard
                                                            s={s}
                                                            openBuilderEdit={openBuilderEdit}
                                                            duplicateSurvey={duplicateSurvey}
                                                            openSurvey={openSurvey}
                                                            togglePublished={togglePublished}
                                                            deleteSurvey={deleteSurvey}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            {teacherSurveys.length === 0 && (
                                                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No surveys yet.</div>
                                            )}
                                        </>
                                    )}

                                    {tab === 'responses' && (
                                        <section className="space-y-4">
                                            <div className="bg-card glass-card rounded-lg border border-border p-3 z-stack of-visible">
                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                                    <div className="relative z-dropdown">
                                                        <Select
                                                            label="Survey"
                                                            value={selectedSurveyId}
                                                            placeholder="Choose a survey"
                                                            options={teacherSurveys.map(s => ({ value: s.id, label: s.title }))}
                                                            onChange={v => setSelectedSurveyId(typeof v === 'string' ? v : v?.value || '')}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <Input label="From" type="date" value={respFilters.from} onChange={e => setRespFilters({ ...respFilters, from: e.target.value })} />
                                                        <Input label="To" type="date" value={respFilters.to} onChange={e => setRespFilters({ ...respFilters, to: e.target.value })} />
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <Input label="Search name" value={respFilters.q} onChange={e => setRespFilters({ ...respFilters, q: e.target.value })} />
                                                        <Select
                                                            label="Sort"
                                                            value={respFilters.sort}
                                                            options={[{ value: 'new', label: 'Newest first' }, { value: 'old', label: 'Oldest first' }]}
                                                            onChange={v => setRespFilters({ ...respFilters, sort: typeof v === 'string' ? v : v?.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            {!selectedSurvey ? (
                                                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Choose a survey to view responses.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div className="text-sm text-muted-foreground">{filteredResponses.length} total responses</div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Button variant="outline" iconName="FileText" onClick={() => exportResultsCSV(selectedSurvey)}>Export CSV</Button>
                                                            <Button variant="outline" iconName="FilePlus" onClick={() => exportResultsCSVPlus(selectedSurvey)}>Export CSV+</Button>
                                                            <Button variant="outline" iconName="FileJson" onClick={() => exportResultsJSON(selectedSurvey)}>Export JSON</Button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {respSlice.map(r => (
                                                            <div key={r.id} className="rounded-lg border border-border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-medium">{r.name || 'Anonymous'}</div>
                                                                    <div className="text-xs text-muted-foreground">{new Date(r.submittedAt).toLocaleString()}</div>
                                                                </div>
                                                                <div className="shrink-0 flex items-center gap-2">
                                                                    <Button size="sm" variant="outline" iconName="Eye" onClick={() => { setResponseModalItem(r); setResponseModalOpen(true); }}>View</Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {filteredResponses.length === 0 && (
                                                            <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No responses yet.</div>
                                                        )}
                                                    </div>
                                                    {filteredResponses.length > 0 && (
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-muted/30 border border-border rounded-lg p-3 gap-3">
                                                            <div className="text-sm text-muted-foreground">Page {respPage} / {respTotalPages}</div>
                                                            <div className="flex items-center gap-2">
                                                                <Button size="sm" variant="outline" iconName="ChevronLeft" disabled={respPage === 1} onClick={() => setRespPage(p => Math.max(1, p - 1))}>Prev</Button>
                                                                <Button size="sm" variant="outline" iconName="ChevronRight" disabled={respPage === respTotalPages} onClick={() => setRespPage(p => Math.min(respTotalPages, p + 1))}>Next</Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {tab === 'analytics' && (
                                        <section className="space-y-4">
                                            <div className="bg-card glass-card rounded-lg border border-border p-4">
                                                <div className="space-y-3">
                                                    <Select
                                                        label="Select Survey"
                                                        value={selectedSurveyId}
                                                        placeholder="Choose a survey to view analytics"
                                                        options={teacherSurveys.map(s => ({ value: s.id, label: s.title }))}
                                                        onChange={v => setSelectedSurveyId(typeof v === 'string' ? v : v?.value || '')}
                                                    />
                                                    <p className="text-xs text-muted-foreground">Explore detailed question analytics including response distribution and statistics.</p>
                                                </div>
                                            </div>
                                            {!selectedSurvey ? (
                                                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Choose a survey to see analytics.</div>
                                            ) : (
                                                <AnalyticsBlock
                                                    survey={selectedSurvey}
                                                    responses={filteredResponses}
                                                    anchorId={BREADCRUMB_ANCHORS.analytics}
                                                />
                                            )}
                                        </section>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <Reveal variant="keycap" waitForLoaders={true} as={motion.section} delay={ANIMATION_DELAYS.HERO}>
                                    <div className="min-w-0 space-y-1 mb-4">
                                        <h1 className="text-2xl font-bold text-foreground truncate">Surveys — Student</h1>
                                        <p className="text-sm text-muted-foreground">Participate in surveys, provide feedback, and view analytics.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
                                        {[
                                            { key: 'open', label: 'OPEN', value: countsStudent.open },
                                            { key: 'submitted', label: 'SUBMITTED', value: countsStudent.submitted },
                                            { key: 'closed', label: 'CLOSED', value: countsStudent.closed },
                                            { key: 'total', label: 'TOTAL', value: countsStudent.total },
                                            { key: 'drafts', label: 'DRAFTS', value: draftCount },
                                            { key: 'notifications', label: 'NOTIFICATIONS', value: notifications?.length || 0 },
                                        ].map((card, idx) => (
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
                                            </motion.div>
                                        ))}
                                    </div>
                                </Reveal>

                                <div className="space-y-6">
                                    {studentActionTiles.length > 0 && (
                                    <Reveal variant="keycap" waitForLoaders={true} as={motion.section} delay={ANIMATION_DELAYS.SUBTITLE} className="glass-card rounded-xl border border-border p-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                            {studentActionTiles.map((tile) => (
                                                <div key={tile.id} className="rounded-lg border border-border/70 bg-card/80 p-4 shadow-sm space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-xs uppercase tracking-wide text-muted-foreground">{tile.title}</div>
                                                            <div className="text-2xl font-semibold text-foreground">{tile.value}</div>
                                                        </div>
                                                        <AppIcon name={tile.icon} size={20} className="text-primary" />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-snug">{tile.helper}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Reveal>
                                    )}

                                    <div className="bg-card glass-card rounded-lg border border-border p-3 sm:p-4">
                                        <TabBar
                                            ariaLabel="Student survey sections"
                                            value={studentTab}
                                            onChange={setStudentTab}
                                            items={[
                                                { value: 'available', label: 'Available', icon: 'ClipboardList' },
                                                { value: 'drafts', label: 'Drafts', icon: 'FileClock' },
                                                { value: 'submitted', label: 'Submitted', icon: 'CheckCircle2' },
                                                { value: 'history', label: 'Closed', icon: 'Archive' },
                                                { value: 'insights', label: 'Insights', icon: 'BarChart3' },
                                            ]}
                                            className="gap-2"
                                        />
                                    </div>

                                    {studentTab === 'available' && (
                                        <>
                                            {loadingSurveys && (
                                                <DataLoader
                                                    label="Loading surveys…"
                                                    description="Synchronizing survey data and responses."
                                                    details={[
                                                        'Survey definitions • draft responses • submission history',
                                                        'Analytics and insights • category filters',
                                                    ]}
                                                    fullScreen
                                                />
                                            )}
                                            {!loadingSurveys && (
                                        <section className="space-y-6">
                                                    <Reveal variant="keycap" waitForLoaders={true} as={motion.div} delay={ANIMATION_DELAYS.FAST_STEP}>
                                                        <QuickActionPanel userRole={role} className="w-full" />
                                                    </Reveal>
                                                    
                                                    {allForStudent.length > 0 && (
                                                        <FiltersBarStudent filters={filters} setFilters={setFilters} />
                                                    )}

                                                    <div className="space-y-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <div className="text-sm text-muted-foreground">Course & service surveys. Share your feedback.</div>
                                                        </div>
                                                        
                                                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                                                            {openStudent.map((s) => (
                                                        <SurveyCardStudent
                                                            key={String(s.id)}
                                                            s={s}
                                                            openSurvey={openSurvey}
                                                            handleRemoveLocal={handleRemoveLocal}
                                                            handleQuickSaveDraft={handleQuickSaveDraft}
                                                            loadEntry={loadEntry}
                                                        />
                                                    ))}
                                                        </div>
                                                        {openStudent.length === 0 && (
                                                            <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No surveys currently available.</div>
                                                        )}
                                                    </div>
                                        </section>
                                            )}
                                        </>
                                    )}

                                    {studentTab === 'drafts' && (
                                        <section className="space-y-4">
                                            {draftStudentSorted.length === 0 ? (
                                                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No drafts saved — start a survey and your progress will appear here.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                                                    {draftStudentSorted.map((s) => (
                                                        <SurveyCardStudent
                                                            key={String(s.id)}
                                                            s={s}
                                                            openSurvey={openSurvey}
                                                            handleRemoveLocal={handleRemoveLocal}
                                                            handleQuickSaveDraft={handleQuickSaveDraft}
                                                            loadEntry={loadEntry}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {studentTab === 'submitted' && (
                                        <section className="space-y-4">
                                            {submittedStudent.length === 0 ? (
                                                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">You haven’t submitted any surveys yet.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                                                    {submittedStudent.map((s) => (
                                                        <SurveyCardStudent
                                                            key={String(s.id)}
                                                            s={s}
                                                            openSurvey={openSurvey}
                                                            handleRemoveLocal={handleRemoveLocal}
                                                            handleQuickSaveDraft={handleQuickSaveDraft}
                                                            loadEntry={loadEntry}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {studentTab === 'history' && (
                                        <section className="space-y-4">
                                            {closedStudent.length === 0 ? (
                                                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No closed surveys to show.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                                                    {closedStudent.map((s) => (
                                                        <SurveyCardStudent
                                                            key={String(s.id)}
                                                            s={s}
                                                            openSurvey={openSurvey}
                                                            handleRemoveLocal={handleRemoveLocal}
                                                            handleQuickSaveDraft={handleQuickSaveDraft}
                                                            loadEntry={loadEntry}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {studentTab === 'insights' && (
                                        <section className="space-y-5">
                                            <div className="glass-card rounded-xl border border-border p-4">
                                                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <h3 className="text-base font-semibold text-foreground">Personal insights</h3>
                                                        <p className="text-xs text-muted-foreground">Review your survey activity or drill into a specific survey.</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:min-w-[360px]">
                                                        <Select
                                                            label="Scope"
                                                            value={studentInsightsSurveyId}
                                                            options={[
                                                                { value: '__all__', label: 'All surveys (aggregated)' },
                                                                ...allForStudent.map((s) => ({ value: s.id, label: s.title })),
                                                            ]}
                                                            onChange={(v) => setStudentInsightsSurveyId(typeof v === 'string' ? v : v?.value || '__all__')}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <AnalyticsBlock
                                                anchorId={BREADCRUMB_ANCHORS.analytics}
                                                survey={studentInsightsSurvey}
                                                responses={studentInsightsResponses}
                                            />
                                        </section>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </main>
                <footer>
                    <div className="px-4 sm:px-6">
                        <div className="border-t border-border py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground gap-2">
                                <div>
                                    <p>MAIS 2.0 • {isTeacher ? 'Teacher Portal' : 'Student Portal'}</p>
                                    <p>Last login: {new Date()?.toLocaleDateString()} at {new Date()?.toLocaleTimeString()}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button variant="ghost" size="sm" iconName="HelpCircle" onClick={() => navigate('/help')}>Help</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>

            <SurveyModal
                isOpen={!!activeSurvey}
                survey={activeSurvey}
                onClose={closeSurvey}
                onSaveDraft={handleSaveDraft}
                onSubmit={handleSubmit}
                initialDraft={activeSurvey ? (loadEntry(activeSurvey.id)?.draft || {}) : {}}
                readOnly={previewReadOnly}
            />
            <SurveyBuilderModal
                open={builderOpen}
                value={builderDraft}
                onClose={() => { setBuilderOpen(false); setBuilderDraft(null); }}
                onSave={saveSurveyDef}
            />
            <ResponseDetailModal
                open={responseModalOpen}
                survey={selectedSurvey}
                submission={responseModalItem}
                onClose={() => { setResponseModalOpen(false); setResponseModalItem(null); }}
            />
            <input ref={importInputRef} type="file" className="hidden" accept="application/json,.json" onChange={e => onImportFile(e.target.files?.[0])} />
        </div>
    );
};

export default function AnketaPage() {
    return (
        <ToastsProvider>
            <AnketaPageInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
}