// src/pages/final-thesis/FinalThesisTeacher.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Icon from '../../components/AppIcon';
import TabBar from '../../components/ui/TabBar';
import { useAuth } from '../../contexts/AuthContext';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import useDataUpdates from '../../hooks/useDataUpdates';
import useThesisHub from '../../hooks/useThesisHub';
import PageStyles from './FinalThesisTeacherParts/styles';
import { Pill, Metric } from './FinalThesisTeacherParts/ui';
import { slug, fmt, fmtDT, nowIso, pageNums, asFilePreview, validateFile } from './utils/utils';
import { maisId } from '../../utils/ids';
import { fetchPrograms } from '../../data/programsApi';
import {
    listMyTopics,
    createTopic as createTopicApi,
    updateTopic as updateTopicApi,
    deleteTopicApi,
    listIncomingRequests,
    approveRequestApi,
    returnRequestApi,
    rejectRequestApi,
    listSupervisions,
    updateSupervisionStatus,
    scheduleDefenseApi,
    updateOriginalityApi,
    appendGradesApi,
} from '../../data/thesisApi';
import { ReviewRequestModal, TopicModal, DefenseModal, OriginalityModal, GradeModal } from './FinalThesisTeacherParts/modals';
import { formatLastLogin } from '../../utils/datetime';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

