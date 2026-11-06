// src/pages/final-thesis/components/FinalThesisInner.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../../components/ui/Header';
import RoleSidebar from '../../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../../components/ui/NavigationBreadcrumb';
import Button from '../../../components/ui/Button';
import PageFooter from '../../../components/ui/PageFooter';
import TabBar from '../../../components/ui/TabBar';
import { useAuth } from '../../../contexts/AuthContext';
import useProfileDisplayName from '../../../hooks/useProfileDisplayName';
import { useToasts } from '../../../components/ui/Toasts';
import useDataUpdates from '../../../hooks/useDataUpdates';
import useThesisHub from '../../../hooks/useThesisHub';
import PageStyles from './PageStyles';
import Metric from './Metric';
import MyThesis from './MyThesis';
import RequestsSection from './RequestsSection';
import SearchSection from './SearchSection';
import GradingScaleTable from './GradingScaleTable';
import BcArchivedDetail from './bc/BcArchivedDetail';
import EditTextModal from './modals/EditTextModal';
import ConfirmModal from './modals/ConfirmModal';
import RequestModal from './modals/RequestModal';
import { nowIso, asFilePreview, validateFile } from '../utils/thesisUtils';
import { fetchFaculty } from '../../../data/maisApiAdapter';
import DataLoader from '../../../components/ui/DataLoader';
import {
    getMyThesis,
    submitMyThesis,
    getMyRequests,
    createRequest as createRequestApi,
    updateRequest as updateRequestApi,
    cancelRequest as cancelRequestApi,
    deleteRequest as deleteRequestApi,
    listTopics,
} from '../../../data/thesisApi';
import { formatLastLogin } from '../../../utils/datetime';
import Reveal from '../../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../../constants/animations';
import useSelectedStudyValue from '../../../hooks/useSelectedStudyValue';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';

// Removed all localStorage usage for final-thesis as requested

