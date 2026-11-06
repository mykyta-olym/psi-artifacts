// src/pages/teacher-dashboard/ActivitiesPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import DataLoader from '../../components/ui/DataLoader';
import Icon from '../../components/AppIcon';

import StatsCards from './components/StatsCards';
import FiltersBar from './components/FiltersBar';
import ActivitiesTable from './components/ActivitiesTable';
import ActivitiesTimeline from './components/ActivitiesTimeline';
import Pagination from './components/Pagination';
import EmptyState from './components/EmptyState';

import {
    TYPES, SORTS, VIEW_KEY, GRID_COLS,
    iconByType, colorByType, priorityBadge,
    timeAgo, isToday, isYesterday,
    stripCourseText
} from '../../utils/utils';

import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import { useNotifications } from '../../contexts/NotificationsContext';
import useChatStore from '../../hooks/useChatStore';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import useUserPreference from '../../hooks/useUserPreference';
import useDataUpdates from '../../hooks/useDataUpdates';
import useActivitiesHub from '../../hooks/useActivitiesHub';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { getActivities as apiGetActivities, getUserActivities } from '../../data/activitiesApi';

import { createLogger } from '../../utils/logger';
const logger = createLogger('index');

const toLower = (v) => String(v || '').trim().toLowerCase();
const arrify = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const pickTeacherKey = (user) => {
    const id = toLower(user?.id);
    const email = toLower(user?.email);
    return id || email || 'anon';
};
const readPath = (obj, path) => {
    if (!obj) return undefined;
    return String(path || '')
        .split('.')
        .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
};
const listFrom = (list) =>
    arrify(list)
        .map(x => (typeof x === 'string' ? x : (x?.email || x?.id || '')))
        .map(toLower)
        .filter(Boolean);

const belongsToTeacher = (a, me) => {
    const meId = toLower(me?.id);
    const meEmail = toLower(me?.email);

    const emailKeys = [
        'teacherEmail', 'instructorEmail', 'ownerEmail', 'assigneeEmail',
        'meta.teacherEmail', 'meta.instructorEmail', 'meta.ownerEmail'
    ];
    const idKeys = [
        'teacherId', 'instructorId', 'ownerId', 'assigneeId',
        'meta.teacherId', 'meta.instructorId', 'meta.ownerId'
    ];
    const arrayKeys = [
        'participants', 'recipients',
        'meta.participants', 'meta.recipients', 'meta.threadParticipants'
    ];

    const emailFields = emailKeys
        .map(k => toLower(readPath(a, k)))
        .filter(Boolean);

    const idFields = idKeys
        .map(k => toLower(readPath(a, k)))
        .filter(Boolean);

    const listEmails = arrayKeys
        .flatMap(k => listFrom(readPath(a, k)));

    if (emailFields.includes(meEmail) || idFields.includes(meId)) return true;
    if (listEmails.includes(meEmail) || listEmails.includes(meId)) return true;

    const hasTeacherMarker = emailFields.length || idFields.length || listEmails.length;
    return !hasTeacherMarker;


};