const FinalThesisTeacherInner = () => {
    const navigate = useNavigate();
    const { user } = useAuth() || {};
    const headerDisplayName = useProfileDisplayName('Teacher');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
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

    const teacher = useMemo(()=>({
        id: user?.id || user?.email || 'teacher',
        name: user?.full_name || user?.email?.split('@')[0] || 'Teacher',
        email: user?.email || '',
        faculty: user?.faculty || 'FEI',
        department: user?.department || 'KPI',
        program: user?.program || 'Cybersecurity',
    }),[user]);

    const [topics, setTopics] = useState([]);
    const [requests, setRequests] = useState([]);
    const [supervisions, setSupervisions] = useState([]);
    const [programs, setPrograms] = useState([]);

    useEffect(()=>{
        // Load programs from API
        fetchPrograms().then(data => setPrograms(Array.isArray(data) ? data : [])).catch(() => setPrograms([]));
    }, []);

    useEffect(()=>{
        const load = async ()=>{
            try {
                const [t, r, s] = await Promise.all([
                    listMyTopics(teacher.email),
                    listIncomingRequests(teacher.email),
                    listSupervisions(teacher.email),
                ]);
                setTopics(Array.isArray(t)?t:[]);
                setRequests(Array.isArray(r)?r:[]);
                setSupervisions(Array.isArray(s)?s:[]);
            } catch (e) { /* silent in UI */ }
        };
        if (teacher?.email) load();
    },[teacher?.email]);

    // Listen for data updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        if (!payload || !payload.type) return;
        
        // Refresh on thesis-related updates
        if (payload.type === 'thesis.updated' || payload.type === 'thesis.created' || payload.type === 'thesis.deleted') {
            // Reload all data
            if (teacher?.email) {
                Promise.all([
                    listMyTopics(teacher.email),
                    listIncomingRequests(teacher.email),
                    listSupervisions(teacher.email),
                ]).then(([t, r, s]) => {
                    setTopics(Array.isArray(t)?t:[]);
                    setRequests(Array.isArray(r)?r:[]);
                    setSupervisions(Array.isArray(s)?s:[]);
                }).catch(() => {
                    // Silently fail
                });
            }
        }
    }, [teacher?.email]);

    useDataUpdates(handleDataUpdate);

    // Dedicated ThesisHub for real-time thesis updates
    useThesisHub({
        onThesisCreated: useCallback(() => {
            if (teacher?.email) {
                listMyTopics(teacher.email).then(t => setTopics(Array.isArray(t)?t:[])).catch(()=>{});
            }
        }, [teacher?.email]),
        onThesisUpdated: useCallback(() => {
            if (teacher?.email) {
                Promise.all([
                    listMyTopics(teacher.email),
                    listSupervisions(teacher.email)
                ]).then(([t, s]) => {
                    setTopics(Array.isArray(t)?t:[]);
                    setSupervisions(Array.isArray(s)?s:[]);
                }).catch(()=>{});
            }
        }, [teacher?.email]),
        onThesisDeleted: useCallback(() => {
            if (teacher?.email) {
                listMyTopics(teacher.email).then(t => setTopics(Array.isArray(t)?t:[])).catch(()=>{});
            }
        }, [teacher?.email]),
        onThesisRequestCreated: useCallback(() => {
            if (teacher?.email) {
                listIncomingRequests(teacher.email).then(r => setRequests(Array.isArray(r)?r:[])).catch(()=>{});
            }
        }, [teacher?.email]),
        onThesisRequestUpdated: useCallback(() => {
            if (teacher?.email) {
                listIncomingRequests(teacher.email).then(r => setRequests(Array.isArray(r)?r:[])).catch(()=>{});
            }
        }, [teacher?.email]),
        onThesisAssigned: useCallback(() => {
            if (teacher?.email) {
                listSupervisions(teacher.email).then(s => setSupervisions(Array.isArray(s)?s:[])).catch(()=>{});
            }
        }, [teacher?.email])
    });

    const [tab, setTab] = useState('dashboard');

    const metrics = useMemo(()=>{
        const openReq = requests.filter(r=>r.status==='submitted').length;
        const activeTopics = topics.filter(t=>t.state==='open').length;
        const activeSup = supervisions.filter(s=>['assigned','submitted','defense','graded'].includes(String(s.status||''))).length;
        return { openReq, activeTopics, activeSup };
    },[requests, topics, supervisions]);

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewReq, setReviewReq] = useState(null);

    const openReview = (req)=>{ setReviewReq(req); setReviewOpen(true); };

    const updateRequestStatus = (id, status, message) => {
        setRequests(prev=>prev.map(r=>r.id===id?{...r, status, reviewerNote: message||'', updatedAt: nowIso()}:r));
    };

    const approveRequest = async ({ topicId, message }) => {
        if (!reviewReq) return;
        try {
            await approveRequestApi(reviewReq.id, { topicId: topicId || null, message });
            const [r, s] = await Promise.all([
                listIncomingRequests(teacher.email),
                listSupervisions(teacher.email),
            ]);
            setRequests(Array.isArray(r)?r:[]);
            setSupervisions(Array.isArray(s)?s:[]);
            setReviewOpen(false);
            setTimeout(() => {
                guardedNotify('thesis-approve-success', 'success', 'Request approved', { title: 'Success' });
            }, 100);
        } catch (e) {
            setTimeout(() => {
                guardedNotify('thesis-approve-error', 'error', 'Approve failed', { title: 'Error' });
            }, 100);
        }
    };

    const returnRequest = async ({ message }) => {
        if (!reviewReq) return;
        try {
            await returnRequestApi(reviewReq.id, { message });
            const r = await listIncomingRequests(teacher.email);
            setRequests(Array.isArray(r)?r:[]);
            setReviewOpen(false);
            setTimeout(() => {
                guardedNotify('thesis-return-success', 'info', 'Request returned', { title: 'Request returned' });
            }, 100);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-return-error', 'error', 'Return failed', { title: 'Error' });
            }, 100);
        }
    };

    const rejectRequest = async ({ message }) => {
        if (!reviewReq) return;
        try {
            await rejectRequestApi(reviewReq.id, { message });
            const r = await listIncomingRequests(teacher.email);
            setRequests(Array.isArray(r)?r:[]);
            setReviewOpen(false);
            setTimeout(() => {
                guardedNotify('thesis-reject-success', 'info', 'Request rejected', { title: 'Request rejected' });
            }, 100);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-reject-error', 'error', 'Reject failed', { title: 'Error' });
            }, 100);
        }
    };

    const [topicOpen, setTopicOpen] = useState(false);
    const [topicEdit, setTopicEdit] = useState(null);

    const saveTopic = async (draft) => {
        console.log('[saveTopic] Starting with draft:', draft);
        const data = { ...draft };
        if (typeof data.keywords === 'string') data.keywords = data.keywords.split(',').map(x=>x.trim()).filter(Boolean);
        if (!data.supervisor) data.supervisor = { id: teacher.id, name: teacher.name, email: teacher.email, department: teacher.department };
        if (!data.faculty) data.faculty = teacher.faculty;
        if (!data.department) data.department = teacher.department;
        if (!data.program) data.program = teacher.program;
        if (!data.programLabel) data.programLabel = teacher.program;
        console.log('[saveTopic] Final data to save:', data);
        try {
            if (data.id) {
                console.log('[saveTopic] Updating existing topic:', data.id);
                await updateTopicApi(data.id, data);
            } else {
                console.log('[saveTopic] Creating new topic');
                await createTopicApi(data);
            }
            const t = await listMyTopics(teacher.email);
            console.log('[saveTopic] Reloaded topics:', t);
            setTopics(Array.isArray(t)?t:[]);
            setTopicOpen(false);
            setTopicEdit(null);
            setTimeout(() => {
                guardedNotify('thesis-topic-save-success', 'success', 'Topic saved successfully', { title: 'Success' });
            }, 100);
        } catch (err) {
            console.error('[saveTopic] Error saving topic:', err);
            setTimeout(() => {
                guardedNotify('thesis-topic-save-error', 'error', `Save failed: ${err.message || 'Unknown error'}`, { title: 'Error' });
            }, 100);
        }
    };

    const deleteTopic = async (id) => {
        try {
            await deleteTopicApi(id);
            const t = await listMyTopics(teacher.email);
            setTopics(Array.isArray(t)?t:[]);
            setTimeout(() => {
                guardedNotify('thesis-topic-delete-success', 'info', 'Topic deleted', { title: 'Topic deleted' });
            }, 100);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-topic-delete-error', 'error', 'Delete failed', { title: 'Error' });
            }, 100);
        }
    };

    const [defenseOpen, setDefenseOpen] = useState(false);
    const [defenseThesis, setDefenseThesis] = useState(null);

    const [origOpen, setOrigOpen] = useState(false);
    const [origThesis, setOrigThesis] = useState(null);

    const [gradeOpen, setGradeOpen] = useState(false);
    const [gradeThesis, setGradeThesis] = useState(null);

    const setThesisStatus = async (id, status) => {
        try {
            await updateSupervisionStatus(id, status);
            const s = await listSupervisions(teacher.email);
            setSupervisions(Array.isArray(s)?s:[]);
            setTimeout(() => {
                guardedNotify('thesis-status-update-success', 'info', `Status set to ${String(status).toUpperCase()}`, { title: 'Status updated' });
            }, 100);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-status-update-error', 'error', 'Status update failed', { title: 'Error' });
            }, 100);
        }
    };

    const saveDefense = async ({ date, room }) => {
        if (!defenseThesis) return;
        try {
            await scheduleDefenseApi(defenseThesis.id, { date, room });
            const s = await listSupervisions(teacher.email);
            setSupervisions(Array.isArray(s)?s:[]);
            setDefenseOpen(false);
            setDefenseThesis(null);
            setTimeout(() => {
                guardedNotify('thesis-defense-update-success', 'success', 'Defense updated', { title: 'Success' });
            }, 100);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-defense-update-error', 'error', 'Defense update failed', { title: 'Error' });
            }, 100);
        }
    };

    const saveOriginality = async ({ percentage, protocolUrl }) => {
        if (!origThesis) return;
        try {
            await updateOriginalityApi(origThesis.id, { percentage, protocolUrl });
            const s = await listSupervisions(teacher.email);
            setSupervisions(Array.isArray(s)?s:[]);
            setOrigOpen(false);
            setOrigThesis(null);
            setTimeout(() => {
                guardedNotify('thesis-originality-save-success', 'success', 'Originality saved', { title: 'Success' });
            }, 100);
        } catch { 
            setTimeout(() => {
                guardedNotify('thesis-originality-save-error', 'error', 'Originality update failed', { title: 'Error' });
            }, 100);
        }
    };

    const appendGrades = ({ supervisorGrade, opponentGrade, commissionGrade }) => {
        if (!gradeThesis) return;
        const normalize = (v)=> {
            const t = String(v||'').trim();
            if (!t) return '';
            if (/^\d+(\.\d+)?%?$/.test(t)) return t.endsWith('%') ? t : `${t}%`;
            return t;
        };
        const sg = normalize(supervisorGrade);
        const og = normalize(opponentGrade);
        const cg = normalize(commissionGrade);
        const items = [];
        if (sg) items.push({ item:'Thesis – Supervisor', term:'Current Semester', by: teacher.name, grade: sg, date: fmt(new Date()) });
        if (og) items.push({ item:'Thesis – Opponent', term:'Current Semester', by: 'Opponent', grade: og, date: fmt(new Date()) });
        if (cg) items.push({ item:'Thesis – Defense', term:'Current Semester', by: 'Commission', grade: cg, date: fmt(new Date()) });
        if (!items.length) { guardedNotify('thesis-grades-empty', 'error', 'Nothing to add', { title: 'Error' }); return; }
        (async ()=>{
            try {
                await appendGradesApi(gradeThesis.id, items);
                const s = await listSupervisions(teacher.email);
                setSupervisions(Array.isArray(s)?s:[]);
                setGradeOpen(false);
                setGradeThesis(null);
                setTimeout(() => {
                    guardedNotify('thesis-grades-add-success', 'success', 'Grades added', { title: 'Success' });
                }, 100);
            } catch { 
                setTimeout(() => {
                    guardedNotify('thesis-grades-add-error', 'error', 'Failed to add grades', { title: 'Error' });
                }, 100);
            }
        })();
    };

    const fileInputRef = useRef(null);
    const [attachTarget, setAttachTarget] = useState(null);
    const openUpload = (thesis)=>{ setAttachTarget(thesis); if (fileInputRef.current) fileInputRef.current.click(); };

    const addAttachments = (files) => {
        if (!attachTarget) return;
        const arr = files ? Array.from(files) : [];
        let ok=0, bad=0;
        const next = [...(attachTarget.attachments||[])];
        arr.forEach(f=>{
            const err = validateFile(f);
            if (err) { bad++; return; }
            next.push(asFilePreview(maisId, f)); ok++;
        });
        setSupervisions(prev=>prev.map(s=>String(s.id)===String(attachTarget.id)?{...s, attachments: next}:s));
        setAttachTarget(null);
        setTimeout(() => {
            if (ok && !bad) guardedNotify('thesis-upload-success', 'success', `Uploaded ${ok} file${ok>1?'s':''}`, { title: 'Files uploaded' });
            else if (ok && bad) guardedNotify('thesis-upload-partial', 'info', `Uploaded ${ok}, skipped ${bad}`, { title: 'Partial upload' });
            else if (!ok && bad) guardedNotify('thesis-upload-error', 'error', 'No files uploaded: invalid type/size', { title: 'Upload failed' });
        }, 100);
    };

    const removeAttachment = (thesisId, fileId) => {
        setSupervisions(prev=>prev.map(s=>String(s.id)===String(thesisId)?{...s, attachments:(s.attachments||[]).filter(a=>a.id!==fileId)}:s));
        setTimeout(() => {
            guardedNotify('thesis-attachment-remove', 'info', 'Attachment removed', { title: 'Attachment removed' });
        }, 100);
    };

    const [reqFilters, setReqFilters] = useState({ q:'', state:'submitted', year:'all', degree:'all', sort:'newest' });
    const [topicFilters, setTopicFilters] = useState({ q:'', state:'all', type:'all', program:'all', sort:'newest' });
    const [supFilters, setSupFilters] = useState({ q:'', status:'all', program:'all', sort:'newest' });

    const [perPage, setPerPage] = useState(8);

    const [pageReq, setPageReq] = useState(1);
    const [pageTopic, setPageTopic] = useState(1);
    const [pageSup, setPageSup] = useState(1);

    const filteredReq = useMemo(()=>{
        return requests.filter(r=>{
            if (reqFilters.state!=='all' && r.status!==reqFilters.state) return false;
            if (reqFilters.year!=='all' && r.academicYear!==reqFilters.year) return false;
            if (reqFilters.degree!=='all' && r.degree!==reqFilters.degree) return false;
            if (reqFilters.q.trim()){
                const t = slug(reqFilters.q);
                const hay = `${r.student?.name} ${r.student?.email} ${r.topic} ${r.keywords} ${r.note} ${r.program}`.toLowerCase();
                if (!hay.includes(t)) return false;
            }
            return true;
        }).sort((a,b)=>{
            if (reqFilters.sort==='newest') return new Date(b.updatedAt)-new Date(a.updatedAt);
            if (reqFilters.sort==='oldest') return new Date(a.updatedAt)-new Date(b.updatedAt);
            return 0;
        });
    },[requests, reqFilters]);

    const totalReqPages = Math.max(1, Math.ceil(filteredReq.length / perPage));
    const pageReqData = filteredReq.slice((pageReq-1)*perPage, (pageReq-1)*perPage + perPage);
    useEffect(()=>setPageReq(1),[reqFilters, perPage]);

    const filteredTopics = useMemo(()=>{
        return topics.filter(t=>{
            if (topicFilters.state!=='all' && t.state!==topicFilters.state) return false;
            if (topicFilters.type!=='all' && t.type!==topicFilters.type) return false;
            if (topicFilters.program!=='all' && t.program!==topicFilters.program) return false;
            if (topicFilters.q.trim()){
                const s = slug(topicFilters.q);
                const hay = `${t.title} ${t.description} ${t.keywords?.join(' ')}`.toLowerCase();
                if (!hay.includes(s)) return false;
            }
            return true;
        }).sort((a,b)=>{
            if (topicFilters.sort==='newest') return new Date(b.updatedAt)-new Date(a.updatedAt);
            if (topicFilters.sort==='oldest') return new Date(a.updatedAt)-new Date(b.updatedAt);
            if (topicFilters.sort==='title') return String(a.title).localeCompare(String(b.title));
            return 0;
        });
    },[topics, topicFilters]);

    const totalTopicPages = Math.max(1, Math.ceil(filteredTopics.length / perPage));
    const pageTopicData = filteredTopics.slice((pageTopic-1)*perPage, (pageTopic-1)*perPage + perPage);
    useEffect(()=>setPageTopic(1),[topicFilters, perPage]);

    const filteredSup = useMemo(()=>{
        return supervisions.filter(s=>{
            if (supFilters.status!=='all' && s.status!==supFilters.status) return false;
            if (supFilters.program!=='all' && s.program!==supFilters.program) return false;
            if (supFilters.q.trim()){
                const t = slug(supFilters.q);
                const hay = `${s.title} ${s.student?.name} ${s.student?.email} ${s.keywords?.join(' ')}`.toLowerCase();
                if (!hay.includes(t)) return false;
            }
            return true;
        }).sort((a,b)=>{
            if (supFilters.sort==='newest') return new Date(b.assignedAt)-new Date(a.assignedAt);
            if (supFilters.sort==='oldest') return new Date(a.assignedAt)-new Date(b.assignedAt);
            if (supFilters.sort==='title') return String(a.title).localeCompare(String(b.title));
            return 0;
        });
    },[supervisions, supFilters]);

    const totalSupPages = Math.max(1, Math.ceil(filteredSup.length / perPage));
    const pageSupData = filteredSup.slice((pageSup-1)*perPage, (pageSup-1)*perPage + perPage);
    useEffect(()=>setPageSup(1),[supFilters, perPage]);

    const importTopicsInputRef = useRef(null);
    const triggerImport = ()=> importTopicsInputRef.current?.click();
    const importFromFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(String(reader.result||'[]'));
                if (!Array.isArray(data)) { 
                    setTimeout(() => {
                        guardedNotify('thesis-import-invalid', 'error', 'Invalid file', { title: 'Import failed' });
                    }, 100);
                    return; 
                }
                const normalized = data.map(x=>({
                    ...x,
                    id: x.id ?? maisId('topic', x.title||Math.random()),
                    faculty: x.faculty ?? teacher.faculty,
                    department: x.department ?? teacher.department,
                    program: x.program ?? teacher.program,
                    programLabel: x.programLabel ?? teacher.program,
                    supervisor: x.supervisor ?? { id: teacher.id, name: teacher.name, email: teacher.email, department: teacher.department },
                    createdAt: x.createdAt ?? nowIso(),
                    updatedAt: nowIso(),
                }));
                setTopics(prev=>[...normalized, ...prev]);
                setTimeout(() => {
                    guardedNotify('thesis-import-success', 'success', `Imported ${normalized.length} topics`, { title: 'Import successful' });
                }, 100);
            } catch { 
                setTimeout(() => {
                    guardedNotify('thesis-import-parse-error', 'error', 'Failed to parse file', { title: 'Import failed' });
                }, 100);
            }
        };
        reader.readAsText(file);
    };

    const exportAll = () => {
        const payload = { topics, requests, supervisions, exportedAt: nowIso() };
        const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `teacher_export_${Date.now()}.json`; a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 1000);
    };

    return (
        <div className="min-h-screen bg-background thesis-zfix overflow-x-hidden">
            <PageStyles />
            <Header userRole="teacher" userName={headerDisplayName} onLogout={()=>navigate('/')} />
            <RoleSidebar userRole="teacher" isCollapsed={isSidebarCollapsed} onToggleCollapse={()=>setIsSidebarCollapsed(s=>!s)} />

            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`} role="main" aria-label="Final thesis (Teacher)">
                <main className="flex-1">
                    <div className="p-6">
                        <Reveal variant="keycap" waitForLoaders={true} className="mb-4">
                            <NavigationBreadcrumb />
                        </Reveal>

                        <Reveal variant="keycap" waitForLoaders={true} as={motion.div} className="mb-4" delay={ANIMATION_DELAYS.HERO}>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-foreground truncate">Final Thesis</h1>
                            </div>
                            <p className="text-sm text-muted-foreground">Requests, topics, and supervisions you manage.</p>
                        </Reveal>

                        <Reveal variant="keycap" waitForLoaders={true} as={motion.div} className="mb-6" delay={ANIMATION_DELAYS.SUBTITLE}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                <Metric label="Open requests" value={metrics.openReq} delay={ANIMATION_DELAYS.SUMMARY_CARDS} />
                                <Metric label="Active topics" value={metrics.activeTopics} delay={ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP} />
                                <Metric label="Supervisions" value={metrics.activeSup} delay={ANIMATION_DELAYS.SUMMARY_CARDS + ANIMATION_DELAYS.STEP * 2} />
                            </div>
                        </Reveal>

                        <Reveal variant="keycap" waitForLoaders={true} as={motion.div} className="bg-card rounded-lg border border-border p-3 sm:p-4" delay={ANIMATION_DELAYS.FILTERS}>
                            <TabBar
                                value={tab}
                                onChange={setTab}
                                items={[
                                    { value: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
                                    { value: 'requests', label: 'Incoming requests', icon: 'Inbox' },
                                    { value: 'topics', label: 'My topics', icon: 'FolderKanban' },
                                    { value: 'supervision', label: 'Supervisions', icon: 'UserCheck' },
                                ]}
                                className="gap-2"
                            />
                        </Reveal>

                        <div className="mt-6 space-y-6">
                            {tab==='dashboard' && (
                                <Reveal variant="keycap" waitForLoaders={true} as={motion.section} className="grid grid-cols-1 xl:grid-cols-3 gap-6" delay={ANIMATION_DELAYS.MAIN_CONTENT}>
                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="bg-card glass-card rounded-lg border border-border p-4">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="text-lg font-semibold">General</h3>
                                                    <div className="btn-group">
                                                        <Button type="button" iconName="PlusCircle" onClick={()=>{ setTopicEdit({ type:'Bachelor thesis', program: user?.program || '', state:'open', capacity:1 }); setTopicOpen(true);} }>New topic</Button>
                                                        <Button type="button" variant="outline" iconName="Download" onClick={exportAll}>Export all</Button>
                                                        <Button type="button" variant="outline" iconName="Upload" onClick={triggerImport}>Import topics</Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <Input label="Quick search in requests" value={reqFilters.q} onChange={(e)=>{ setTab('requests'); setReqFilters({...reqFilters, q: e.target.value}); }} placeholder="Student, email, topic…" />
                                                    <Input label="Quick search in topics" value={topicFilters.q} onChange={(e)=>{ setTab('topics'); setTopicFilters({...topicFilters, q: e.target.value}); }} placeholder="Title, keywords…" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-card glass-card rounded-lg border border-border p-4">
                                            <h3 className="text-lg font-semibold mb-3">Recent requests</h3>
                                            {!requests.length ? (
                                                <div className="text-sm text-muted-foreground">No requests yet.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {requests.slice(0,5).map((r)=>(
                                                        <div key={String(r.id)} className="rounded-md border border-border p-3 flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-sm">{r.student?.name} • {r.program}</div>
                                                                <div className="text-xs text-muted-foreground">{r.academicYear} • {r.degree?.toUpperCase()} • {r.language} • Updated {fmt(r.updatedAt)}</div>
                                                                <div className="text-sm mt-1 truncate"><strong>Topic:</strong> {r.topic || <em className="text-muted-foreground">—</em>}</div>
                                                            </div>
                                                            <div className="shrink-0 text-right">
                                                                <Pill intent={
                                                                    r.status==='submitted'?'primary':
                                                                        r.status==='approved'?'green':
                                                                            r.status==='returned'?'amber':
                                                                                r.status==='rejected'?'red':'gray'
                                                                }>{String(r.status).toUpperCase()}</Pill>
                                                                <div className="mt-2">
                                                                    <Button type="button" size="xs" variant="outline" iconName="Eye" onClick={()=>openReview(r)}>Open</Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="bg-card glass-card rounded-lg border border-border p-4">
                                            <h3 className="text-lg font-semibold mb-3">My open topics</h3>
                                            {!topics.filter(t=>t.state==='open').length ? (
                                                <div className="text-sm text-muted-foreground">No open topics. Create one.</div>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {topics.filter(t=>t.state==='open').slice(0,6).map(t=>(
                                                        <li key={String(t.id)} className="rounded-md border border-border p-3">
                                                            <div className="text-sm font-medium truncate">{t.title}</div>
                                                            <div className="text-xs text-muted-foreground">{t.type} • {t.programLabel} • Created {fmt(t.createdAt)}</div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </Reveal>
                            )}

                            {tab==='requests' && (
                                <Reveal variant="keycap" waitForLoaders={true} as={motion.section} className="space-y-4" delay={ANIMATION_DELAYS.MAIN_CONTENT}>
                                    <div className="bg-card glass-card rounded-lg border border-border p-3 of-visible z-stack">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            <Input label="Search" value={reqFilters.q} onChange={(e)=>setReqFilters({...reqFilters, q: e.target.value})} placeholder="Student, email, topic…" />
                                            <Select
                                                label="State"
                                                value={reqFilters.state}
                                                options={[{value:'all',label:'All'},{value:'submitted',label:'Submitted'},{value:'returned',label:'Returned'},{value:'approved',label:'Approved'},{value:'rejected',label:'Rejected'},{value:'canceled',label:'Canceled'}]}
                                                onChange={(v)=>setReqFilters({...reqFilters, state: (typeof v==='string'?v:v?.value)})}
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <Select
                                                    label="Year"
                                                    value={reqFilters.year}
                                                    options={[{value:'all',label:'All'},{value:'2025/2026',label:'2025/2026'},{value:'2024/2025',label:'2024/2025'}]}
                                                    onChange={(v)=>setReqFilters({...reqFilters, year: (typeof v==='string'?v:v?.value)})}
                                                />
                                                <Select
                                                    label="Degree"
                                                    value={reqFilters.degree}
                                                    options={[{value:'all',label:'All'},{value:'bsc',label:'BSc'},{value:'msc',label:'MSc'}]}
                                                    onChange={(v)=>setReqFilters({...reqFilters, degree: (typeof v==='string'?v:v?.value)})}
                                                />
                                            </div>
                                            <Select
                                                label="Sort"
                                                value={reqFilters.sort}
                                                options={[{value:'newest',label:'Newest'},{value:'oldest',label:'Oldest'}]}
                                                onChange={(v)=>setReqFilters({...reqFilters, sort: (typeof v==='string'?v:v?.value)})}
                                            />
                                        </div>
                                    </div>

                                    {!pageReqData.length ? (
                                        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No requests match your filters.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {pageReqData.map((r, idx)=>(
                                                <Reveal variant="keycap" waitForLoaders={true} key={String(r.id)} delay={ANIMATION_DELAYS.FAST_STEP + idx * ANIMATION_DELAYS.FAST_STEP}>
                                                    <article className="bg-card glass-card rounded-lg border border-border p-4 hover-lift transition-all duration-200">\n                                                        <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-medium">{r.student?.name} <span className="text-xs text-muted-foreground">({r.student?.email})</span></div>
                                                            <div className="text-xs text-muted-foreground">{r.program} • {r.academicYear} • {r.degree?.toUpperCase()} • {r.language}</div>
                                                            <div className="text-sm mt-2 truncate"><strong>Topic:</strong> {r.topic || <em className="text-muted-foreground">—</em>}</div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <Pill intent={
                                                                r.status==='submitted'?'primary':
                                                                    r.status==='approved'?'green':
                                                                        r.status==='returned'?'amber':
                                                                            r.status==='rejected'?'red':'gray'
                                                            }>{String(r.status).toUpperCase()}</Pill>
                                                            <div className="text-xs text-muted-foreground">Updated {fmt(r.updatedAt)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 btn-group">
                                                        <Button type="button" size="sm" iconName="Eye" onClick={()=>openReview(r)}>Open</Button>
                                                        {r.status==='submitted' && (
                                                            <>
                                                                <Button type="button" size="sm" variant="outline" iconName="CheckCircle" onClick={()=>{ setReviewReq(r); setReviewOpen(true); }}>Approve</Button>
                                                                <Button type="button" size="sm" variant="outline" iconName="CornerUpLeft" onClick={()=>{ setReviewReq(r); setReviewOpen(true); }}>Return</Button>
                                                                <Button type="button" size="sm" variant="ghost" iconName="XCircle" onClick={()=>{ updateRequestStatus(r.id, 'rejected', 'Rejected by teacher'); guardedNotify('thesis-reject-quick', 'info', 'Rejected', { title: 'Request rejected' }); }}>Reject</Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </article>
                                                </Reveal>
                                            ))}
                                        </div>
                                    )}

                                    {totalReqPages > 1 && (
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card rounded-lg border border-border p-3 sm:p-4">
                                            <div className="order-2 lg:order-1 flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground">Page {pageReq} / {totalReqPages}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">Per page</span>
                                                    <Select
                                                        value={String(perPage)}
                                                        options={[{value:'6',label:'6'},{value:'8',label:'8'},{value:'12',label:'12'},{value:'16',label:'16'}]}
                                                        onChange={(v)=>setPerPage(parseInt(typeof v==='string'?v:v?.value,10)||8)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="order-1 lg:order-2 w-full lg:w-auto flex items-center justify-between lg:justify-end gap-2 min-w-0">
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronsLeft" onClick={()=>setPageReq(1)} disabled={pageReq===1} className="shrink-0">First</Button>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronLeft" onClick={()=>setPageReq(p=>Math.max(1,p-1))} disabled={pageReq===1} className="shrink-0">Prev</Button>
                                                <div className="hidden lg:flex items-center gap-1 max-w-[420px] overflow-x-auto thin-scrollbar">
                                                    {pageNums(pageReq, totalReqPages).map(n=>(
                                                        <Button key={String(n)} type="button" variant={pageReq===n?'default':'outline'} size="sm" onClick={()=>setPageReq(n)} className="w-9 shrink-0">{n}</Button>
                                                    ))}
                                                </div>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronRight" onClick={()=>setPageReq(p=>Math.min(totalReqPages,p+1))} disabled={pageReq===totalReqPages} className="shrink-0">Next</Button>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronsRight" onClick={()=>setPageReq(totalReqPages)} disabled={pageReq===totalReqPages} className="shrink-0">Last</Button>
                                            </div>
                                        </div>
                                    )}
                                </Reveal>
                            )}

                            {tab==='topics' && (
                                <Reveal variant="keycap" waitForLoaders={true} as={motion.section} className="space-y-4" delay={ANIMATION_DELAYS.MAIN_CONTENT}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold">My topics</h3>
                                        <div className="btn-group">
                                            <Button type="button" iconName="PlusCircle" onClick={()=>{ setTopicEdit({ type:'Master thesis', state:'open', capacity:1 }); setTopicOpen(true);} }>New topic</Button>
                                            {topics.length>0 && (
                                                <Button type="button" variant="outline" iconName="Download" onClick={()=>{
                                                    const blob = new Blob([JSON.stringify(topics,null,2)], {type:'application/json'});
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a'); a.href = url; a.download = `teacher_topics_${Date.now()}.json`; a.click();
                                                    setTimeout(()=>URL.revokeObjectURL(url), 1000);
                                                }}>Export</Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-card glass-card rounded-lg border border-border p-3 of-visible z-stack">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <Input label="Search" value={topicFilters.q} onChange={(e)=>setTopicFilters({...topicFilters, q: e.target.value})} placeholder="Title, keywords…" />
                                            <Select
                                                label="State"
                                                value={topicFilters.state}
                                                options={[{value:'all',label:'All'},{value:'open',label:'Open'},{value:'closed',label:'Closed'},{value:'archived',label:'Archived'}]}
                                                onChange={(v)=>setTopicFilters({...topicFilters, state: (typeof v==='string'?v:v?.value)})}
                                            />
                                            <Select
                                                label="Sort"
                                                value={topicFilters.sort}
                                                options={[{value:'newest',label:'Newest'},{value:'oldest',label:'Oldest'},{value:'title',label:'Title'}]}
                                                onChange={(v)=>setTopicFilters({...topicFilters, sort: (typeof v==='string'?v:v?.value)})}
                                            />
                                        </div>
                                    </div>

                                    {!pageTopicData.length ? (
                                        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No topics match your filters.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {pageTopicData.map((t, idx)=>(
                                                <Reveal variant="keycap" waitForLoaders={true} key={String(t.id)} delay={ANIMATION_DELAYS.FAST_STEP + idx * ANIMATION_DELAYS.FAST_STEP}>
                                                    <article className="bg-card glass-card rounded-lg border border-border p-4 hover-lift transition-all duration-200">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h4 className="text-lg font-semibold truncate">{t.title}</h4>
                                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                <Pill>{t.type}</Pill>
                                                                <span>{t.programLabel}</span>
                                                                <span>Created {fmt(t.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <Pill intent={t.state==='open'?'green':t.state==='closed'?'amber':'gray'}>{String(t.state).toUpperCase()}</Pill>
                                                            <div className="text-xs text-muted-foreground">Capacity: {t.capacity ?? 1}</div>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm mt-2">{t.description}</p>
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {(t.keywords||[]).map((k,i)=><Pill key={String(i)} intent="gray">{k}</Pill>)}
                                                    </div>
                                                    <div className="mt-3 btn-group">
                                                        <Button type="button" size="sm" iconName="Edit3" onClick={()=>{ setTopicEdit({...t, keywords:(t.keywords||[]).join(', ')}); setTopicOpen(true);} }>Edit</Button>
                                                        <Button type="button" size="sm" variant="outline" iconName="ToggleLeft" onClick={()=>setTopics(prev=>prev.map(x=>String(x.id)===String(t.id)?{...x, state: x.state==='open'?'closed':'open', updatedAt: nowIso()}:x))}>
                                                            {t.state==='open'?'Close':'Re-open'}
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" iconName="Archive" onClick={()=>setTopics(prev=>prev.map(x=>String(x.id)===String(t.id)?{...x, state:'archived', updatedAt: nowIso()}:x))}>Archive</Button>
                                                        <Button type="button" size="sm" variant="ghost" iconName="Trash2" onClick={()=>{ if (window.confirm('Delete this topic?')) deleteTopic(t.id); }}>Delete</Button>
                                                    </div>
                                                </article>
                                                </Reveal>
                                            ))}
                                        </div>
                                    )}

                                    {totalTopicPages>1 && (
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card rounded-lg border border-border p-3 sm:p-4">
                                            <div className="order-2 lg:order-1 flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground">Page {pageTopic} / {totalTopicPages}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">Per page</span>
                                                    <Select
                                                        value={String(perPage)}
                                                        options={[{value:'6',label:'6'},{value:'8',label:'8'},{value:'12',label:'12'},{value:'16',label:'16'}]}
                                                        onChange={(v)=>setPerPage(parseInt(typeof v==='string'?v:v?.value,10)||8)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="order-1 lg:order-2 w-full lg:w-auto flex items-center justify-between lg:justify-end gap-2 min-w-0">
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronsLeft" onClick={()=>setPageTopic(1)} disabled={pageTopic===1} className="shrink-0">First</Button>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronLeft" onClick={()=>setPageTopic(p=>Math.max(1,p-1))} disabled={pageTopic===1} className="shrink-0">Prev</Button>
                                                <div className="hidden lg:flex items-center gap-1 max-w-[420px] overflow-x-auto thin-scrollbar">
                                                    {pageNums(pageTopic, totalTopicPages).map(n=>(
                                                        <Button key={String(n)} type="button" variant={pageTopic===n?'default':'outline'} size="sm" onClick={()=>setPageTopic(n)} className="w-9 shrink-0">{n}</Button>
                                                    ))}
                                                </div>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronRight" onClick={()=>setPageTopic(p=>Math.min(totalTopicPages,p+1))} disabled={pageTopic===totalTopicPages} className="shrink-0">Next</Button>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronsRight" onClick={()=>setPageTopic(totalTopicPages)} disabled={pageTopic===totalTopicPages} className="shrink-0">Last</Button>
                                            </div>
                                        </div>
                                    )}
                                </Reveal>
                            )}

                            {tab==='supervision' && (
                                <Reveal variant="keycap" waitForLoaders={true} as={motion.section} className="space-y-4" delay={ANIMATION_DELAYS.MAIN_CONTENT}>
                                    <div className="bg-card glass-card rounded-lg border border-border p-3 of-visible z-stack">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                            <Input label="Search" value={supFilters.q} onChange={(e)=>setSupFilters({...supFilters, q: e.target.value})} placeholder="Title, student…" />
                                            <Select
                                                label="Status"
                                                value={supFilters.status}
                                                options={[{value:'all',label:'All'},{value:'assigned',label:'Assigned'},{value:'submitted',label:'Submitted'},{value:'defense',label:'Defense'},{value:'graded',label:'Graded'}]}
                                                onChange={(v)=>setSupFilters({...supFilters, status: (typeof v==='string'?v:v?.value)})}
                                            />
                                            <Select
                                                label="Program"
                                                value={supFilters.program}
                                                options={[{value:'all',label:'All'}, ...programs.map(p=>({value:p.label,label:p.label}))]}
                                                onChange={(v)=>setSupFilters({...supFilters, program: (typeof v==='string'?v:v?.value)})}
                                            />
                                            <Select
                                                label="Sort"
                                                value={supFilters.sort}
                                                options={[{value:'newest',label:'Newest'},{value:'oldest',label:'Oldest'},{value:'title',label:'Title'}]}
                                                onChange={(v)=>setSupFilters({...supFilters, sort: (typeof v==='string'?v:v?.value)})}
                                            />
                                        </div>
                                    </div>

                                    {!pageSupData.length ? (
                                        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No supervisions yet.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {pageSupData.map((t, idx)=>(
                                                <Reveal variant="keycap" waitForLoaders={true} key={String(t.id)} delay={ANIMATION_DELAYS.FAST_STEP + idx * ANIMATION_DELAYS.FAST_STEP}>
                                                    <article className="bg-card glass-card rounded-lg border border-border p-4 hover-lift transition-all duration-200">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-lg font-semibold">{t.title}</div>
                                                            <div className="text-xs text-muted-foreground">{t.program} • {t.academicYear} • {t.degree} • Assigned {fmt(t.assignedAt)}</div>
                                                            <div className="text-sm mt-1"><strong>Student:</strong> {t.student?.name} <span className="text-xs text-muted-foreground">({t.student?.email})</span></div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <Pill intent={
                                                                t.status==='graded'?'green':
                                                                    t.status==='defense'?'amber':
                                                                        t.status==='submitted'?'primary':'gray'
                                                            }>{String(t.status||'assigned').toUpperCase()}</Pill>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="rounded-lg border border-border p-3">
                                                            <div className="text-xs text-muted-foreground mb-1">Originality</div>
                                                            {t.originality?.checkedAt ? (
                                                                <div className="text-sm">Similarity: {t.originality.percentage}% • Checked: {fmt(t.originality.checkedAt)}<br/>
                                                                    {t.originality.protocolUrl ? <a className="text-xs text-primary underline" href={t.originality.protocolUrl} target="_blank" rel="noreferrer">Protocol</a> : <span className="text-xs text-muted-foreground">No protocol link</span>}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground">Not checked yet.</div>
                                                            )}
                                                        </div>
                                                        <div className="rounded-lg border border-border p-3">
                                                            <div className="text-xs text-muted-foreground mb-1">Defense</div>
                                                            {t.defense?.date ? (
                                                                <div className="text-sm">Date: {t.defense.date.includes('T')? fmtDT(t.defense.date): t.defense.date} • Room: {t.defense.room}</div>
                                                            ) : (
                                                                <div className="text-sm text-muted-foreground">Not scheduled.</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 overflow-x-auto">
                                                        <table className="w-full text-sm min-w-[560px]">
                                                            <thead>
                                                            <tr className="[&>th]:text-left [&>th]:py-2 [&>th]:px-2 text-muted-foreground border-b border-border">
                                                                <th>#</th><th>Item</th><th>Semester</th><th>Assessed by</th><th>Grade</th><th>Date</th>
                                                            </tr>
                                                            </thead>
                                                            <tbody>
                                                            {(t.grades||[]).map((g,i)=>(
                                                                <tr key={String(i)} className="[&>td]:py-2 [&>td]:px-2 border-b border-border/60">
                                                                    <td>{i+1}</td><td>{g.item}</td><td>{g.term}</td><td>{g.by}</td><td className="font-medium">{g.grade}</td><td>{g.date}</td>
                                                                </tr>
                                                            ))}
                                                            {(!t.grades || !t.grades.length) ? (
                                                                <tr><td colSpan={6} className="py-2 text-xs text-muted-foreground">No grades yet.</td></tr>
                                                            ) : null}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="text-sm font-medium mb-1">Attachments</div>
                                                        {(!t.attachments || !t.attachments.length) ? (
                                                            <div className="text-sm text-muted-foreground">No files yet.</div>
                                                        ) : (
                                                            <ul className="space-y-2">
                                                                {t.attachments.map((f,i)=>(
                                                                    <li key={String(f?.id ?? i)} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                                                                        <div className="min-w-0 flex items-center gap-2">
                                                                            <Icon name="FileText" size={16} className="text-primary" />
                                                                            <span className="truncate">{f.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="text-xs text-muted-foreground">{Math.round((f.size||0)/1024)} KB</div>
                                                                            <Button type="button" size="xs" variant="ghost" iconName="Trash2" onClick={()=>removeAttachment(t.id, f.id)}>Remove</Button>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 btn-group">
                                                        <Button type="button" size="sm" iconName="Upload" variant="outline" onClick={()=>openUpload(t)}>Upload file</Button>
                                                        <Button type="button" size="sm" iconName="Calendar" variant="outline" onClick={()=>{ setDefenseThesis(t); setDefenseOpen(true); }}>Schedule defense</Button>
                                                        <Button type="button" size="sm" iconName="FileCheck" variant="outline" onClick={()=>{ setOrigThesis(t); setOrigOpen(true); }}>Originality</Button>
                                                        <Button type="button" size="sm" iconName="Edit3" variant="outline" onClick={()=>{ setGradeThesis(t); setGradeOpen(true); }}>Enter grades</Button>
                                                        <Button type="button" size="sm" iconName="Send" onClick={()=>setThesisStatus(t.id, 'submitted')}>Mark submitted</Button>
                                                        <Button type="button" size="sm" iconName="Award" onClick={()=>setThesisStatus(t.id, 'defense')}>Move to defense</Button>
                                                        <Button type="button" size="sm" iconName="CheckCircle" onClick={()=>setThesisStatus(t.id, 'graded')}>Mark graded</Button>
                                                    </div>
                                                </article>
                                                </Reveal>
                                            ))}
                                        </div>
                                    )}

                                    {totalSupPages>1 && (
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card rounded-lg border border-border p-3 sm:p-4">
                                            <div className="order-2 lg:order-1 flex items-center gap-3">
                                                <span className="text-sm text-muted-foreground">Page {pageSup} / {totalSupPages}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">Per page</span>
                                                    <Select
                                                        value={String(perPage)}
                                                        options={[{value:'6',label:'6'},{value:'8',label:'8'},{value:'12',label:'12'},{value:'16',label:'16'}]}
                                                        onChange={(v)=>setPerPage(parseInt(typeof v==='string'?v:v?.value,10)||8)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="order-1 lg:order-2 w-full lg:w-auto flex items-center justify-between lg:justify-end gap-2 min-w-0">
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronsLeft" onClick={()=>setPageSup(1)} disabled={pageSup===1} className="shrink-0">First</Button>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronLeft" onClick={()=>setPageSup(p=>Math.max(1,p-1))} disabled={pageSup===1} className="shrink-0">Prev</Button>
                                                <div className="hidden lg:flex items-center gap-1 max-w-[420px] overflow-x-auto thin-scrollbar">
                                                    {pageNums(pageSup, totalSupPages).map(n=>(
                                                        <Button key={String(n)} type="button" variant={pageSup===n?'default':'outline'} size="sm" onClick={()=>setPageSup(n)} className="w-9 shrink-0">{n}</Button>
                                                    ))}
                                                </div>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronRight" onClick={()=>setPageSup(p=>Math.min(totalSupPages,p+1))} disabled={pageSup===totalSupPages} className="shrink-0">Next</Button>
                                                <Button type="button" variant="outline" size="sm" iconName="ChevronsRight" onClick={()=>setPageSup(totalSupPages)} disabled={pageSup===totalSupPages} className="shrink-0">Last</Button>
                                            </div>
                                        </div>
                                    )}
                                </Reveal>
                            )}
                        </div>
                    </div>
                </main>

                <PageFooter
                    left={[
                        'MAIS 2.0 • Teacher Portal',
                        lastLoginLabel,
                    ]}
                    right={
                        <div className="toolbar">
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

            <ReviewRequestModal
                open={reviewOpen}
                request={reviewReq}
                topics={topics}
                onClose={()=>{ setReviewOpen(false); setReviewReq(null); }}
                onApprove={approveRequest}
                onReturn={returnRequest}
                onReject={rejectRequest}
            />

            <TopicModal
                open={topicOpen}
                value={topicEdit}
                onClose={()=>{ setTopicOpen(false); setTopicEdit(null); }}
                onSave={saveTopic}
            />

            <DefenseModal
                open={defenseOpen}
                thesis={defenseThesis}
                onClose={()=>{ setDefenseOpen(false); setDefenseThesis(null); }}
                onSave={saveDefense}
            />

            <OriginalityModal
                open={origOpen}
                thesis={origThesis}
                onClose={()=>{ setOrigOpen(false); setOrigThesis(null); }}
                onSave={saveOriginality}
            />

            <GradeModal
                open={gradeOpen}
                thesis={gradeThesis}
                onClose={()=>{ setGradeOpen(false); setGradeThesis(null); }}
                onSave={appendGrades}
            />

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip,image/png,image/jpeg"
                onChange={(e)=>addAttachments(e?.target?.files)}
            />

            <input
                ref={importTopicsInputRef}
                type="file"
                className="hidden"
                accept="application/json,.json"
                onChange={(e)=>importFromFile(e.target.files?.[0])}
            />

            <ToastViewport position="top-right" />
        </div>
    );
};

const FinalThesisTeacher = () => {
    return (
        <ToastsProvider>
            <FinalThesisTeacherInner />
        </ToastsProvider>
    );
};

export default FinalThesisTeacher;