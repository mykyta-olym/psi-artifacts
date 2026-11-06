// src/pages/chat/ChatPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import ThreadList from './components/ThreadList';
import ChatWindow from './components/ChatWindow';
import RightSidebar from './components/RightSidebar';
import useChatStore from '../../hooks/useChatStore';
import { resourceCache } from '../../data/resourceCache';
import { displayNameFrom } from '../../utils/displayName';
import { hasGemini } from './utils/chatUtils';
import { useAuth } from '../../contexts/AuthContext';
import { formatLastLogin } from '../../utils/datetime';
import DataLoader from '../../components/ui/DataLoader';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';
import useDataUpdates from '../../hooks/useDataUpdates';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

const TEACHER_ROLE_ALIASES = new Set(['teacher', 'faculty', 'professor']);
const STUDENT_ROLE_ALIASES = new Set(['student', 'pupil', 'learner']);

const canonicalRole = (role = '') => {
    const normalized = String(role || '').toLowerCase().trim();
    if (TEACHER_ROLE_ALIASES.has(normalized)) return 'teacher';
    if (STUDENT_ROLE_ALIASES.has(normalized)) return 'student';
    return normalized || 'student';
};

const participantKey = (role = '', email = '') => {
    const canonical = canonicalRole(role);
    if (canonical === 'ai') return 'ai:gemini';
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const prefix = canonical === 'teacher' ? 'fac' : canonical === 'student' ? 'stu' : 'usr';
    return normalizedEmail ? `${prefix}:${normalizedEmail}` : `${prefix}:unknown`;
};

const idToNiceName = (id = '') => {
    const raw = String(id || '');
    const after = raw.includes(':') ? raw.split(':')[1] : raw;
    const beforeAt = after.includes('@') ? after.split('@')[0] : after;
    const cleaned = beforeAt.replace(/[._-]+/g, ' ').trim();
    const titled = cleaned.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return titled || 'User';
};

const norm = (s='') => String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

