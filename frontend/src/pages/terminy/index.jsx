// src/pages/terminy/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import TabBar from '../../components/ui/TabBar';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';

import { useAuth } from '../../contexts/AuthContext';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { formatLastLogin } from '../../utils/datetime';
import useDataUpdates from '../../hooks/useDataUpdates';
import useExamsHub from '../../hooks/useExamsHub';

import TermCard from './components/TermCard';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import {
    weekdayNames,
    norm,
    asString,
    to2,
    groupBy,
    fmtLeft,
    downloadBlob,
    KEY_CURR_WS,
    KEY_CURR_SS
} from './utils/terminyUtils';
import useUserPreference from '../../hooks/useUserPreference';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { listAvailableTerms, listMyTerms, registerForTerm, unregisterFromTerm } from '../../data/examsApi';
import { extractApiErrorMessage } from '../../utils/apiErrors';

const TerminyInner = () => {
    const { notify } = useToasts();
    const { user, userProfile } = useAuth();
    const location = useLocation();
    const { isBlocked } = useGlobalLoaderBlocking();
    const toastGuards = useRef({});
    const guardedNotify = useCallback(
        (key, type, message, opts = {}) => {
            if (key) {
                const now = Date.now();
                const lock = opts.lockMs ?? 2800;
                const prev = toastGuards.current[key] ?? 0;
                if (now - prev < lock) return;
                toastGuards.current[key] = now;
            }
            notify(type, message, opts);
        },
        [notify]
    );

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const fullName = userProfile?.full_name || user?.full_name || (user?.email || '').split('@')[0] || 'Student';
    const year = Number(userProfile?.year ?? 1);
    const email = user?.email || '';
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);

    // Use static term key (current semester)
    const termKey = KEY_CURR_WS;

    const derivedYear = useMemo(() => {
        if (String(termKey).startsWith('1-year')) return 1;
        return year || 1;
    }, [termKey, year]);

    // Data state
    const [allTerms, setAllTerms] = useState([]);
    const [loading, setLoading] = useState(false);
    // Range filter must be declared before effects that depend on it
    const [range, setRange] = useState('all');
    
    // Track pending operations to ignore our own SignalR echoes
    const pendingOpsRef = useRef(new Set());

    // Helper function to get default term key
    const getDefaultTermKey = useCallback(() => {
        return termKey || KEY_CURR_WS;
    }, [termKey]);

    // Convert API records into UI shape expected by TermCard
    const shapeTerm = (t) => {
        // Expect API fields: id, courseCode, courseName, credits, startAt, endAt, room, building, examiner, capacity, registered, regOpen
        // Support legacy fields when present (date, endDate, course, etc.)
        const start = t.startAt ? new Date(t.startAt) : (t.date ? new Date(t.date) : null);
        const end = t.endAt ? new Date(t.endAt) : (t.endDate ? new Date(t.endDate) : null);
        return {
            id: t.id,
            courseCode: t.courseCode,
            courseName: t.courseName || t.course || t.code || t.courseCode,
            credits: t.credits ?? t.ects ?? 6,
            date: start,
            endDate: end || (start ? new Date(start.getTime() + 90 * 60000) : new Date()),
            room: t.room || '-',
            building: t.building || '-',
            examiner: t.examiner || t.teacher || '-',
            capacity: typeof t.capacity === 'number' ? t.capacity : 0,
            registered: typeof t.registered === 'number' ? t.registered : (typeof t.registrationsCount === 'number' ? t.registrationsCount : 0),
            meRegistered: !!t.meRegistered,
            regOpen: t.regOpen !== undefined ? !!t.regOpen : true,
        };
    };

    // Initial load and whenever key filters change
    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                // Load both lists in parallel; server should already filter to enrolled courses
                const [avail, mine] = await Promise.all([
                    listAvailableTerms({ termKey, range }),
                    listMyTerms({ termKey, range }),
                ]);
                if (cancelled) return;
                // Mark meRegistered for "mine" and merge sets
                const mineIds = new Set((mine || []).map((x) => x.id));
                const shapedAvail = (avail || []).map(shapeTerm);
                const shapedMine = (mine || []).map((x) => ({ ...shapeTerm(x), meRegistered: true }));
                // Merge by id (favor mine's meRegistered)
                const byId = new Map();
                for (const t of shapedAvail) byId.set(t.id, { ...t, meRegistered: mineIds.has(t.id) });
                for (const t of shapedMine) byId.set(t.id, { ...t, meRegistered: true });
                setAllTerms(Array.from(byId.values()).sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0)));
                // Initialize registration map from "mine"
                setRegistrations(new Map(Array.from(mineIds.values()).map((id) => [id, true])));
            } catch (e) {
                const msg = extractApiErrorMessage(e, 'Failed to load exam terms');
                guardedNotify('terminy-load', 'error', msg, { title: 'Exam terms', lockMs: 3200 });
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [email, derivedYear, termKey, range]);

    // Listen for data updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        if (!payload || !payload.type) return;
        
        // Check if this is our own operation echo - ignore it
        const termId = payload.termId || payload.id;
        if (termId && pendingOpsRef.current.has(termId)) {
            console.log('[terminy] Ignoring own SignalR echo for term:', termId);
            return;
        }
        
        // Refresh exam terms on exam-related updates
        if (payload.type === 'exam.updated' || payload.type === 'exam.created' || payload.type === 'exam.deleted') {
            // Add small delay to let backend sync
            setTimeout(() => {
                setLoading(true);
                Promise.all([
                    listAvailableTerms({ termKey, range }),
                    listMyTerms({ termKey, range }),
                ]).then(([avail, mine]) => {
                    const mineIds = new Set((mine || []).map((x) => x.id));
                    const shapedAvail = (avail || []).map(shapeTerm);
                    const shapedMine = (mine || []).map((x) => ({ ...shapeTerm(x), meRegistered: true }));
                    const byId = new Map();
                    for (const t of shapedAvail) byId.set(t.id, { ...t, meRegistered: mineIds.has(t.id) });
                    for (const t of shapedMine) byId.set(t.id, { ...t, meRegistered: true });
                    setAllTerms(Array.from(byId.values()).sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0)));
                    setRegistrations(new Map(Array.from(mineIds.values()).map((id) => [id, true])));
                }).catch((e) => {
                    const msg = extractApiErrorMessage(e, 'Failed to refresh exam terms');
                    guardedNotify('terminy-refresh', 'error', msg, { title: 'Exam terms', lockMs: 3200 });
                }).finally(() => {
                    setLoading(false);
                });
            }, 500);
        }
    }, [termKey, range, guardedNotify]);

    useDataUpdates(handleDataUpdate);

    // Use ExamsHub for real-time exam term updates
    useExamsHub({
        onExamTermCreated: useCallback((payload) => {
            console.log('[terminy] Exam term created via ExamsHub:', payload);
            handleDataUpdate({ type: 'exam.updated', action: 'created', ...payload });
        }, [handleDataUpdate]),
        onExamTermUpdated: useCallback((payload) => {
            console.log('[terminy] Exam term updated via ExamsHub:', payload);
            handleDataUpdate({ type: 'exam.updated', action: 'updated', ...payload });
        }, [handleDataUpdate]),
        onExamTermDeleted: useCallback((payload) => {
            console.log('[terminy] Exam term deleted via ExamsHub:', payload);
            handleDataUpdate({ type: 'exam.updated', action: 'deleted', ...payload });
        }, [handleDataUpdate]),
        onExamRegistered: useCallback((payload) => {
            console.log('[terminy] Exam registered via ExamsHub:', payload);
            handleDataUpdate({ type: 'exam.updated', action: 'registered', ...payload });
        }, [handleDataUpdate]),
        onExamUnregistered: useCallback((payload) => {
            console.log('[terminy] Exam unregistered via ExamsHub:', payload);
            handleDataUpdate({ type: 'exam.updated', action: 'unregistered', ...payload });
        }, [handleDataUpdate])
    });

    const [registrations, setRegistrations] = useState(() => {
        const map = new Map();
        allTerms.forEach((t) => {
            if (t.meRegistered) map.set(t.id, true);
        });
        return map;
    });

    // Sync registrations when allTerms changes (e.g., from SignalR updates)
    useEffect(() => {
        setRegistrations(prev => {
            const next = new Map();
            allTerms.forEach((t) => {
                if (t.meRegistered) next.set(t.id, true);
            });
            // Only update if different
            if (next.size !== prev.size) return next;
            for (const [k, v] of next) {
                if (prev.get(k) !== v) return next;
            }
            return prev;
        });
    }, [allTerms]);

    const [pageTab, setPageTab] = useState('terms');
    const [view, setView] = useState('my');
    const [myTab, setMyTab] = useState('upcoming');
    const [search, setSearch] = useState('');
    const [courseFilter, setCourseFilter] = useState('all');
    const [regFilter, setRegFilter] = useState('any');
    const [groupMode, setGroupMode] = useState('none');
    // moved above

    useEffect(() => {
        const qp = new URLSearchParams(location.search);
        const t = qp.get('tab');
        const c = qp.get('course');
        const g = qp.get('group');
        const r = qp.get('range');
        const v = qp.get('view');
        const mt = qp.get('mytab');
        const q = qp.get('q');
        const termParam = qp.get('term');
        if (t === 'register' || t === 'terms') setPageTab(t);
        if (c) setCourseFilter(c);
        if (g) setGroupMode(g);
        if (r) setRange(r);
        if (v === 'all' || v === 'my') setView(v);
        if (mt === 'upcoming' || mt === 'past' || mt === 'all') setMyTab(mt);
        if (q) setSearch(q);
    }, [location.search]);

    // Business policy: registration allowed only if 24h or more before start
    const JOIN_CUTOFF_HOURS = 24;
    const WITHDRAW_CUTOFF_HOURS = 24;
    const MAX_PER_DAY = 2;
    const MAX_PER_COURSE = 1;

    const clearFiltersTo = (tab) => {
        setSearch('');
        setCourseFilter('all');
        setGroupMode('none');
        setRange('30d');
        setMyTab('upcoming');
        if (tab === 'register') {
            setView('all');
            setRegFilter('not');
        } else {
            setView('my');
            setRegFilter('any');
        }
    };

    const clearFilters = () => clearFiltersTo(pageTab);

    useEffect(() => {
        if (pageTab === 'terms') {
            setMyTab('upcoming');
            setRegFilter('any');
        } else {
            setView('all');
            setRegFilter('not');
        }
    }, [pageTab]);

    const courseOptions = useMemo(() => {
        const opts = Array.from(new Set(allTerms.map((t) => `${t.courseName}|${t.courseCode}`))).map((s) => ({
            value: s.split('|')[1],
            label: s.split('|')[0]
        }));
        return [{ value: 'all', label: 'All courses' }, ...opts];
    }, [allTerms]);

    const withMine = useMemo(() => allTerms.map((t) => ({ ...t, meRegistered: registrations.get(t.id) || false })), [allTerms, registrations]);

    const mineAll = useMemo(() => withMine.filter((t) => t.meRegistered), [withMine]);
    const mineFuture = useMemo(() => mineAll.filter((t) => t.date.getTime() >= Date.now()), [mineAll]);

    const dayKey = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();

    const perDayCounts = useMemo(() => {
        const map = new Map();
        mineFuture.forEach((t) => {
            const k = dayKey(t.date);
            map.set(k, (map.get(k) || 0) + 1);
        });
        return map;
    }, [mineFuture]);

    const hasCourseReg = useMemo(() => {
        const set = new Set(mineAll.map((t) => t.courseCode));
        return set;
    }, [mineAll]);

    const isConflict = (term) => mineFuture.some((a) => a.id !== term.id && a.date < term.endDate && term.date < a.endDate);

    const policyFor = (term) => {
        const now = Date.now();
        const start = term.date.getTime();
        const past = start < now;
        const joinClose = start - now;
        const withdrawClose = start - now;
        const full = term.registered + (term.meRegistered ? 1 : 0) >= term.capacity && !term.meRegistered;
        const conflict = isConflict(term);
        const limitPerDay = (perDayCounts.get(dayKey(term.date)) || 0) >= MAX_PER_DAY && !term.meRegistered;
        const limitPerCourse = hasCourseReg.has(term.courseCode) && !term.meRegistered && MAX_PER_COURSE === 1;
        const joinTooLate = joinClose < JOIN_CUTOFF_HOURS * 3600000;
        const withdrawTooLate = withdrawClose < WITHDRAW_CUTOFF_HOURS * 3600000;
        const joinOpen = term.regOpen && !past && !full && !conflict && !limitPerDay && !limitPerCourse && !joinTooLate;
        const leaveOpen = term.meRegistered && !past && !withdrawTooLate;
        let joinReason = '';
        if (!term.regOpen) joinReason = 'Registration closed';
        else if (past) joinReason = 'Already held';
        else if (full) joinReason = 'Full';
        else if (conflict) joinReason = 'Time conflict';
        else if (limitPerDay) joinReason = `Max ${MAX_PER_DAY} exams/day`;
        else if (limitPerCourse) joinReason = 'Already registered for this course';
        else if (joinTooLate) joinReason = `Too late (<${JOIN_CUTOFF_HOURS}h)`;
        let leaveReason = '';
        if (!term.meRegistered) leaveReason = 'Not registered';
        else if (past) leaveReason = 'Already held';
        else if (withdrawTooLate) leaveReason = `Cannot unregister <${WITHDRAW_CUTOFF_HOURS}h`;
        const info =
            term.meRegistered && withdrawClose > 0
                ? `Unregister deadline in ${fmtLeft(withdrawClose)}`
                : !term.meRegistered && joinClose > 0
                    ? `Registration closes in ${fmtLeft(joinClose)}`
                    : '';
        return {
            canJoin: joinOpen,
            canLeave: leaveOpen,
            joinReason,
            leaveReason,
            withdrawClosesIn: term.meRegistered && withdrawClose > 0 ? withdrawClose : null,
            joinClosesIn: !term.meRegistered && joinClose > 0 ? joinClose : null,
            info
        };
    };

    const registerList = useMemo(() => {
        let list = withMine.filter((t) => !t.meRegistered && t.regOpen && t.date.getTime() >= Date.now());
        if (range === '30d') list = list.filter((t) => Math.abs(t.date.getTime() - Date.now()) <= 30 * 86400000);
        if (courseFilter !== 'all') list = list.filter((t) => t.courseCode === courseFilter);
        const q = norm(search);
        if (q)
            list = list.filter(
                (t) =>
                    norm(t.courseName).includes(q) ||
                    norm(t.courseCode).includes(q) ||
                    norm(t.examiner).includes(q) ||
                    norm(t.room).includes(q) ||
                    norm(t.building).includes(q)
            );
        return list
            .map((t) => ({ ...t, _conflict: isConflict(t) }))
            .sort((a, b) => a.date - b.date);
    }, [withMine, range, courseFilter, search, registrations]);

    const baseList = useMemo(() => {
        let list = withMine.slice();
        if (pageTab === 'terms' && view === 'my') list = list.filter((t) => t.meRegistered);
        if (pageTab === 'terms' && view === 'my' && myTab === 'upcoming') list = list.filter((t) => t.date.getTime() >= Date.now());
        if (pageTab === 'terms' && view === 'my' && myTab === 'past') list = list.filter((t) => t.date.getTime() < Date.now());
        if (courseFilter !== 'all') list = list.filter((t) => t.courseCode === courseFilter);
        if (regFilter === 'registered') list = list.filter((t) => t.meRegistered);
        if (regFilter === 'not') list = list.filter((t) => !t.meRegistered);
        if (range === '30d') list = list.filter((t) => Math.abs(t.date.getTime() - Date.now()) <= 30 * 86400000 || t.meRegistered);
        const q = norm(search);
        if (q)
            list = list.filter(
                (t) =>
                    norm(t.courseName).includes(q) ||
                    norm(t.courseCode).includes(q) ||
                    norm(t.examiner).includes(q) ||
                    norm(t.room).includes(q) ||
                    norm(t.building).includes(q)
            );
        return list.sort((a, b) => a.date - b.date);
    }, [withMine, pageTab, view, myTab, courseFilter, regFilter, search, range]);

    const byCourse = useMemo(() => groupBy(baseList, (x) => `${x.courseName}|${x.courseCode}`), [baseList]);
    const byDay = useMemo(() => groupBy(baseList, (x) => x.date.toDateString()), [baseList]);
    const byCourseReg = useMemo(() => groupBy(registerList, (x) => `${x.courseName}|${x.courseCode}`), [registerList]);
    const byDayReg = useMemo(() => groupBy(registerList, (x) => x.date.toDateString()), [registerList]);

    const conflicts = useMemo(() => {
        const mine = withMine.filter((t) => t.meRegistered && t.date.getTime() >= Date.now());
        const res = new Set();
        for (let i = 0; i < mine.length; i++) {
            for (let j = i + 1; j < mine.length; j++) {
                const a = mine[i],
                    b = mine[j];
                const overlap = a.date < b.endDate && b.date < a.endDate;
                if (overlap) {
                    res.add(a.id);
                    res.add(b.id);
                }
            }
        }
        return res;
    }, [withMine]);

    const toggleRegistration = async (term, join) => {
        const p = policyFor(term);
        if (join && !p.canJoin) {
            guardedNotify('terms-block-join', 'error', p.joinReason || 'Cannot register', { title: 'Registration blocked', lockMs: 3500 });
            return;
        }
        if (!join && !p.canLeave) {
            guardedNotify('terms-block-leave', 'error', p.leaveReason || 'Cannot unregister', { title: 'Unregister blocked', lockMs: 3500 });
            return;
        }
        
        // Mark this term as pending to ignore our own SignalR echo
        pendingOpsRef.current.add(term.id);
        
        // Optimistic UI update
        const prev = new Map(registrations);
        const optimistic = new Map(prev);
        if (join) optimistic.set(term.id, true); else optimistic.delete(term.id);
        console.log('[terminy] toggleRegistration - before:', { termId: term.id, join, prevSize: prev.size, optimisticSize: optimistic.size, hasTerm: optimistic.has(term.id) });
        setRegistrations(optimistic);
        console.log('[terminy] toggleRegistration - setRegistrations called');
        
        // Also update allTerms optimistically
        setAllTerms(prev => prev.map(t => 
            t.id === term.id ? { ...t, meRegistered: join } : t
        ));
        
        try {
            if (join) await registerForTerm(term.id);
            else await unregisterFromTerm(term.id);
            console.log('[terminy] toggleRegistration - API success');
            notify('success', join ? 'Registered' : 'Unregistered', { title: 'Success' });
            
            // Clear pending after a delay to allow SignalR echoes to be ignored
            setTimeout(() => {
                pendingOpsRef.current.delete(term.id);
            }, 2000);
        } catch (e) {
            // Check if error is "Not registered" - this means state is already correct
            const errorMsg = e?.response?.data?.error || e?.message || '';
            const isAlreadyInDesiredState = 
                (!join && errorMsg.toLowerCase().includes('not registered')) ||
                (join && errorMsg.toLowerCase().includes('already registered'));
            
            if (isAlreadyInDesiredState) {
                // State is already what we want, keep optimistic update
                console.log('[terminy] toggleRegistration - state already correct, keeping optimistic update');
                pendingOpsRef.current.delete(term.id);
                notify('info', join ? 'Already registered' : 'Already unregistered', { title: 'Info' });
                return;
            }
            
            // Actual error - revert
            console.log('[terminy] toggleRegistration - API error, reverting');
            pendingOpsRef.current.delete(term.id);
            setRegistrations(prev);
            setAllTerms(prevTerms => prevTerms.map(t => 
                t.id === term.id ? { ...t, meRegistered: !join } : t
            ));
            const msg = extractApiErrorMessage(e, 'Request failed');
            guardedNotify('terms-request-error', 'error', msg, { title: 'Server error', lockMs: 3500 });
        }
    };

    const exportCSV = () => {
        const source = pageTab === 'register' ? registerList : baseList;
        const rows = [['Course', 'Code', 'Date', 'Start', 'End', 'Room', 'Examiner', 'Capacity', 'Registered', 'Mine']];
        source.forEach((t) => {
            const d = t.date;
            rows.push([
                t.courseName,
                t.courseCode,
                d.toLocaleDateString(),
                `${to2(d.getHours())}:${to2(d.getMinutes())}`,
                `${to2(t.endDate.getHours())}:${to2(t.endDate.getMinutes())}`,
                `${t.building} ${t.room}`,
                t.examiner,
                String(t.capacity),
                String(t.registered + (registrations.get(t.id) ? 1 : 0)),
                registrations.get(t.id) ? 'Yes' : 'No'
            ]);
        });
        const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, pageTab === 'register' ? 'registration_terms.csv' : 'exam_terms.csv');
        guardedNotify('terms-export-csv', 'success', 'CSV exported', { title: 'Export', lockMs: 2500 });
    };

    const dynamicSide = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Header userRole="student" userName={fullName} onLogout={() => {}} />
            <RoleSidebar userRole="student" isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

            <div className={`${dynamicSide} ml-0 transition-all duration-300 mt-[var(--hdr-h)] min-h-[calc(100vh-var(--hdr-h))] flex flex-col`} role="main" aria-label="Exam Terms">
                <main className="flex-1">
                    <div className="px-6 pt-3 pb-6">
                        <Reveal className="mb-4" variant="keycap" waitForLoaders={true}>
                            <NavigationBreadcrumb />
                        </Reveal>
                        <Reveal delay={ANIMATION_DELAYS.TABS} variant="keycap" waitForLoaders={true}>
                            <div className="glass-card rounded-xl border border-border p-3 sm:p-4 mb-4">
                                <TabBar
                                value={pageTab}
                                onChange={(val) => {
                                    setPageTab(val);
                                    if (val === 'terms') clearFiltersTo('terms');
                                    if (val === 'register') clearFiltersTo('register');
                                }}
                                items={[
                                    { value: 'terms', label: 'My Terms', icon: 'CalendarDays' },
                                    { value: 'register', label: 'Registration', icon: 'ListChecks' },
                                ]}
                                className="gap-2"
                            />
                        </div>
                        </Reveal>

                        <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="slideScale" waitForLoaders={true}>
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                            {pageTab === 'register' ? (
                                <div className="xl:col-span-2 space-y-6">
                                    <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
                                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                                    <Icon name="ListChecks" size={18} className="text-primary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Registration</h1>
                                                    <p className="text-sm text-muted-foreground">Select an exam term to register</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto">
                                                <Select options={[{ value: 'none', label: 'No grouping' }, { value: 'course', label: 'Group by course' }, { value: 'day', label: 'Group by day' }]} value={groupMode} onChange={(v) => setGroupMode(asString(v))} className="w-full [&>button]:w-full [&>button]:truncate" />
                                                <Select options={courseOptions} value={courseFilter} onChange={(v) => setCourseFilter(asString(v))} className="w-full [&>button]:w-full [&>button]:truncate" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div className="flex items-center gap-2 w-full lg:w-auto">
                                                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
                                                <Button variant="outline" size="sm" iconName="Download" onClick={exportCSV}>Export CSV</Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-1 gap-3 w-full lg:w-auto">
                                                <Button type="button" variant="ghost" size="sm" iconName="Sparkles" onClick={clearFilters}>Clear filters</Button>
                                            </div>
                                        </div>
                                    </div>

                                    {groupMode === 'course' && (
                                        <div className="space-y-6">
                                            {Object.entries(byCourseReg).map(([key, list]) => {
                                                const [label, code] = key.split('|');
                                                return (
                                                    <section key={key} className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-lg font-semibold text-foreground">{label}</h3>
                                                            <span className="text-sm text-muted-foreground">{code} • {list.length} terms</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                                            {list.map((t) => (
                                                                <div key={t.id} className="h-full">
                                                                    <TermCard term={t} onToggle={toggleRegistration} disabled={t._conflict} policy={policyFor(t)} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                            {registerList.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No terms available for registration.</div>
                                            )}
                                        </div>
                                    )}

                                    {groupMode === 'day' && (
                                        <div className="space-y-6">
                                            {Object.entries(byDayReg).map(([day, list]) => (
                                                <section key={day} className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-lg font-semibold text-foreground">{weekdayNames[new Date(day).getDay()]}, {new Date(day).toLocaleDateString()}</h3>
                                                        <span className="text-sm text-muted-foreground">{list.length} terms</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                                        {list.map((t) => (
                                                            <div key={t.id} className="h-full">
                                                                <TermCard term={t} onToggle={toggleRegistration} disabled={t._conflict} policy={policyFor(t)} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            ))}
                                            {registerList.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No terms available for registration.</div>
                                            )}
                                        </div>
                                    )}

                                    {groupMode === 'none' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
                                                {registerList.map((t) => (
                                                    <div key={t.id} className="h-full">
                                                        <TermCard term={t} onToggle={toggleRegistration} disabled={t._conflict} policy={policyFor(t)} />
                                                    </div>
                                                ))}
                                            </div>
                                            {registerList.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground mt-6">No terms available for registration.</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="xl:col-span-2 space-y-6">
                                    <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
                                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                                    <Icon name="CalendarDays" size={18} className="text-primary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">My Terms</h1>
                                                    <p className="text-sm text-muted-foreground">Overview of your registered and available terms</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto">
                                                <Select options={[{ value: 'my', label: 'My terms' }, { value: 'all', label: 'All' }]} value={view} onChange={(v) => setView(asString(v))} className="w-full [&>button]:w-full [&>button]:truncate" />
                                                <Select options={[{ value: 'none', label: 'No grouping' }, { value: 'course', label: 'Group by course' }, { value: 'day', label: 'Group by day' }]} value={groupMode} onChange={(v) => setGroupMode(asString(v))} className="w-full [&>button]:w-full [&>button]:truncate" />
                                            </div>
                                        </div>
                                    </div>

                                    {view === 'my' && (
                                        <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button size="sm" variant={myTab === 'upcoming' ? 'default' : 'outline'} onClick={() => setMyTab('upcoming')} iconName="Clock">I’m registered — upcoming</Button>
                                                <Button size="sm" variant={myTab === 'past' ? 'default' : 'outline'} onClick={() => setMyTab('past')} iconName="History">I’m registered — past</Button>
                                                <Button size="sm" variant={myTab === 'all' ? 'default' : 'outline'} onClick={() => setMyTab('all')} iconName="ListChecks">All</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div className="flex items-center gap-2 w-full lg:w-auto">
                                                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
                                                <Button variant="outline" size="sm" iconName="Download" onClick={exportCSV}>Export CSV</Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                                                <Select options={[{ value: 'any', label: 'Registration: All' }, { value: 'registered', label: 'Registered' }, { value: 'not', label: 'Not registered' }]} value={regFilter} onChange={(v) => setRegFilter(asString(v))} className="w-full [&>button]:w-full [&>button]:truncate" />
                                                <Select options={courseOptions} value={courseFilter} onChange={(v) => setCourseFilter(asString(v))} className="w-full [&>button]:w-full [&>button]:truncate" />
                                                <Button type="button" variant="ghost" size="sm" iconName="Sparkles" onClick={clearFilters}>Clear filters</Button>
                                            </div>
                                        </div>
                                    </div>

                                    {groupMode === 'course' && (
                                        <div className="space-y-6">
                                            {Object.entries(byCourse).map(([key, list]) => {
                                                const [label, code] = key.split('|');
                                                return (
                                                    <section key={key} className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-lg font-semibold text-foreground">{label}</h3>
                                                            <span className="text-sm text-muted-foreground">{code} • {list.length} terms</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                                            {list.map((t) => (
                                                                <div key={t.id} className={`h-full ${conflicts.has(t.id) ? 'ring-1 ring-amber-500/40 rounded-lg' : ''}`}>
                                                                    <TermCard term={t} onToggle={toggleRegistration} disabled={conflicts.has(t.id)} policy={policyFor(t)} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                            {baseList.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No terms.</div>
                                            )}
                                        </div>
                                    )}

                                    {groupMode === 'day' && (
                                        <div className="space-y-6">
                                            {Object.entries(byDay).map(([day, list]) => (
                                                <section key={day} className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-lg font-semibold text-foreground">{weekdayNames[new Date(day).getDay()]}, {new Date(day).toLocaleDateString()}</h3>
                                                        <span className="text-sm text-muted-foreground">{list.length} terms</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                                        {list.map((t) => (
                                                            <div key={t.id} className={`h-full ${conflicts.has(t.id) ? 'ring-1 ring-amber-500/40 rounded-lg' : ''}`}>
                                                                <TermCard term={t} onToggle={toggleRegistration} disabled={conflicts.has(t.id)} policy={policyFor(t)} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            ))}
                                            {baseList.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No terms.</div>
                                            )}
                                        </div>
                                    )}

                                    {groupMode === 'none' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
                                                {baseList.map((t) => (
                                                    <div key={t.id} className={`h-full ${conflicts.has(t.id) ? 'ring-1 ring-amber-500/40 rounded-lg' : ''}`}>
                                                        <TermCard term={t} onToggle={toggleRegistration} disabled={conflicts.has(t.id)} policy={policyFor(t)} />
                                                    </div>
                                                ))}
                                            </div>
                                            {baseList.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground mt-6">No terms.</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            <aside className="xl:col-span-1">
                                <QuickActionPanel
                                    userRole="student"
                                    className="sticky top-24"
                                    onQuickAction={undefined}
                                />
                            </aside>
                        </div>
                        </Reveal>
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

export default function Terminy() {
    return (
        <ToastsProvider>
            <TerminyInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
}