export default function FinalThesisInner() {
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
    const toastLocks = useRef({});
    const guardedNotify = useCallback((key, type, message, opts = {}) => {
        if (key) {
            const now = Date.now();
            const lock = opts.lockMs ?? 2600;
            const prev = toastLocks.current[key] ?? 0;
            if (now - prev < lock) return;
            toastLocks.current[key] = now;
        }
        notify(type, message, opts);
    }, [notify]);
    const navigate = useNavigate();
    const location = useLocation();
    const search = new URLSearchParams(location.search);
    const urlArchived = search.get('archived') === '1' || location.pathname.toLowerCase().includes('archived');
    const selectedStudyResult = useSelectedStudyValue();
    const selectedStudy = selectedStudyResult.value;
    const isSelectedArchived = !!selectedStudy && selectedStudy.ongoing === false;

    const { user } = useAuth() || {};
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
    const headerDisplayName = useProfileDisplayName('Student');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [tab, setTab] = useState('my');

    const [myThesis, setMyThesis] = useState(null);
    const [requests, setRequests] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [bookmarks, setBookmarks] = useState([]);
    const [loadingThesis, setLoadingThesis] = useState(true);
    const [loadingTopics, setLoadingTopics] = useState(true);
    const [loadingSupervisors, setLoadingSupervisors] = useState(true);

    // Initial data load from API
    useEffect(() => {
        const load = async () => {
            try {
                const [mt, reqs] = await Promise.all([
                    getMyThesis(),
                    getMyRequests(),
                ]);
                console.log('[FinalThesisInner] Loaded myThesis:', mt);
                console.log('[FinalThesisInner] Loaded requests:', reqs);
                setMyThesis(mt || null);
                setRequests(Array.isArray(reqs) ? reqs : []);
            } catch (err) {
                console.error('[FinalThesisInner] Error loading data:', err);
            }
            finally {
                setLoadingThesis(false);
            }
        };
        load();
    }, []);

    // Listen for data updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        console.log('[FinalThesisInner] DataUpdate received:', payload);
        if (!payload || !payload.type) return;
        
        // Refresh on thesis-related updates
        if (payload.type === 'thesis.updated' || payload.type === 'thesis.created' || payload.type === 'thesis.deleted') {
            console.log('[FinalThesisInner] Reloading thesis data...');
            // Reload my thesis and requests
            Promise.all([
                getMyThesis(),
                getMyRequests(),
            ]).then(([mt, reqs]) => {
                console.log('[FinalThesisInner] Reloaded myThesis:', mt);
                console.log('[FinalThesisInner] Reloaded requests:', reqs);
                setMyThesis(mt || null);
                setRequests(Array.isArray(reqs) ? reqs : []);
            }).catch((err) => {
                console.error('[FinalThesisInner] Error reloading data:', err);
            });
        }
    }, []);

    useDataUpdates(handleDataUpdate);

    // Dedicated ThesisHub for real-time thesis updates
    useThesisHub({
        onThesisUpdated: useCallback(() => {
            getMyThesis().then(mt => setMyThesis(mt || null)).catch(()=>{});
        }, []),
        onThesisRequestCreated: useCallback(() => {
            getMyRequests().then(reqs => setRequests(Array.isArray(reqs) ? reqs : [])).catch(()=>{});
        }, []),
        onThesisRequestUpdated: useCallback(() => {
            getMyRequests().then(reqs => setRequests(Array.isArray(reqs) ? reqs : [])).catch(()=>{});
        }, []),
        onThesisAssigned: useCallback(() => {
            Promise.all([getMyThesis(), getMyRequests()]).then(([mt, reqs]) => {
                setMyThesis(mt || null);
                setRequests(Array.isArray(reqs) ? reqs : []);
            }).catch(()=>{});
        }, [])
    });

    // Load assignments (topics) matching current default filters
    useEffect(() => {
        const load = async () => {
            try {
                const list = await listTopics({
                    year: '2025/2026',
                    state: 'unassigned',
                });
                setAssignments(Array.isArray(list) ? list : []);
            } catch {
                setAssignments([]);
            } finally {
                setLoadingTopics(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [editAbstractOpen, setEditAbstractOpen] = useState(false);
    const [editAnnotationOpen, setEditAnnotationOpen] = useState(false);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

    const fileInputRef = useRef(null);
    const handleUploadClick = () => fileInputRef.current && fileInputRef.current.click();

    const addAttachments = (files) => {
        if (!myThesis) return;
        const next = [...(myThesis.attachments || [])];
        const arr = files ? Array.from(files) : [];
        let ok = 0, bad = 0;
        arr.forEach((f) => {
            const err = validateFile(f);
            if (err) { bad++; return; }
            next.push(asFilePreview(f));
            ok++;
        });
        setMyThesis({ ...myThesis, attachments: next });
        if (ok && !bad) notify('success', `Uploaded ${ok} file${ok > 1 ? 's' : ''}`, { title: 'Upload complete' });
        else if (ok && bad) guardedNotify('thesis-upload-partial', 'info', `Uploaded ${ok}, skipped ${bad}`, { title: 'Partial upload', lockMs: 3200 });
        else if (!ok && bad) notify('error', 'No files uploaded: invalid type/size', { title: 'Upload failed' });
    };

    const removeAttachment = (id) => {
        if (!myThesis) return;
        setMyThesis((prev) => ({ ...prev, attachments: (prev.attachments || []).filter((a) => a.id !== id) }));
        guardedNotify('thesis-attachment-removed', 'info', 'Attachment removed', { title: 'Removed', lockMs: 2800 });
    };

    const exportJson = () => {
        try {
            if (!myThesis) { notify('error', 'Nothing to export'); return; }
            const blob = new Blob([JSON.stringify(myThesis, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `thesis_${myThesis.identifier || 'data'}.json`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            guardedNotify('thesis-export-json', 'success', 'Exported JSON', { title: 'Export ready', lockMs: 3200 });
        } catch {
            notify('error', 'Export failed');
        }
    };

    const markSubmitted = async (note) => {
        if (!myThesis) return;
        const statusLocked = ['submitted', 'defended', 'graded'].includes(String(myThesis.status || '').toLowerCase());
        if (statusLocked) { notify('error', 'Already submitted'); return; }
        try {
            await submitMyThesis(note);
            const mt = await getMyThesis();
            setMyThesis(mt || { ...myThesis, status: 'submitted', submittedAt: nowIso() });
            setTimeout(() => {
                notify('success', 'Thesis marked as submitted', { title: 'Submitted' });
            }, 300);
        } catch {
            setTimeout(() => {
                notify('error', 'Submission failed');
            }, 100);
        }
    };

    const metrics = useMemo(() => {
        const reqs = requests.length;
        const open = requests.filter((r) => r.status === 'submitted' || r.status === 'draft').length;
        const approved = requests.filter((r) => r.status === 'approved').length;
        console.log('[FinalThesisInner] Metrics calculated:', { reqs, open, approved });
        console.log('[FinalThesisInner] Requests details:', requests.map(r => ({ 
            id: r.id, 
            topic: r.topic, 
            program: r.program, 
            status: r.status,
            supervisorId: r.supervisorId 
        })));
        return { reqs, open, approved };
    }, [requests]);

    const [requestOpen, setRequestOpen] = useState(false);
    const [requestEdit, setRequestEdit] = useState(null);

    const saveRequest = async (draft) => {
        try {
            if (draft.id) await updateRequestApi(draft.id, draft); else await createRequestApi(draft);
            const reqs = await getMyRequests();
            setRequests(Array.isArray(reqs)?reqs:[]);
            setRequestOpen(false);
            setRequestEdit(null);
            setTab('requests');
            setTimeout(() => {
                notify('success', draft.status === 'submitted' ? 'Request submitted' : 'Draft saved', { title: draft.status === 'submitted' ? 'Submitted' : 'Saved' });
            }, 300);
        } catch {
            setTimeout(() => {
                notify('error', 'Failed to save request');
            }, 100);
        }
    };

    const deleteRequest = async (id) => {
        try {
            await deleteRequestApi(id);
            const reqs = await getMyRequests();
            setRequests(Array.isArray(reqs)?reqs:[]);
            setTimeout(() => {
                guardedNotify('thesis-request-delete', 'info', 'Request deleted', { title: 'Deleted', lockMs: 3000 });
            }, 300);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-request-delete-error', 'error', 'Delete failed', { title: 'Error' });
            }, 100);
        }
    };

    const cancelRequest = async (id) => {
        try {
            await cancelRequestApi(id);
            const reqs = await getMyRequests();
            setRequests(Array.isArray(reqs)?reqs:[]);
            setTimeout(() => {
                guardedNotify('thesis-request-cancel', 'info', 'Request canceled', { title: 'Canceled', lockMs: 3000 });
            }, 300);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-request-cancel-error', 'error', 'Cancel failed', { title: 'Error' });
            }, 100);
        }
    };

    const supervisors = useMemo(() => [], []);
    const [supervisorOptions, setSupervisorOptions] = useState([]);
    useEffect(() => {
        const load = async () => {
            try {
                const fac = await fetchFaculty({ pageSize: 50 });
                const opts = (Array.isArray(fac)?fac:[]).map((t) => ({ id: t?.email || t?.fullName || t?.name || '', name: t?.fullName || t?.name || t?.email || 'Teacher' }));
                setSupervisorOptions(opts);
            } catch {
                setSupervisorOptions([]);
            } finally {
                setLoadingSupervisors(false);
            }
        };
        load();
    }, []);

    const [filters, setFilters] = useState({
        year: '2025/2026',
        degree: 'all',
        faculty: 'all',
        department: 'all',
        program: 'all',
        state: 'unassigned',
        q: '',
        sort: 'newest'
    });

    const filterOptions = useMemo(() => {
        const years = ['2025/2026'];
        const facSet = new Set();
        const depSet = new Set();
        const progSet = new Set();
        assignments.forEach((a) => {
            if (a.faculty) facSet.add(a.faculty);
            if (a.department) depSet.add(a.department);
            if (a.programLabel) progSet.add(a.programLabel);
        });
        const faculties = Array.from(facSet).sort();
        const departments = Array.from(depSet).sort();
        const programs = Array.from(progSet).sort();
        return { years, faculties, departments, programs };
    }, [assignments]);

    const toggleBookmark = (assignmentId) => {
        setBookmarks((prev) => prev.includes(assignmentId) ? prev.filter((id) => id !== assignmentId) : [...prev, assignmentId]);
    };

    const filteredAssignmentsRaw = useMemo(() => {
        const s = (v) => String(v || '').toLowerCase().trim();
        return assignments.filter((a) => {
            if (filters.year && a.academicYear !== filters.year) return false;
            if (filters.degree !== 'all') {
                const isB = filters.degree === 'bsc';
                if (isB && a.type !== 'Bachelor thesis') return false;
                if (!isB && a.type !== 'Master thesis') return false;
            }
            if (filters.faculty !== 'all' && a.faculty !== filters.faculty) return false;
            if (filters.department !== 'all' && a.department !== filters.department) return false;
            if (filters.state !== 'all' && a.state !== filters.state) return false;
            if (filters.q.trim()) {
                const t = s(filters.q);
                const hay = `${a.title} ${a.description} ${a.supervisor?.name} ${(a.keywords || []).join(' ')}`.toLowerCase();
                if (!hay.includes(t)) return false;
            }
            return true;
        });
    }, [assignments, filters]);

    const sortedAssignments = useMemo(() => {
        const list = filteredAssignmentsRaw.slice();
        if (filters.sort === 'newest') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        else if (filters.sort === 'oldest') list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        else if (filters.sort === 'title') list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
        else if (filters.sort === 'supervisor') list.sort((a, b) => String(a.supervisor?.name).localeCompare(String(b.supervisor?.name)));
        return list;
    }, [filteredAssignmentsRaw, filters.sort]);

    const [perPage, setPerPage] = useState(8);

    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(sortedAssignments.length / perPage));
    const pageData = sortedAssignments.slice((page - 1) * perPage, (page - 1) * perPage + perPage);
    useEffect(() => { setPage(1); }, [filters, perPage]);

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    const openNewRequest = (prefills) => {
        if (hasActiveThesis) { notify('error', 'You already have an assigned thesis. You cannot create another request.'); setTab('my'); return; }
        setRequestEdit({
            academicYear: '2025/2026',
            degree: 'msc',
            studyForm: 'full-time',
            language: 'EN',
            status: 'draft',
            ...(prefills || {})
        });
        setRequestOpen(true);
    };

    const statusLower = String(myThesis?.status || '').toLowerCase();
    const isReadOnlyByStatus = ['submitted', 'defended', 'graded'].includes(statusLower);
    const hasActiveThesis = !!myThesis && ['assigned','submitted','defended','graded'].includes(statusLower);
    const isArchivedView = urlArchived || isSelectedArchived;

    if (isArchivedView) {
        return (
            <div className="min-h-screen bg-background thesis-zfix overflow-x-hidden">
                <PageStyles />
                <Header userRole="student" userName={headerDisplayName} onLogout={() => navigate('/')} />
                <RoleSidebar userRole="student" isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((s) => !s)} />
                <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Final thesis archived">
                    <main className="flex-1">
                        <div className="p-6">
                            <NavigationBreadcrumb />
                            <div className="mb-4 flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-2xl font-bold text-foreground truncate">Final Thesis</h1>
                                        <span className="hidden md:inline kbd">Student</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">Assignments, requests, and progress until defense.</p>
                                </div>
                                <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-amber-500/10 border-amber-500/30 text-amber-100">Archived study</div>
                            </div>
                            <div className="mt-6 space-y-6">
                                <GradingScaleTable />
                                <BcArchivedDetail />
                            </div>
                        </div>
                    </main>
                    <PageFooter
                        left={[
                            'MAIS 2.0 • Student Portal',
                            lastLoginLabel,
                        ]}
                        right={
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    key="help"
                                    variant="ghost"
                                    size="sm"
                                    iconName="HelpCircle"
                                    onClick={() => navigate('/help')}
                                >
                                    Help
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background thesis-zfix overflow-x-hidden">
            <PageStyles />
            <Header userRole="student" userName={headerDisplayName} onLogout={() => navigate('/')} />
            <RoleSidebar userRole="student" isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((s) => !s)} />
            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Final thesis">
                <main className="flex-1">
                    <div className="p-6">
                        <Reveal className="mb-4" variant="keycap" waitForLoaders={true}>
                            <NavigationBreadcrumb />
                        </Reveal>
                        {(loadingThesis || loadingTopics || loadingSupervisors) && (
                          <DataLoader
                            label="Loading thesis workspace…"
                            description="Fetching thesis details, assignment board, and supervisors."
                            details={[
                              'Personal thesis dossier • attachments • timeline',
                              'Request pipeline • approvals • historical feedback',
                              'Topic marketplace feed & supervisor availability scan',
                            ]}
                            fullScreen
                          />
                        )}
                        <Reveal as={motion.div} className="mb-4" delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true}>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-foreground truncate">Final Thesis</h1>
                            </div>
                            <p className="text-sm text-muted-foreground">Assignments, requests, and progress until defense.</p>
                        </Reveal>

                        <Reveal as={motion.div} className="mb-6" delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                <Metric label="My requests" value={metrics.reqs} delay={0.1} />
                                <Metric label="Open" value={metrics.open} delay={0.15} />
                                <Metric label="Approved" value={metrics.approved} delay={0.2} />
                            </div>
                        </Reveal>

                        <Reveal as={motion.div} className="bg-card rounded-lg border border-border p-3 sm:p-4" delay={ANIMATION_DELAYS.TABS} variant="keycap" waitForLoaders={true}>
                            <TabBar
                                value={tab}
                                onChange={setTab}
                                items={[
                                    { value: 'my', label: 'My thesis', icon: 'ScrollText' },
                                    { value: 'requests', label: 'My assignment requests', icon: 'Inbox' },
                                    { value: 'search', label: 'Browse assignments', icon: 'Search' },
                                ]}
                                className="gap-2"
                            />
                        </Reveal>
                        <div className="mt-6 space-y-6">
                            {tab === 'my' && (
                                <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                                    <MyThesis
                                    myThesis={myThesis}
                                    onRemoveAttachment={removeAttachment}
                                    onExport={exportJson}
                                    onRequestUpload={() => { if (isReadOnlyByStatus) { notify('error','Read-only after submission'); return; } handleUploadClick(); }}
                                    onMarkSubmitted={() => setConfirmSubmitOpen(true)}
                                    onEditAbstract={() => { if (isReadOnlyByStatus) { notify('error','Read-only after submission'); return; } setEditAbstractOpen(true); }}
                                    onEditAnnotation={() => { if (isReadOnlyByStatus) { notify('error','Read-only after submission'); return; } setEditAnnotationOpen(true); }}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip,image/png,image/jpeg"
                                        onChange={(e) => addAttachments(e.target.files)}
                                    />
                                </MyThesis>
                                </Reveal>
                            )}
                            {tab === 'requests' && (
                                <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                                    <RequestsSection
                                    requests={requests}
                                    onNew={() => openNewRequest()}
                                    onEdit={(r) => { setRequestEdit(r); setRequestOpen(true); }}
                                    onCancel={(id) => { if (window.confirm('Cancel this request?')) cancelRequest(id); }}
                                    onDelete={(id) => { if (window.confirm('Delete this request permanently?')) deleteRequest(id); }}
                                    />
                                </Reveal>
                            )}
                            {tab === 'search' && (
                                <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                                    <SearchSection
                                    filters={filters}
                                    setFilters={setFilters}
                                    page={page}
                                    setPage={setPage}
                                    perPage={perPage}
                                    setPerPage={setPerPage}
                                    totalPages={totalPages}
                                    data={pageData}
                                    filterOptions={filterOptions}
                                    isBookmarked={(id) => bookmarks.includes(id)}
                                    onToggleBookmark={toggleBookmark}
                                    onRequestTopic={(a) => {
                                        if (hasActiveThesis) { notify('error', 'You already have an assigned thesis and cannot request another.'); setTab('my'); return; }
                                        // Check if this topic was already requested
                                        const alreadyRequested = requests.some(r => r.topic === a.title && r.supervisorId === a.supervisor?.email);
                                        if (alreadyRequested) {
                                            notify('error', 'You have already requested this topic. Check "My assignment requests" tab.');
                                            setTab('requests');
                                            return;
                                        }
                                        const supId = supervisorOptions.find((s) => s.name === a.supervisor?.name)?.id;
                                        openNewRequest({
                                            academicYear: a.academicYear,
                                            degree: a.type === 'Bachelor thesis' ? 'bsc' : 'msc',
                                            studyForm: 'full-time',
                                            program: a.programLabel || a.program,
                                            language: 'EN',
                                            supervisorId: supId,
                                            topic: a.title,
                                            keywords: (a.keywords || []).join(', '),
                                            note: `Requesting topic ID ${a.id} from ${a.supervisor?.name}`
                                        });
                                    }}
                                    />
                                </Reveal>
                            )}
                        </div>
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
                            type="button"
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
            <EditTextModal
                open={editAbstractOpen}
                title="Edit Abstract"
                value={myThesis?.abstract || ''}
                onSave={(v) => { setMyThesis((t) => ({ ...t, abstract: v })); notify('success', 'Abstract updated', { title: 'Saved' }); }}
                onClose={() => setEditAbstractOpen(false)}
                placeholder="Write a concise summary of your thesis..."
            />
            <EditTextModal
                open={editAnnotationOpen}
                title="Edit Annotation"
                value={myThesis?.annotation || ''}
                onSave={(v) => { setMyThesis((t) => ({ ...t, annotation: v })); notify('success', 'Annotation updated', { title: 'Saved' }); }}
                onClose={() => setEditAnnotationOpen(false)}
                placeholder="Short annotation used by library and catalog systems..."
            />
            <RequestModal
                open={requestOpen}
                value={requestEdit}
                supervisors={supervisorOptions}
                onClose={() => { setRequestOpen(false); setRequestEdit(null); }}
                onSave={saveRequest}
            />
            <ConfirmModal
                open={confirmSubmitOpen}
                title="Mark as submitted?"
                message="This will set the thesis status to Submitted. After submission this page switches to the read-only view."
                confirmLabel="Mark submitted"
                cancelLabel="Not now"
                requireNote
                onConfirm={(note) => markSubmitted(note)}
                onClose={() => setConfirmSubmitOpen(false)}
            />
        </div>
    );
}