const ActivitiesPageInner = () => {
    const {
        activityFeed,
        activitiesLoading,
        resolveActivities,
        markActivitiesNeedsAction,
        removeActivities,
        refreshActivities,
    } = useNotifications();
    const { markRead: markThreadRead } = useChatStore();
    const { user, userProfile } = useAuth();
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const roleFromAuth = String(user?.role || userProfile?.role || '').toLowerCase();
    const isTeacher = roleFromAuth === 'teacher';
    const pageUserRole = isTeacher ? 'teacher' : 'student';

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const topRef = useRef(null);

    const headerDisplayName = useProfileDisplayName('Teacher');

    const teacherRoom = useMemo(() => {
        // Use only userProfile from context, no static fallback
        const profile = userProfile && Object.keys(userProfile || {}).length ? userProfile : null;
        return profile?.office?.room || profile?.room || profile?.location || '';
    }, [userProfile]);

    const [type, setType] = useState(searchParams.get('type') || 'all');
    const [from, setFrom] = useState(searchParams.get('from') || '');
    const [to, setTo] = useState(searchParams.get('to') || '');
    const [requiresAction, setRequiresAction] = useState(searchParams.get('action') === '1');
    const [sort, setSort] = useState(searchParams.get('sort') || 'time');
    const [dir, setDir] = useState(searchParams.get('dir') || 'desc');
    const [page, setPage] = useState(Number(searchParams.get('page') || 1));
    const [perPage, setPerPage] = useState(Number(searchParams.get('per') || 10));
    const [mode, setMode] = useState(searchParams.get('mode') || 'list');

    const [qDraft, setQDraft] = useState(searchParams.get('q') || '');
    const [q, setQ] = useState(searchParams.get('q') || '');
    const [userSearch, setUserSearch] = useState(searchParams.get('user') || '');
    const [userSearchDraft, setUserSearchDraft] = useState(searchParams.get('user') || '');

    const [activities, setActivities] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const teacherKey = useMemo(() => pickTeacherKey(user), [user]);
    const pinsPreferenceKey = useMemo(
        () => (teacherKey ? `activities.pins.${teacherKey}` : null),
        [teacherKey],
    );
    const viewPreferenceKey = useMemo(
        () => (teacherKey ? `${VIEW_KEY}.${teacherKey}` : null),
        [teacherKey],
    );

    const {
        value: pinsPreference,
        setValue: savePinsPreference,
        loading: pinsLoading,
    } = useUserPreference(pinsPreferenceKey, []);
    const {
        value: viewPreference,
        setValue: saveViewPreference,
        loading: viewLoading,
    } = useUserPreference(viewPreferenceKey, null);
    const { value: selectedStudy, loading: selectedStudyLoading } = useSelectedStudyValue();
    const activitiesRestricted = pageUserRole === 'student' && !!selectedStudy && selectedStudy.ongoing === false;

    const [pinnedIds, setPinnedIds] = useState([]);
    const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

    const pinsHydratedRef = useRef(false);
    useEffect(() => {
        if (pinsHydratedRef.current) return;
        if (pinsLoading) return;
        pinsHydratedRef.current = true;
        if (Array.isArray(pinsPreference)) {
            setPinnedIds(pinsPreference);
        } else {
            setPinnedIds([]);
        }
    }, [pinsLoading, pinsPreference]);

    useEffect(() => {
        if (!pinsHydratedRef.current) return;
        savePinsPreference(pinnedIds);
    }, [pinnedIds, savePinsPreference]);

    const togglePin = useCallback((id) => {
        setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }, []);

    const bulkPin = useCallback((ids) => {
        setPinnedIds(prev => Array.from(new Set([...prev, ...ids])));
    }, []);

    const bulkUnpin = useCallback((ids) => {
        setPinnedIds(prev => prev.filter(id => !ids.includes(id)));
    }, []);

    // Load activities from backend API with filters
    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            setActivities([]);
            setTotal(0);
            setTotalPages(1);
            return;
        }
        
        let cancelled = false;
        
        const loadActivities = async () => {
            setLoading(true);
            try {
                let response;
                
                // If searching for a specific user, use getUserActivities endpoint
                if (userSearch && userSearch.trim()) {
                    response = await getUserActivities(userSearch.trim(), {
                        type: type !== 'all' && type !== 'pinned' ? type : undefined,
                        requiresAction: requiresAction || undefined,
                        sort,
                        dir,
                        page,
                        perPage,
                    });
                } else {
                    // Otherwise use general getActivities
                    response = await apiGetActivities({
                        type: type !== 'all' && type !== 'pinned' ? type : undefined,
                        q,
                        from,
                        to,
                        requiresAction: requiresAction || undefined,
                        sort,
                        dir,
                        page,
                        perPage,
                    });
                }
                
                if (cancelled) return;
                
                logger.debug('[Activities Page] API response:', response);
                const activitiesList = response?.items || response?.activities || response?.Activities || [];
                logger.debug('[Activities Page] Activities list:', activitiesList.length, activitiesList);
                
                if (activitiesList.length > 0 || response) {
                    let filteredList = activitiesList;
                    
                    // Filter pinned if needed
                    if (type === 'pinned') {
                        filteredList = filteredList.filter(a => pinnedSet.has(a.id));
                    }
                    
                    setActivities(filteredList);
                    setTotal(response?.total || response?.Total || filteredList.length);
                    setTotalPages(response?.totalPages || response?.TotalPages || 1);
                } else {
                    // If no activities in response, set empty arrays
                    setActivities([]);
                    setTotal(0);
                    setTotalPages(1);
                }
            } catch (err) {
                if (cancelled) return;
                logger.error('Failed to load activities:', err);
                // Fallback to activityFeed from context
                const scoped = (activityFeed || []).filter(a => belongsToTeacher(a, user));
                setActivities(scoped);
                setTotal(scoped.length);
                setTotalPages(Math.ceil(scoped.length / perPage) || 1);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadActivities();
        
        return () => {
            cancelled = true;
            setLoading(false);
        };
    }, [type, q, from, to, requiresAction, sort, dir, page, perPage, user?.email, pinnedSet, activityFeed, userSearch]);

    // SignalR real-time activity updates
    const handleDataUpdate = useCallback((payload) => {
        if (!payload?.type) return;
        if (payload.type === 'activity_created' || payload.type === 'activity.updated' || payload.type === 'activity.deleted') {
            logger.debug('Activity real-time update:', payload);
            // Inline reload to avoid stale closure
            (async () => {
                try {
                    // Trigger refresh through context
                    if (refreshActivities) {
                        await refreshActivities();
                    }
                } catch (error) {
                    logger.error('Failed to refresh activities:', error);
                }
            })();
        }
    }, []); // Empty dependencies - refreshActivities from context is stable

    useDataUpdates(handleDataUpdate);

    // Use ActivitiesHub for real-time activity updates
    useActivitiesHub({
        onActivityCreated: useCallback((payload) => {
            logger.debug('Activity created via ActivitiesHub:', payload);
            handleDataUpdate({ type: 'activity_created', ...payload });
        }, [handleDataUpdate]),
        onActivityUpdated: useCallback((payload) => {
            logger.debug('Activity updated via ActivitiesHub:', payload);
            handleDataUpdate({ type: 'activity.updated', ...payload });
        }, [handleDataUpdate]),
        onActivityDeleted: useCallback((payload) => {
            logger.debug('Activity deleted via ActivitiesHub:', payload);
            handleDataUpdate({ type: 'activity.deleted', ...payload });
        }, [handleDataUpdate])
    });

    useEffect(() => {
        const t = setTimeout(() => { setQ(qDraft); setPage(1); }, 220);
        return () => clearTimeout(t);
    }, [qDraft]);
    
    useEffect(() => {
        const t = setTimeout(() => { setUserSearch(userSearchDraft); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [userSearchDraft]);

    const initialQueryRef = useRef(searchParams.toString());
    const hasInitialQueryOverrides = useMemo(
        () => (initialQueryRef.current || '').length > 0,
        [],
    );

    const viewHydratedRef = useRef(false);
    useEffect(() => {
        if (viewHydratedRef.current) return;
        if (viewLoading) return;
        viewHydratedRef.current = true;
        if (hasInitialQueryOverrides) return;
        const pref = viewPreference || {};
        setQ(pref.q ?? '');
        setQDraft(pref.q ?? '');
        setUserSearch(pref.userSearch ?? '');
        setUserSearchDraft(pref.userSearch ?? '');
        setType(pref.type ?? 'all');
        setFrom(pref.from ?? '');
        setTo(pref.to ?? '');
        setRequiresAction(!!pref.requiresAction);
        setSort(pref.sort ?? 'time');
        setDir(pref.dir ?? 'desc');
        setPage(pref.page ?? 1);
        setPerPage(pref.perPage ?? 10);
        setMode(pref.mode ?? 'list');
    }, [viewLoading, viewPreference, hasInitialQueryOverrides]);

    useEffect(() => {
        const p = new URLSearchParams();
        if (q) p.set('q', q);
        if (userSearch) p.set('user', userSearch);
        if (type && type !== 'all') p.set('type', type);
        if (from) p.set('from', from);
        if (to) p.set('to', to);
        if (requiresAction) p.set('action', '1');
        if (sort !== 'time') p.set('sort', sort);
        if (dir !== 'desc') p.set('dir', dir);
        if (page !== 1) p.set('page', String(page));
        if (perPage !== 10) p.set('per', String(perPage));
        if (mode !== 'list') p.set('mode', mode);
        setSearchParams(p, { replace: true });
        if (viewHydratedRef.current) {
            saveViewPreference({ q, userSearch, type, from, to, requiresAction, sort, dir, page, perPage, mode });
        }
    }, [q, userSearch, type, from, to, requiresAction, sort, dir, page, perPage, mode, setSearchParams, saveViewPreference]);

    // Activities are already filtered and sorted by backend
    // Just apply local transformations for display
    const filtered = useMemo(() => {
        return activities.map(a => {
            const isComm = a.type === 'communications';
            const author = (a.authorName || a?.meta?.author || a.studentName || '').trim();
            const rawTitle = stripCourseText(a.title || '');
            const parts = rawTitle.split('•').map(s => s.trim());
            const threadTitle = parts.length > 1 ? parts.slice(1).join(' • ') : rawTitle;
            const finalTitle = isComm && author ? `${author} • ${threadTitle}` : rawTitle;

            return {
                ...a,
                title: finalTitle,
                subject: stripCourseText(a.subject || ''),
                description: stripCourseText(a.description || ''),
                teacherDisplay: isComm ? (author || '') : (a?.teacherDisplay || headerDisplayName),
                authorDisplay: author,
            };
        });
    }, [activities, headerDisplayName]);

    // Load stats from backend
    const [stats, setStats] = useState({ byType: [], needAction: 0, total: 0 });
    useEffect(() => {
        if (!user?.email) return;
        
        const loadStats = async () => {
            try {
                const response = await apiGetActivities({ perPage: 1 });
                const byType = TYPES
                    .filter(t => t.value !== 'all' && t.value !== 'pinned')
                    .map(t => ({ 
                        type: t.value, 
                        label: t.label, 
                        count: activities.filter(a => a.type === t.value).length 
                    }));
                const needAction = activities.filter(a => a.requiresAction && !a.isResolved).length;
                setStats({ byType, needAction, total: total });
            } catch (err) {
                logger.warn('Failed to load stats:', err);
            }
        };
        
        loadStats();
    }, [activities, total, user?.email]);

    const safePage = Math.min(Math.max(1, page), totalPages);
    const pageItems = activities; // Already paginated from backend

    const groups = useMemo(() => {
        const pinned = pageItems.filter(a => pinnedSet.has(a.id));
        const rest = pageItems.filter(a => !pinnedSet.has(a.id));
        const map = new Map();
        rest.forEach(a => {
            const d = a.timestamp;
            const label = isToday(d) ? 'Today' : (isYesterday(d) ? 'Yesterday' : new Date(d).toLocaleDateString());
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(a);
        });
        const arr = Array.from(map.entries());
        if (pinned.length) arr.unshift(['Pinned', pinned]);
        return arr;
    }, [pageItems, pinnedIds]);

    const allSelectedOnPage = pageItems.length > 0 && pageItems.every(i => selectedIds.includes(i.id));
    const toggleSelectAll = (checked) => {
        if (!checked) {
            const remaining = selectedIds.filter(id => !pageItems.some(pi => pi.id === id));
            setSelectedIds(remaining);
        } else {
            const toAdd = pageItems.map(i => i.id).filter(id => !selectedIds.includes(id));
            setSelectedIds([...selectedIds, ...toAdd]);
        }
    };

    const clearFilters = () => {
        setQ(''); setQDraft(''); setUserSearch(''); setUserSearchDraft('');
        setType('all'); setFrom(''); setTo('');
        setRequiresAction(false); setSort('time'); setDir('desc');
        setPage(1); setPerPage(10); setMode('list');
    };

    const setPriority = (id, level) => setActivities(prev => prev.map(a => a.id === id ? ({ ...a, priority: level }) : a));

    const exportCSV = (ids) => {
        const source = ids.length ? activities.filter(a => ids.includes(a.id)) : filtered;
        const rows = source.map(a => ({
            id: a.id,
            type: a.type,
            title: stripCourseText(a.title || ''),
            description: stripCourseText(a.description || ''),
            student: a.studentName || '',
            subject: stripCourseText(a.subject || ''),
            classId: a.classId || '',
            priority: a.priority || '',
            requiresAction: a.requiresAction ? 'yes' : 'no',
            teacher: a?.teacherDisplay || headerDisplayName,
            room: a.room || a.location || teacherRoom || '',
            timestamp: new Date(a.timestamp).toISOString(),
        }));
        const header = Object.keys(rows[0] || {
            id:'', type:'', title:'', description:'', student:'', subject:'', classId:'', priority:'', requiresAction:'', teacher:'', room:'', timestamp:''
        });
        const escape = (v) => `"${String(v).replace(/"/g,'""')}"`;
        const csv = [header.join(','), ...rows.map(r => header.map(h => escape(r[h] ?? '')).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `activities_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const openActivity = (a) => {
        if (!a) return;

        if (a.type === 'communications') {
            const threadId = a?.meta?.threadId || a?.threadId || '';
            if (threadId) {
                navigate(`/chat?thread=${encodeURIComponent(threadId)}&src=activities`);
                const ts = Date.parse(a.timestamp) || Date.now();
                markThreadRead(threadId, ts);
                resolveActivities([a.id]);
            }
        } else if (a?.assignmentId && (a.type === 'submissions' || a.type === 'grades')) {
            navigate(`/grade-management?assignment=${a.assignmentId}`);
        } else if (a.type === 'attendance') {
            navigate('/attendance-tracking');
        } else if (a?.meta?.href) {
            navigate(a.meta.href);
        }
    };

    const deleteItems = async (ids) => {
        if (!ids.length) return;
        await removeActivities(ids);
        setActivities(prev => prev.filter(a => !ids.includes(a.id)));
        setSelectedIds([]);
        // Refresh to update totals
        if (refreshActivities) await refreshActivities();
    };

    const markResolved = async (ids) => {
        if (!ids.length) return;
        const pick = (activityFeed || []).filter(a =>
            ids.includes(a.id) &&
            a.type === 'communications' &&
            a?.meta?.threadId &&
            a?.timestamp
        );
        const byThread = new Map();
        pick.forEach(a => {
            const tId = a.meta.threadId;
            const ts = Date.parse(a.timestamp) || 0;
            const prev = byThread.get(tId) || 0;
            if (ts > prev) byThread.set(tId, ts);
        });
        byThread.forEach((ts, tId) => {
            if (tId && ts) markThreadRead(tId, ts);
        });
        await resolveActivities(ids);
        setSelectedIds(sel => sel.filter(id => !ids.includes(id)));
        // Refresh to update totals
        if (refreshActivities) await refreshActivities();
    };

    const markUnresolved = async (ids) => {
        if (!ids.length) return;
        await markActivitiesNeedsAction(ids);
        // Refresh to update totals
        if (refreshActivities) await refreshActivities();
    };

    useEffect(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [safePage, mode, type, q, from, to, requiresAction, sort, dir]);

    useEffect(() => {
        const onKey = (e) => {
            const key = (e.key || '').toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === 'p') {
                e.preventDefault();
                if (e.shiftKey) bulkUnpin(selectedIds);
                else bulkPin(selectedIds);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedIds, bulkPin, bulkUnpin]);

    const MobileViewSwitch = () => (
        <div className="md:hidden mb-3">
            <div className="inline-flex overflow-hidden rounded-md border border-border bg-muted/50">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('list')}
                    className={`px-3 py-2 text-sm flex items-center gap-2 rounded-none ${
                        mode === 'list'
                            ? 'bg-foreground text-background font-semibold'
                            : 'text-foreground/90 hover:bg-muted/60'
                    }`}
                    iconName="List"
                    iconPosition="left"
                    aria-pressed={mode === 'list'}
                >
                    List
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('timeline')}
                    className={`px-3 py-2 text-sm flex items-center gap-2 rounded-none border-l border-border ${
                        mode === 'timeline'
                            ? 'bg-foreground text-background font-semibold'
                            : 'text-foreground/90 hover:bg-muted/60'
                    }`}
                    iconName="Clock"
                    iconPosition="left"
                    aria-pressed={mode === 'timeline'}
                >
                    Timeline
                </Button>
            </div>
        </div>
    );

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    if (pageUserRole === 'student' && selectedStudyLoading && !selectedStudy) {
        return (
            <div className="min-h-screen bg-background overflow-x-hidden">
                <Header userRole={pageUserRole} userName={headerDisplayName} onLogout={()=>navigate('/')} />
                <DataLoader
                    label="Loading study context…"
                    description="Preparing archived permissions before loading activities."
                    details={['Study selection preference • navigation constraints']}
                    fullScreen
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {(loading && user?.email) || (activitiesLoading && user?.email) ? (
                <DataLoader
                    label="Loading activities…"
                    description="Fetching your activity feed from the server."
                    details={[
                        'Activity feed • notifications • workflow updates',
                        'Filtering and sorting • pagination',
                    ]}
                    fullScreen
                />
            ) : null}
            <Header userRole={pageUserRole} userName={headerDisplayName} onLogout={()=>navigate('/')} />
            <RoleSidebar
                userRole={pageUserRole}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
                <main className="flex-1">
                    <div className="relative z-10 px-6 pt-3 pb-6" ref={topRef}>
                        <NavigationBreadcrumb />
                        {activitiesRestricted ? (
                            <div className="max-w-3xl mx-auto mt-6 bg-card border border-border rounded-xl px-5 py-8 text-center shadow-card">
                                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-500/10 text-amber-600">
                                    <Icon name="Ban" size={20} />
                                </div>
                                <h1 className="text-xl font-semibold text-foreground mb-2">Activities are unavailable for archived studies</h1>
                                <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                                    Select an active study programme to review feeds and workflow updates. Archived data remains visible from dashboards, but analytics is read-only.
                                </p>
                                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                                    <Button iconName="GraduationCap" onClick={() => navigate('/study-select?return=/activities&reset=1')}>
                                        Change study
                                    </Button>
                                    <Button variant="outline" iconName="LayoutDashboard" onClick={() => navigate('/student-dashboard')}>
                                        Go to dashboard
                                    </Button>
                                </div>
                            </div>
                        ) : (
                        <>
                        <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} className="mb-6 space-y-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <h1 className="text-2xl font-bold text-foreground">Activities</h1>
                                    <p className="text-sm text-muted-foreground">
                                        {stats.total} results • {stats.needAction} need action
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1 border border-border/60">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setMode('list')}
                                            className={`px-3 py-1.5 rounded-md transition-colors ${
                                                mode === 'list'
                                                    ? 'bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                            }`}
                                            iconName="List"
                                            iconPosition="left"
                                        >
                                            List
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setMode('timeline')}
                                            className={`px-3 py-1.5 rounded-md transition-colors ${
                                                mode === 'timeline'
                                                    ? 'bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                            }`}
                                            iconName="Timer"
                                            iconPosition="left"
                                        >
                                            Timeline
                                        </Button>
                                    </div>
                                    <Button variant="outline" size="sm" iconName="Download" onClick={() => exportCSV([])}>Export CSV</Button>
                                </div>
                            </div>

                            <StatsCards stats={stats} />
                        </Reveal>

                        <Reveal delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true} className="mb-6">
                            <QuickActionPanel userRole={pageUserRole} onQuickAction={() => {}} />
                        </Reveal>

                        <Reveal as={motion.div} className="bg-card rounded-lg border border-border p-4 mb-6" delay={ANIMATION_DELAYS.FILTERS} variant="pop" waitForLoaders={true}>
                            <MobileViewSwitch />
                            <FiltersBar
                                types={TYPES} sorts={SORTS}
                                qDraft={qDraft} setQDraft={setQDraft}
                                userSearchDraft={userSearchDraft} setUserSearchDraft={setUserSearchDraft}
                                type={type} setType={(v)=>{ setType(v); setPage(1); }}
                                sort={sort} setSort={setSort}
                                dir={dir} setDir={setDir}
                                from={from} setFrom={(v)=>{ setFrom(v); setPage(1); }}
                                to={to} setTo={(v)=>{ setTo(v); setPage(1); }}
                                requiresAction={requiresAction} setRequiresAction={(v)=>{ setRequiresAction(v); setPage(1); }}
                                hasActive={!!(q || userSearch || (type && type!=='all') || from || to || requiresAction)}
                                onClear={clearFilters}
                            />
                        </Reveal>

                        {selectedIds.length > 0 && (
                            <Reveal as={motion.div} className="mb-4" delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="pop" waitForLoaders={true}>
                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">
                                            {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'} selected
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            iconName="CheckCircle2"
                                            onClick={() => markResolved(selectedIds)}
                                            disabled={selectedIds.length === 0}
                                        >
                                            Mark as resolved
                                        </Button>
                                        {isTeacher && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                iconName="AlertCircle"
                                                onClick={() => markUnresolved(selectedIds)}
                                                disabled={selectedIds.length === 0}
                                            >
                                                Mark needs action
                                            </Button>
                                        )}
                                        {isTeacher && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                iconName="Trash2"
                                                onClick={() => {
                                                    if (confirm(`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'activity' : 'activities'}?`)) {
                                                        deleteItems(selectedIds);
                                                    }
                                                }}
                                                disabled={selectedIds.length === 0}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            iconName="X"
                                            onClick={() => setSelectedIds([])}
                                        >
                                            Clear selection
                                        </Button>
                                    </div>
                                </div>
                            </Reveal>
                        )}

                        <Reveal as={motion.section} className="bg-card rounded-lg border border-border" delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="slideScale" waitForLoaders={true}>
                            {mode === 'list' ? (
                                <ActivitiesTable
                                    gridCols={GRID_COLS}
                                    groups={groups}
                                    pageItems={pageItems}
                                    allSelectedOnPage={allSelectedOnPage}
                                    toggleSelectAll={toggleSelectAll}
                                    selectedIds={selectedIds}
                                    setSelectedIds={setSelectedIds}
                                    priorityBadge={priorityBadge}
                                    iconByType={iconByType}
                                    colorByType={colorByType}
                                    timeAgo={timeAgo}
                                    openActivity={openActivity}
                                    markResolved={markResolved}
                                    markUnresolved={markUnresolved}
                                    deleteItems={deleteItems}
                                    exportCSV={exportCSV}
                                    setPriority={setPriority}
                                    pinnedIds={pinnedIds}
                                    togglePin={togglePin}
                                    fallbackTeacher={headerDisplayName}
                                    fallbackRoom={teacherRoom}
                                />
                            ) : (
                                <ActivitiesTimeline
                                    groups={groups}
                                    priorityBadge={priorityBadge}
                                    timeAgo={timeAgo}
                                    openActivity={openActivity}
                                    markResolved={markResolved}
                                    markUnresolved={markUnresolved}
                                    fallbackTeacher={headerDisplayName}
                                    fallbackRoom={teacherRoom}
                                />
                            )}

                            {pageItems.length === 0 && (
                                <EmptyState icon="Inbox" title="No activities found" />
                            )}

                            <Pagination
                                page={safePage}
                                totalPages={totalPages}
                                total={total}
                                start={(safePage - 1) * perPage}
                                count={pageItems.length}
                                perPage={perPage}
                                setPage={setPage}
                                setPerPage={setPerPage}
                            />
                        </Reveal>
                        </>
                        )}

                        <div
                            className="md:hidden"
                            aria-hidden="true"
                            style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + var(--mobile-tabbar-h, 64px))' }}
                        />
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

const ActivitiesPage = () => {
    return (
        <ToastsProvider>
            <ActivitiesPageInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default ActivitiesPage;