const ChatPageInner = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();

    const { user, userProfile } = useAuth();
    const normalizeEmail = useCallback((value) => String(value || '').trim().toLowerCase(), []);

    const primaryEmail = user?.email || userProfile?.email || '';
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);

    const userEmail = normalizeEmail(user?.email);
    const userProfileEmail = normalizeEmail(userProfile?.email);
    const authEmail = userEmail || userProfileEmail || '';

    const headerDisplayName = useMemo(() => {
        const sources = [
            user?.full_name,
            userProfile?.full_name,
            userProfile?.name,
            user?.name,
            authEmail ? idToNiceName(authEmail) : null,
        ].filter(Boolean);
        return sources[0] || 'User';
    }, [authEmail, user?.full_name, user?.name, userProfile?.full_name, userProfile?.name]);
    const roleFromAuth = String(user?.role || userProfile?.role || '').toLowerCase();
    const selfRole = canonicalRole(roleFromAuth);
    const isFaculty = selfRole === 'teacher';
    const userRole = isFaculty ? 'teacher' : 'student';
    const { value: selectedStudy, loading: selectedStudyLoading } = useSelectedStudyValue();
    const isChatRestricted = !!selectedStudy && selectedStudy.ongoing === false;

    const {
        loading,
        threads,
        messagesByThread,
        currentUser,
        setCurrentUserName,
        ensureThreadLoaded,
        createThread,
        addMessage,
        updateMessage,
        deleteMessage,
        toggleReaction,
        clearThread,
        deleteThread,
        pinThread,
        markRead,
        updateThread
    } = useChatStore();

    useEffect(() => { setCurrentUserName(headerDisplayName); }, [headerDisplayName, setCurrentUserName]);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const selectedId = searchParams.get('thread') || '';
    const compose = searchParams.get('compose') === '1';
    const preTo = searchParams.get('to') || '';
    const preTitle = searchParams.get('title') || '';
    const preMsg = searchParams.get('message') || '';

    const [q, setQ] = useState('');
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [onlyPinned, setOnlyPinned] = useState(false);
    const [draft, setDraft] = useState('');
    const [showToolsDrawer, setShowToolsDrawer] = useState(false);
    const [mobileView, setMobileView] = useState('list');
    useEffect(() => { if (selectedId) setMobileView('chat'); }, [selectedId]);

    const selfId = authEmail ? participantKey(selfRole, authEmail) : 'me';
    const selfName = headerDisplayName;

    const [studentDirectory, setStudentDirectory] = useState([]);
    const [facultyDirectory, setFacultyDirectory] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const students = await resourceCache.getStudents({ page: 1, pageSize: 500, sort: 'fullName', order: 'asc' });
                if (!cancelled) setStudentDirectory(Array.isArray(students) ? students : []);
            } catch {
                if (!cancelled) setStudentDirectory([]);
            }
            try {
                const facultyList = await resourceCache.getFaculty();
                if (!cancelled) setFacultyDirectory(Array.isArray(facultyList) ? facultyList : []);
            } catch {
                if (!cancelled) setFacultyDirectory([]);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const sMap = useMemo(() => new Map((studentDirectory || []).map(s => [s.id || (s.email ? `stu:${s.email}` : ''), s])), [studentDirectory]);
    const fMap = useMemo(() => new Map((facultyDirectory || []).map(f => [f.id || (f.email ? `fac:${f.email}` : ''), f])), [facultyDirectory]);

    const emailFromId = (id='') => {
        const raw = String(id || '');
        const after = raw.includes(':') ? raw.split(':')[1] : raw;
        return after.toLowerCase();
    };

    const emailForParticipant = (p) => {
        if (!p) return '';
        const id = String(p.id || '');
        if (id.includes('@')) return emailFromId(id);
        const src = fMap.get(id) || sMap.get(id);
        return String(src?.email || '').toLowerCase();
    };

    const canonicalKey = (p) => emailForParticipant(p) || String(p?.id || '').toLowerCase();

    const resolveName = (p) => {
        if (!p) return '';
        if (canonicalKey(p) === authEmail || p.id === selfId || p.id === 'me') return selfName;
        const src = (p?.role === 'faculty' ? fMap.get(p.id) : sMap.get(p.id)) || fMap.get(p.id) || sMap.get(p.id);
        if (src) return displayNameFrom(src, { privacy: false });
        if (p?.name && String(p.name).trim()) return p.name;
        return idToNiceName(p.id);
    };

    const dedupeParticipants = useCallback((arr = []) => {
        const primary = new Map();
        for (const p of (arr || [])) {
            if (!p) continue;
            const key = canonicalKey(p);
            const candidate = { ...p, name: resolveName(p) };
            const existing = primary.get(key);
            if (!existing) {
                primary.set(key, candidate);
            } else {
                const preferSelf = key === authEmail && (p.id === selfId || !String(existing.id || '').startsWith('usr:'));
                const preferFaculty = (existing.role !== 'faculty' && p.role === 'faculty');
                primary.set(key, (preferSelf || preferFaculty) ? candidate : existing);
            }
        }
        return Array.from(primary.values());
    }, [authEmail, selfId, resolveName]);

    useEffect(() => {
        if (!compose || selectedId) return;
        (async () => {
            const toNames = preTo.split(',').map(s => s.trim()).filter(Boolean).map(n => ({ id: `u-${n.toLowerCase().replace(/\s+/g, '-')}`, name: n }));
            const t = await createThread({ title: preTitle || 'New chat', participants: toNames });
            const p = new URLSearchParams(searchParams);
            p.set('thread', t.id);
            p.delete('compose');
            setSearchParams(p, { replace: true });
            if (preMsg) setDraft(preMsg);
        })();
    }, [compose, selectedId, preTo, preTitle, preMsg, createThread, searchParams, setSearchParams]);

    const selectThread = (id) => {
        const p = new URLSearchParams(searchParams);
        if (id) p.set('thread', id); else p.delete('thread');
        setSearchParams(p, { replace: true });
        if (id) {
            const msgs = messagesByThread.get(id) || [];
            const latest = msgs[msgs.length - 1]?.ts || Date.now();
            markRead(id, latest);
            setMobileView('chat');
        } else {
            setMobileView('list');
        }
    };

    useEffect(() => {
        if (!selectedId) return;
        ensureThreadLoaded(selectedId).catch(() => {});
    }, [ensureThreadLoaded, selectedId]);

    // Listen for real-time chat updates via SignalR
    const handleDataUpdate = useCallback((payload) => {
        if (!payload?.type) return;
        
        // Reload threads and messages when chat data changes
        if (payload.type === 'chat.message' || payload.type === 'chat.thread' || payload.type === 'chat.updated') {
            console.log('[Chat] Received update:', payload);
            // The useChatStore hook handles reloading from the backend automatically
            // We just need to trigger a refresh if the current thread is affected
            if (selectedId && payload.threadId === selectedId) {
                ensureThreadLoaded(selectedId).catch(() => {});
            }
        }
    }, [selectedId, ensureThreadLoaded]);

    useDataUpdates(handleDataUpdate);

    const activeThread = useMemo(() => threads.find(t => t.id === selectedId) || null, [threads, selectedId]);
    const activeMessagesRaw = useMemo(() => (selectedId ? (messagesByThread.get(selectedId) || []) : []), [messagesByThread, selectedId]);

    const selfCandidates = useMemo(() => {
        const ids = [selfId];
        if (authEmail) ids.push(`fac:${authEmail}`, `stu:${authEmail}`);
        return ids;
    }, [selfId, authEmail]);

    const isMember = useCallback((t) => {
        if (!t) return false;
        const parts = t.participants || [];
        const byId = parts.some(p => p && selfCandidates.includes(String(p.id || '')));
        if (byId) return true;
        const msgs = messagesByThread.get(t.id) || [];
        const anyMine = msgs.some(m => {
            const aid = String(m?.authorId || '');
            if (aid && selfCandidates.includes(aid)) return true;
            return norm(m?.authorName) === norm(selfName);
        });
        if (anyMine) return true;
        const nameMatch = parts.some(p => norm(resolveName(p)) === norm(selfName));
        return !!nameMatch;
    }, [messagesByThread, resolveName, selfCandidates, selfName]);

    const applyThreadPatch = useCallback((patch) => {
        if (!activeThread) return;
        const isOwner = activeThread.ownerId === selfId;
        const canManage = isOwner || isFaculty;
        const next = { ...patch };
        if (!canManage && Object.prototype.hasOwnProperty.call(next, 'title')) {
            delete next.title;
        }
        if (Array.isArray(patch?.participants)) {
            const base = dedupeParticipants(patch.participants);
            next.participants = canManage ? base : base.filter(p => p.role !== 'ai');
        }
        if (!canManage) {
            delete next.aiEnabled;
            delete next.ownerEmail;
            delete next.ownerId;
        }
        updateThread(activeThread.id, next);
    }, [activeThread, updateThread, dedupeParticipants, selfId, isFaculty]);

    useEffect(() => {
        if (!activeThread) return;
        const parts = activeThread.participants || [];
        const hasSelf = parts.some(p => p && selfCandidates.includes(String(p.id || '')));
        if (!hasSelf) {
            const mePart = { id: selfId, role: isFaculty ? 'faculty' : 'student', name: selfName };
            applyThreadPatch({ participants: dedupeParticipants([...parts, mePart]) });
        } else {
            const cleaned = dedupeParticipants(parts);
            const patch = {};
            if (cleaned.length !== parts.length) patch.participants = cleaned;
            if (!activeThread.ownerId) {
                const preferred = cleaned.find(p => selfCandidates.includes(String(p.id))) || cleaned.find(p => p.role !== 'ai') || cleaned[0] || { id: selfId };
                patch.ownerId = preferred?.id || selfId;
            }
            if (Object.keys(patch).length) applyThreadPatch(patch);
        }
    }, [activeThread, selfCandidates, selfId, isFaculty, selfName, applyThreadPatch, dedupeParticipants]);

    const filteredThreads = useMemo(() => {
        const nq = q.trim().toLowerCase();
        let list = threads.filter(isMember).map(t => {
            const names = dedupeParticipants(t.participants || []).map(resolveName).filter(Boolean);
            const computedTitle = t.title?.trim() || (names.length ? names.join(', ') : '');
            const lastText = t.lastMessageText || '';
            const hay = [computedTitle, ...names, lastText].join(' ').toLowerCase();
            const pinned = !!(t._pin || false);
            const unread = t._unread || 0;
            const lastMessageAt = t.lastMessageAt || 0;
            return { ...t, _computedTitle: computedTitle, _hay: hay, pinned, unread, lastMessageAt, participants: dedupeParticipants(t.participants || []) };
        });
        if (onlyUnread) list = list.filter(t => (t.unread || 0) > 0);
        if (onlyPinned) list = list.filter(t => !!t.pinned);
        if (nq) list = list.filter(t => t._hay.includes(nq));
        list.sort((a, b) => {
            if (!!b.pinned - !!a.pinned !== 0) return +b.pinned - +a.pinned;
            return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
        });
        return list;
    }, [threads, q, onlyPinned, onlyUnread, resolveName, isMember, dedupeParticipants]);

    const isMineMessage = useCallback((m) => {
        const aid = String(m?.authorId || '');
        if (aid && ([selfId, `usr:${authEmail}`, `fac:${authEmail}`, `stu:${authEmail}`].includes(aid))) return true;
        if (norm(m?.authorName) === norm(selfName)) return true;
        return false;
    }, [selfId, authEmail, selfName]);

    const activeMessages = useMemo(() => {
        return activeMessagesRaw.map(m => {
            const ai = m.from === 'ai' || m.authorRole === 'ai';
            const mine = isMineMessage(m);
            const from = ai ? 'ai' : (mine ? 'self' : 'other');
            return { ...m, from, typing: false };
        });
    }, [activeMessagesRaw, isMineMessage]);

    const startNewChat = async () => {
        const t = await createThread({ title: 'New chat', participants: [] });
        selectThread(t.id);
    };

    const startNewAiChat = async () => {
        const t = await createThread({ title: 'Gemini', participants: [], inviteAi: true });
        selectThread(t.id);
    };

    const onSendFromWindow = async (payload) => {
        if (!activeThread) return;
        // Check if message targets AI: explicit flags or recipients containing ai:gemini
        const recipientsHaveAi = Array.isArray(payload?.recipients) && 
            payload.recipients.some(r => r?.id === 'ai:gemini' || r?.role === 'ai');
        const wantsAI = hasGemini(activeThread) && !!(
            payload?.ai || payload?.toAI || payload?.toAi || 
            payload?.target === 'ai' || payload?.privateAI || recipientsHaveAi
        );
        await addMessage(activeThread.id, {
            text: String(payload?.text || '').trim(),
            attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
            announcement: !!payload?.announcement,
            replyToId: payload?.replyToId ?? null,
            targetAi: wantsAI
        });
    };

    const onAutoReply = async () => {
        // Backend AI responder handles follow-up messages when enabled.
    };

    const onInsertToComposer = (text) => setDraft((d) => (d ? `${d}\n\n${text}` : text));
    const onSendFromRight = (text, asAnnouncement = false) => {
        if (!activeThread || !text?.trim()) return;
        addMessage(activeThread.id, {
            text: text.trim(),
            attachments: [],
            announcement: asAnnouncement
        });
    };

    const onAckRead = useCallback((ts) => {
        if (!activeThread) return;
        markRead(activeThread.id, ts);
    }, [activeThread?.id, markRead]);

    const handleLogout = () => navigate('/');

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    const canManageActive = !!activeThread && (activeThread.ownerId === selfId || isFaculty);

    const handleDeleteThread = (id) => {
        const t = threads.find((x) => x.id === id);
        if (!t) return;
        const allowed = t.ownerId === selfId || isFaculty;
        if (!allowed) return;
        deleteThread(id);
        if (selectedId === id) selectThread('');
    };

    const handleClearThread = (id) => {
        const t = threads.find((x) => x.id === id);
        if (!t) return;
        const allowed = t.ownerId === selfId || isFaculty;
        if (!allowed) return;
        clearThread(id);
    };

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {(loading || (selectedStudyLoading && !selectedStudy)) && (
                <DataLoader
                    label={selectedStudyLoading && !selectedStudy ? "Loading study context…" : "Loading chat…"}
                    description={selectedStudyLoading && !selectedStudy
                        ? "Synchronizing study preference before opening chat."
                        : "Synchronizing threads, messages, and participants."}
                    details={[
                        'Fetching thread roster and participant roles',
                        'Refreshing message history and attachments',
                        'Joining realtime channels for live updates',
                    ]}
                    fullScreen
                />
            )}
            <Header userRole={userRole} userName={headerDisplayName} onLogout={handleLogout} />
            <RoleSidebar userRole={userRole} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 md:mt-20 min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-5rem)] flex flex-col`} role="main" aria-label="Chat">
                <main className="flex-1">
                    <div className="px-3 sm:px-4 md:px-6 pt-3 pb-6">
                        <NavigationBreadcrumb />
                        {isChatRestricted ? (
                            <div className="max-w-3xl mx-auto mt-6 bg-card rounded-xl border border-border px-5 py-8 text-center shadow-card">
                                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-500/10 text-amber-600">
                                    <Icon name="ShieldOff" size={20} />
                                </div>
                                <h1 className="text-xl font-semibold text-foreground mb-2">Chat is disabled for archived studies</h1>
                                <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                                    Switch to an active study programme if you need to access conversations. Archived records stay available in read-only mode from your dashboards.
                                </p>
                                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                                    <Button iconName="GraduationCap" onClick={() => navigate('/study-select?return=/chat&reset=1')}>
                                        Change study
                                    </Button>
                                    <Button variant="outline" iconName="LayoutDashboard" onClick={() => navigate('/student-dashboard')}>
                                        Go to dashboard
                                    </Button>
                                </div>
                            </div>
                        ) : (
                        <>
                        <Reveal delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true}>
                            <div className="bg-card rounded-lg border border-border overflow-hidden relative">
                                <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                                    <h1 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2 min-w-0">
                                        <Icon name="MessageSquare" size={18} />
                                        <span className="truncate">Chat</span>
                                    </h1>
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                        <Button variant="outline" size="sm" iconName="Wrench" className="xl:hidden" onClick={() => setShowToolsDrawer(true)} title="Tools">Tools</Button>
                                        <Button iconName="Sparkles" size="sm" variant="outline" onClick={startNewAiChat}>New AI chat</Button>
                                        <Button iconName="Plus" size="sm" onClick={startNewChat}>New chat</Button>
                                    </div>
                                </div>

                            <Reveal delay={ANIMATION_DELAYS.SUBTITLE} variant="keycap" waitForLoaders={true}>
                                <div className="lg:hidden">
                                    <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Button variant={mobileView === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView('list')}>Chats</Button>
                                            <Button variant={mobileView === 'chat' ? 'default' : 'outline'} size="sm" onClick={() => setMobileView('chat')} disabled={!activeThread}>Conversation</Button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant={onlyUnread ? 'default' : 'outline'} size="icon" title="Only unread" onClick={() => setOnlyUnread(v => !v)}>
                                                <Icon name="Bell" size={16} />
                                            </Button>
                                            <Button variant={onlyPinned ? 'default' : 'outline'} size="icon" title="Only pinned" onClick={() => setOnlyPinned(v => !v)}>
                                                <Icon name="Pin" size={16} />
                                            </Button>
                                        </div>
                                    </div>

                                    {mobileView === 'list' && (
                                        <div className="overflow-y-auto thin-scrollbar bg-card" style={{ height: 'calc(100dvh - 11.5rem)' }}>
                                            <Reveal delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="pop" waitForLoaders={true}>
                                                <div className="p-3 sm:p-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
                                                    <Input placeholder="Search chats…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full" />
                                                </div>
                                            </Reveal>
                                            <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="pop" waitForLoaders={true}>
                                                <ThreadList
                                                    items={filteredThreads}
                                                    selectedId={selectedId}
                                                    onSelect={selectThread}
                                                    onPin={(id) => pinThread(id, true)}
                                                    onUnpin={(id) => pinThread(id, false)}
                                                    onDelete={handleDeleteThread}
                                                    onClear={handleClearThread}
                                                />
                                            </Reveal>
                                        </div>
                                    )}

                                    {mobileView === 'chat' && (
                                        <Reveal delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="slideScale" waitForLoaders={true} as={motion.div} className="overflow-hidden" style={{ height: 'calc(100dvh - 11.5rem)' }}>
                                            {activeThread ? (
                                                <ChatWindow
                                                    key={activeThread.id}
                                                    currentUser={currentUser}
                                                    currentUserRole={userRole}
                                                    thread={{
                                                        ...activeThread,
                                                        participants: dedupeParticipants(activeThread.participants || [])
                                                    }}
                                                    messages={activeMessages}
                                                    onSend={onSendFromWindow}
                                                    onAutoReply={onAutoReply}
                                                    onClearThread={() => { if (canManageActive) clearThread(activeThread.id); }}
                                                    onDeleteThread={() => { if (canManageActive) { deleteThread(activeThread.id); selectThread(''); } }}
                                                    onPinToggle={() => pinThread(activeThread.id, !activeThread.pinned)}
                                                    onToggleReaction={(mid, emoji) => toggleReaction(activeThread.id, mid, emoji)}
                                                    onEditMessage={(mid, text) => updateMessage(activeThread.id, mid, () => ({ text }))}
                                                    onDeleteMessage={(mid) => deleteMessage(activeThread.id, mid)}
                                                    onAckRead={onAckRead}
                                                    draft={draft}
                                                    setDraft={setDraft}
                                                    onBackMobile={() => setMobileView('list')}
                                                    onOpenInfoMobile={() => setShowToolsDrawer(true)}
                                                    showTyping={false}
                                                    showUnreadDivider={false}
                                                    showNewMessagesBadge={false}
                                                />
                                            ) : (
                                                <div className="h-full grid place-items-center text-muted-foreground p-6">
                                                    <div className="text-center">
                                                        <div className="text-3xl mb-2">💬</div>
                                                        <div className="font-medium">Select a chat or create a new one</div>
                                                        <div className="text-sm mt-1">You can search or filter chats on the left.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </Reveal>
                                    )}
                                </div>
                            </Reveal>

                            <Reveal delay={ANIMATION_DELAYS.SUBTITLE} variant="keycap" waitForLoaders={true}>
                                <div className="hidden lg:grid lg:grid-cols-[minmax(260px,320px),1fr] xl:grid-cols-[minmax(300px,360px),1fr,minmax(320px,420px)]">
                                    <Reveal delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="slideScale" waitForLoaders={true} as={motion.aside} className="border-r border-border bg-card overflow-y-auto thin-scrollbar" style={{ height: 'calc(100dvh - 12.5rem)' }}>
                                        <div className="p-3 sm:p-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10">
                                            <div className="flex items-center gap-2">
                                                <Input placeholder="Search chats…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
                                                <Button variant={onlyUnread ? 'default' : 'outline'} size="icon" title="Only unread" onClick={() => setOnlyUnread(v => !v)}>
                                                    <Icon name="Bell" size={16} />
                                                </Button>
                                                <Button variant={onlyPinned ? 'default' : 'outline'} size="icon" title="Only pinned" onClick={() => setOnlyPinned(v => !v)}>
                                                    <Icon name="Pin" size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                        <ThreadList
                                            items={filteredThreads}
                                            selectedId={selectedId}
                                            onSelect={selectThread}
                                            onPin={(id) => pinThread(id, true)}
                                            onUnpin={(id) => pinThread(id, false)}
                                            onDelete={handleDeleteThread}
                                            onClear={handleClearThread}
                                        />
                                    </Reveal>

                                    <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="slideScale" waitForLoaders={true} as={motion.section} className="bg-card overflow-hidden" style={{ height: 'calc(100dvh - 12.5rem)' }}>
                                        {activeThread ? (
                                            <ChatWindow
                                                key={activeThread.id}
                                                currentUser={currentUser}
                                                currentUserRole={userRole}
                                                thread={{
                                                    ...activeThread,
                                                    participants: dedupeParticipants(activeThread.participants || [])
                                                }}
                                                messages={activeMessages}
                                                onSend={onSendFromWindow}
                                                onAutoReply={onAutoReply}
                                                onClearThread={() => { if (canManageActive) clearThread(activeThread.id); }}
                                                onDeleteThread={() => { if (canManageActive) { deleteThread(activeThread.id); selectThread(''); } }}
                                                onPinToggle={() => pinThread(activeThread.id, !activeThread.pinned)}
                                                onToggleReaction={(mid, emoji) => toggleReaction(activeThread.id, mid, emoji)}
                                                onEditMessage={(mid, text) => updateMessage(activeThread.id, mid, () => ({ text }))}
                                                onDeleteMessage={(mid) => deleteMessage(activeThread.id, mid)}
                                                onAckRead={onAckRead}
                                                draft={draft}
                                                setDraft={setDraft}
                                                showTyping={false}
                                                showUnreadDivider={false}
                                                showNewMessagesBadge={false}
                                            />
                                        ) : (
                                            <div className="h-full grid place-items-center text-muted-foreground p-6">
                                                <div className="text-center">
                                                    <div className="text-3xl mb-2">💬</div>
                                                    <div className="font-medium">Select a chat or create a new one</div>
                                                    <div className="text-sm mt-1">You can search or filter chats on the left.</div>
                                                </div>
                                            </div>
                                        )}
                                    </Reveal>

                                    <Reveal delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="slideScale" waitForLoaders={true} as={motion.aside} className="hidden xl:block border-l border-border overflow-y-auto bg-card thin-scrollbar" style={{ height: 'calc(100dvh - 12.5rem)' }}>
                                        <RightSidebar
                                            thread={activeThread ? { ...activeThread, participants: dedupeParticipants(activeThread.participants || []) } : activeThread}
                                            onInsertToComposer={onInsertToComposer}
                                            onSendToChat={onSendFromRight}
                                            onUpdateThread={(patch) => activeThread && applyThreadPatch(patch)}
                                            isOwner={canManageActive}
                                            currentUserRole={userRole}
                                        />
                                    </Reveal>
                                </div>
                            </Reveal>
                            </div>
                        </Reveal>
                        </>
                        )}

                        <div className="lg:hidden" aria-hidden="true" style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />
                    </div>
                </main>

                <PageFooter
                    left={[
                        'MAIS 2.0',
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
                    containerClassName="px-3 sm:px-4 md:px-6"
                />
            </div>

            {showToolsDrawer && (
                <div className="xl:hidden fixed inset-0 z-[120]">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowToolsDrawer(false)} aria-hidden="true" />
                    <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col" role="dialog" aria-label="Chat tools">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Icon name="Wrench" size={16} />
                                Tools
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowToolsDrawer(false)}>
                                <Icon name="X" size={18} />
                            </Button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar">
                            <RightSidebar
                                thread={activeThread ? { ...activeThread, participants: dedupeParticipants(activeThread.participants || []) } : activeThread}
                                onInsertToComposer={(t) => { onInsertToComposer(t); }}
                                onSendToChat={(t, ann) => onSendFromRight(t, ann)}
                                onUpdateThread={(patch) => activeThread && applyThreadPatch(patch)}
                                isOwner={canManageActive}
                                currentUserRole={userRole}
                            />
                        </div>
                        <div className="h-[env(safe-area-inset-bottom)]" />
                    </aside>
                </div>
            )}
        </div>
    );
};

const ChatPage = () => {
    return (
        <ToastsProvider>
            <ChatPageInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default ChatPage;