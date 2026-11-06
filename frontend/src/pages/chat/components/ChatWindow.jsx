// src/pages/attendance-tracking/components/ChatWindow.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Textarea from '../../../components/ui/Textarea';
import { Avatar, hasGemini, findGemini, GEMINI, stripTitlesFrom, hasHumanParticipants } from '../utils/chatUtils';
import chatApi from '../../../data/chatApi';
import { extractApiErrorMessage } from '../../../utils/apiErrors';
import { useAuth } from '../../../contexts/AuthContext';

const EMOJIS = ['🙂','😀','😁','😂','🤣','😊','😍','🤓','😎','👍','👏','🙌','🔥','🎉','📌','✅','❗','❓','📣','📝','💡','🧠','📚','🧪','🧮'];
const activeThreadsState = new Map();

const ReactionPill = ({ emoji, count, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-1.5 h-6 rounded-full border text-xs flex items-center gap-1 ${active ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border hover:bg-muted'}`}
    >
        <span className="text-[16px] leading-none">{emoji}</span>
        <span className="leading-none">{count}</span>
    </button>
);

const Message = ({
                     m,
                     mine,
                     leftName,
                     onStartEdit,
                 onDelete,
                     onReact,
                     onReply,
                     isEditing,
                     editText,
                     setEditText,
                     onSaveEdit,
                     onCancelEdit,
                 replyPreview,
                 replyAuthor,
                 currentUserId
                 }) => {
    const ts = new Date(m.ts || m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isAI = m.from === 'ai';
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] sm:max-w-[92%] md:max-w-[86%] xl:max-w-[72%] ${mine ? '' : 'flex items-start gap-2'}`}>
                {!mine && (
                    <div className="mt-0.5">
                        <Avatar name={isAI ? 'Gemini' : (m.authorName || leftName || 'User')} />
                    </div>
                )}
                <div
                    className={`group rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 border shadow-sm ${
                        mine
                            ? 'bg-primary text-primary-foreground border-primary'
                            : isAI
                                ? 'bg-indigo-600/10 text-foreground border-indigo-600/30'
                                : 'bg-card text-foreground border-border'
                    }`}
                >
                    {!mine && (
                        <div className="text-[11px] font-medium mb-0.5 opacity-80">
                            {isAI ? 'Gemini' : (m.authorName || leftName || 'Participant')}
                        </div>
                    )}
                    {m.announcement && (
                        <div className="text-[11px] opacity-80 mb-1 flex items-center gap-1">
                            <span>📢</span>
                            <span>Announcement</span>
                        </div>
                    )}
                    {!!replyPreview && (
                        <div className="mb-1 text-xs opacity-80 border-l-2 pl-2 border-border line-clamp-2 max-w-prose">
                            {replyAuthor && (
                                <div className="font-medium text-[11px] mb-0.5">{replyAuthor}</div>
                            )}
                            <div>{replyPreview}</div>
                        </div>
                    )}
                    {isEditing ? (
                        <div className="space-y-2">
                            <Textarea
                                minRows={3}
                                resize="none"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className={`rounded-md ${mine ? 'bg-primary border-primary/60' : 'bg-background border-border'}`}
                                textareaClassName={`text-sm ${mine ? 'text-primary-foreground' : 'text-foreground'}`}
                            />
                            <div className="flex items-center gap-2 justify-end">
                                <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
                                <Button size="sm" iconName="Check" onClick={onSaveEdit}>Save</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
                    )}
                    {!!m.attachments?.length && (
                        <div className="mt-2 space-y-1">
                            {m.attachments.map((f, idx) => (
                                <div key={idx} className="text-xs opacity-90 flex items-center gap-2">
                                    <Icon name="Paperclip" size={12} />
                                    {f.url ? (
                                        f.type?.startsWith('image/') ? (
                                            <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                                                <img src={f.url} alt={f.name} className="max-h-20 rounded border border-border" />
                                                <span className="underline">{f.name}</span>
                                            </a>
                                        ) : (
                                            <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.name}</a>
                                        )
                                    ) : (
                                        <span>{f.name}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-1 text-[11px] opacity-70 flex items-center justify-between gap-2">
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                            <Button size="xs" variant="ghost" iconName="Smile" onClick={() => onReact()} />
                            <Button size="xs" variant="ghost" iconName="Reply" onClick={onReply} />
                            {mine && <Button size="xs" variant="ghost" iconName="Edit2" onClick={onStartEdit} />}
                            {mine && <Button size="xs" variant="ghost" iconName="Trash2" onClick={onDelete} />}
                        </div>
                        <div className="ml-auto">{ts}</div>
                    </div>
                    {!!m.reactions?.length && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {m.reactions.map((r) => (
                                <ReactionPill
                                    key={r.emoji}
                                    emoji={r.emoji}
                                    count={(r.by || []).length}
                                    active={!!currentUserId && (r.by || []).includes(currentUserId)}
                                    onClick={() => onReact(r.emoji)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

function useDismissOnOutsideAndEsc(open, refs, onClose) {
    useEffect(() => {
        if (!open) return;
        const handleDown = (e) => {
            for (const r of refs) {
                const el = r?.current;
                if (el && el.contains(e.target)) return;
            }
            onClose?.();
        };
        const handleEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('touchstart', handleDown, { passive: true });
        window.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('touchstart', handleDown);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [open, onClose, refs]);
}

function useResizeObserver(targetRef, cb, deps = []) {
    useLayoutEffect(() => {
        const el = targetRef?.current;
        if (!el) return;
        cb?.();
        let ro;
        if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
            ro = new ResizeObserver(() => cb?.());
            ro.observe(el);
        }
        const onResize = () => cb?.();
        window.addEventListener('resize', onResize);
        let cleanupOrientation = null;
        if (typeof screen !== 'undefined' && screen.orientation?.addEventListener) {
            const onOrient = () => cb?.();
            screen.orientation.addEventListener('change', onOrient);
            cleanupOrientation = () => screen.orientation.removeEventListener('change', onOrient);
        }
        return () => {
            window.removeEventListener('resize', onResize);
            if (ro) ro.disconnect();
            if (cleanupOrientation) cleanupOrientation();
        };
    }, deps);
}

const ChatWindow = ({
                        currentUser,
                        thread,
                        messages,
                        onSend,
                        onAutoReply,
                        onClearThread,
                        onDeleteThread,
                        onPinToggle,
                        onBackMobile,
                        onOpenInfoMobile,
                        onToggleReaction,
                        onEditMessage,
                        onDeleteMessage,
                        onAckRead,
                        draft,
                        setDraft
                    }) => {
    const listRef = useRef(null);
    const composerRef = useRef(null);
    const [composerH, setComposerH] = useState(0);
    const [showEmoji, setShowEmoji] = useState(false);
    const emojiBtnRef = useRef(null);
    const emojiPopRef = useRef(null);
    const emojiHostRef = useRef(null);
    const textareaRef = useRef(null);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [actionsOpen, setActionsOpen] = useState(false);
    const actionsRef = useRef(null);
    const [emojiCols, setEmojiCols] = useState(0);
    const [emojiWidth, setEmojiWidth] = useState(0);
    const [emojiLeft, setEmojiLeft] = useState(0);
    const CELL = 36;
    const GAP = 4;
    const PAD = 8;

    const { user, userProfile } = useAuth();
    const primaryEmail = user?.email || userProfile?.email || '';
    const selfEmail = String(primaryEmail || '').toLowerCase();
    const ACTIVE_KEY = selfEmail ? `mais.chat.${selfEmail}.active.v1` : 'mais.chat.active.v1';

    const isiOS = useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        const iPadOS13Plus = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
        return /iPad|iPhone|iPod/.test(ua) || iPadOS13Plus;
    }, []);
    const emojiShiftStyle = useMemo(() => (isiOS ? { transform: 'translateY(1px)' } : undefined), [isiOS]);

    const [atBottom, setAtBottom] = useState(true);
    const [replyToId, setReplyToId] = useState(null);
    const [editId, setEditId] = useState(null);
    const [editText, setEditText] = useState('');
    const [reactTargetId, setReactTargetId] = useState(null);

    useEffect(() => { setReplyToId(null); }, [thread?.id]);

    const [localReadAt, setLocalReadAt] = useState(0);
    useEffect(() => { setLocalReadAt(Number(thread?.lastReadAt || 0)); }, [thread?.id, thread?.lastReadAt]);

    const effectiveReadAt = useMemo(
        () => Math.max(Number(thread?.lastReadAt || 0), Number(localReadAt || 0)),
        [thread?.lastReadAt, localReadAt]
    );

    const scrollToBottom = (behavior = 'auto') => {
        const el = listRef.current;
        if (!el) return;
        if (behavior === 'smooth') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        else el.scrollTop = el.scrollHeight;
    };

    useEffect(() => {
        const root = listRef.current;
        if (!root) return;
        const onScroll = () => {
            const bottom = root.scrollHeight - root.scrollTop - root.clientHeight <= 4;
            setAtBottom(bottom);
        };
        onScroll();
        root.addEventListener('scroll', onScroll, { passive: true });
        return () => root.removeEventListener('scroll', onScroll);
    }, []);

    const onAckRef = useRef(onAckRead);
    useEffect(() => { onAckRef.current = onAckRead; }, [onAckRead]);
    const ackRef = useRef(0);

    const latestForeignTs = useMemo(() => {
        for (let i = (messages?.length || 0) - 1; i >= 0; i--) {
            const m = messages[i];
            if (m?.from !== 'self' && m?.from !== 'teacher') return m.ts || m.timestamp || 0;
        }
        return 0;
    }, [messages]);

    useEffect(() => {
        if (!atBottom) return;
        if (!latestForeignTs) return;
        if (latestForeignTs <= ackRef.current) return;
        if (latestForeignTs <= effectiveReadAt) return;
        ackRef.current = latestForeignTs;
        setLocalReadAt(latestForeignTs);
        onAckRef.current?.(latestForeignTs);
    }, [atBottom, latestForeignTs, effectiveReadAt]);

    useEffect(() => {
        const state = { threadId: thread?.id, atBottom, ts: Date.now() };
        activeThreadsState.set(ACTIVE_KEY, state);
    }, [thread?.id, atBottom, ACTIVE_KEY]);

    useResizeObserver(composerRef, () => setComposerH(composerRef.current?.offsetHeight || 0), []);
    const MAX_LINES = 2;
    const autoResizeTextarea = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const line = parseInt(getComputedStyle(el).lineHeight || '20', 10);
        const max = line * MAX_LINES;
        el.style.height = Math.min(el.scrollHeight, max) + 'px';
    };
    useLayoutEffect(autoResizeTextarea, []);
    useLayoutEffect(autoResizeTextarea, [draft]);

    useDismissOnOutsideAndEsc(showEmoji, [emojiPopRef, emojiBtnRef], () => { setShowEmoji(false); setReactTargetId(null); });
    useDismissOnOutsideAndEsc(actionsOpen, [actionsRef], () => setActionsOpen(false));

    const headerNames = useMemo(() => {
        const selfName = stripTitlesFrom((currentUser?.name || 'You').trim());
        const others = (thread.participants || []).map((p) => stripTitlesFrom(p.name)).filter(Boolean);
        const merged = [selfName, ...others];
        const seen = new Set(); const unique = [];
        merged.forEach((n) => { const key = n.toLowerCase(); if (!seen.has(key)) { seen.add(key); unique.push(n); } });
        return unique;
    }, [currentUser?.name, thread.participants]);
    const showStudyBadge = useMemo(() => (thread.participants || []).some((p) => p.role === 'student'), [thread.participants]);
    const title = useMemo(() => thread.title || headerNames.join(', ') || 'Chat', [thread.title, headerNames]);

    const geminiPresent = hasGemini(thread);
    const gemini = findGemini(thread);
    const hasHumans = hasHumanParticipants(thread);
    // If only AI is present, always use 'ai' mode; if AI + humans, allow choice
    const [recipientMode, setRecipientMode] = useState(geminiPresent && !hasHumans ? 'ai' : 'all');
    useEffect(() => {
        if (!geminiPresent) setRecipientMode('all');
        else if (!hasHumans) setRecipientMode('ai');
    }, [geminiPresent, hasHumans]);

    const canSend = (draft.trim().length > 0) || (attachments.length > 0);

    const send = () => {
        const trimmed = draft.trim();
        if (!trimmed && attachments.length === 0) return;
        const recipients = (recipientMode === 'ai' && geminiPresent && gemini) ? [gemini] : thread.participants;
        onSend({
            recipients,
            text: trimmed,
            attachments,
            announcement: false,
            replyToId
        });
        setDraft('');
        setAttachments([]);
        setReplyToId(null);
        requestAnimationFrame(() => { autoResizeTextarea(); });
    };

    const handleAttach = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !thread?.id) return;
        setUploadError('');
        setUploading(true);
        try {
            const uploads = [];
            for (const file of files) {
                const uploaded = await chatApi.uploadAttachment(thread.id, file);
                uploads.push({
                    name: uploaded?.name || file.name,
                    size: uploaded?.size ?? file.size,
                    type: uploaded?.contentType || file.type,
                    url: uploaded?.url || ''
                });
            }
            setAttachments((prev) => [...prev, ...uploads.filter((item) => item.url)]);
        } catch (error) {
            setUploadError(extractApiErrorMessage(error, 'Failed to upload attachment.'));
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };
    const removeAttachment = (url) => setAttachments((prev) => prev.filter((f) => f.url !== url));

    const exportJSON = () => {
        const payload = { thread, messages };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `chat_${thread.id}.json`; a.click();
        URL.revokeObjectURL(url);
    };
    const exportMD = () => {
        const header = `# Chat transcript\nTitle: ${title}\nParticipants: ${headerNames.join(', ')}\nDate: ${new Date().toLocaleString()}\n\n`;
        const body = messages.map((m) => {
            const who = m.from === 'self' || m.from === 'teacher' ? stripTitlesFrom(currentUser?.name || 'Me') : (m.authorName || (m.from === 'ai' ? 'Gemini' : 'Other'));
            const time = new Date(m.ts || m.timestamp || Date.now()).toLocaleTimeString();
            const ann = m.announcement ? ' **[Announcement]**' : '';
            return `- **${who}** (${time})${ann}: ${m.text}`;
        }).join('\n');
        const blob = new Blob([header + body + '\n']);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `chat_${thread.id}.md`; a.click();
        URL.revokeObjectURL(url);
    };

    const msgById = useMemo(() => {
        const m = new Map();
        (messages || []).forEach((x) => m.set(x.id, x));
        return m;
    }, [messages]);

    const replyTarget = replyToId ? msgById.get(replyToId) : null;
    const replyTargetText = replyTarget?.text?.trim() || 'Original message unavailable.';
    const replyTargetAuthor = replyTarget?.authorName || (replyTarget?.from === 'ai' ? 'Gemini' : (replyTarget ? replyTarget.authorEmail || 'Participant' : 'Message'));

    const recalcEmojiLayout = () => {
        const host = emojiHostRef.current;
        const btn = emojiBtnRef.current;
        if (!host || !btn) return;
        const hostRect = host.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const maxW = Math.min(420, Math.floor(hostRect.width - PAD * 2));
        let cols = Math.max(1, Math.floor((maxW + GAP) / (CELL + GAP)));
        let width = cols * CELL + (cols - 1) * GAP + PAD * 2;
        if (width > hostRect.width) {
            cols = Math.max(1, cols - 1);
            width = cols * CELL + (cols - 1) * GAP + PAD * 2;
        }
        const btnCenter = btnRect.left + btnRect.width / 2 - hostRect.left;
        const left = Math.max(PAD, Math.min(btnCenter - width / 2, hostRect.width - width - PAD));
        setEmojiCols(cols);
        setEmojiWidth(width);
        setEmojiLeft(left);
    };

    useResizeObserver(emojiHostRef, recalcEmojiLayout, [showEmoji, CELL, GAP, PAD]);

    const firstLeftName = stripTitlesFrom(thread.participants?.[0]?.name || 'User');

    const hasUnread = useMemo(() => {
        return (messages || []).some(
            (m) => m?.from !== 'self' && m?.from !== 'teacher' && (m.ts || m.timestamp || 0) > effectiveReadAt
        );
    }, [messages, effectiveReadAt]);

    const unreadAnchorRef = useRef(null);
    const didInitialScrollRef = useRef(false);
    useEffect(() => { didInitialScrollRef.current = false; }, [thread?.id]);

    useLayoutEffect(() => {
        if (didInitialScrollRef.current) return;
        const list = listRef.current;
        if (!list) return;
        if (hasUnread && unreadAnchorRef.current) {
            const y = Math.max(0, unreadAnchorRef.current.offsetTop - 12);
            list.scrollTo({ top: y, behavior: 'auto' });
        } else {
            scrollToBottom('auto');
        }
        didInitialScrollRef.current = true;
    }, [hasUnread, thread?.id, effectiveReadAt]);

    useLayoutEffect(() => {
        if (atBottom && !hasUnread) scrollToBottom('auto');
    }, [messages.length, atBottom, hasUnread]);

    return (
        <div className="relative h-full overflow-hidden flex flex-col">

            <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                    {typeof onBackMobile === 'function' && (
                        <Button className="md:hidden" size="sm" variant="outline" iconName="ChevronLeft" onClick={onBackMobile} />
                    )}
                    <div className="min-w-0">
                        <div className="font-semibold truncate">{title}</div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                            {showStudyBadge && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary">Study</span>
                            )}
                            {geminiPresent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-600">
                  <Icon name="Sparkles" size={12} /> Gemini
                </span>
                            )}
                            <span className="truncate">{headerNames.join(', ')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <div className="xl:hidden relative" ref={actionsRef}>
                        <div className="flex items-center gap-1">
                            {typeof onOpenInfoMobile === 'function' && (
                                <Button size="sm" variant="outline" iconName="Wrench" onClick={onOpenInfoMobile} />
                            )}
                            <Button size="sm" variant="outline" iconName="MoreVertical" onClick={() => setActionsOpen((v) => !v)} />
                        </div>
                        {actionsOpen && (
                            <div className="absolute right-0 top-full mt-2 w-44 rounded-md border border-border bg-popover shadow-lg p-1 z-50">
                                <button className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2" onClick={() => { setActionsOpen(false); onPinToggle?.(); }}>
                                    <Icon name="Pin" size={14} /> Pin
                                </button>
                                <button className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2" onClick={() => { setActionsOpen(false); exportMD(); }}>
                                    <Icon name="Download" size={14} /> .md
                                </button>
                                <button className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2" onClick={() => { setActionsOpen(false); exportJSON(); }}>
                                    <Icon name="File" size={14} /> .json
                                </button>
                                <button className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2" onClick={() => { setActionsOpen(false); onClearThread?.(); }}>
                                    <Icon name="Broom" size={14} /> Clear
                                </button>
                                <button className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2" onClick={() => { setActionsOpen(false); onDeleteThread?.(); }}>
                                    <Icon name="Trash2" size={14} /> Delete
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="hidden xl:flex items-center gap-1 whitespace-nowrap overflow-x-auto hide-scrollbar">
                        <Button size="sm" variant="outline" iconName="Pin" onClick={onPinToggle}>Pin</Button>
                        <Button size="sm" variant="outline" iconName="Download" onClick={exportMD}>.md</Button>
                        <Button size="sm" variant="outline" onClick={exportJSON}>.json</Button>
                        <Button size="sm" variant="ghost" iconName="Broom" onClick={onClearThread}>Clear</Button>
                        <Button size="sm" variant="ghost" iconName="Trash2" onClick={onDeleteThread}>Delete</Button>
                    </div>
                </div>
            </div>

            <div
                ref={listRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-6 space-y-3 thin-scrollbar bg-card"
            >
                {(!messages || messages.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation 👋</div>
                )}
                {messages.map((m, idx) => {
                    const mine = m.from === 'self' || m.from === 'teacher';

                    const showDivider =
                        hasUnread &&
                        !mine &&
                        (m.ts || m.timestamp || 0) > effectiveReadAt &&
                        (idx === 0 || ((messages[idx - 1]?.ts || messages[idx - 1]?.timestamp || 0) <= effectiveReadAt));

                    const replyTargetMsg = m.replyToId ? msgById.get(m.replyToId) : null;
                    const replyPreview = m.replyToId
                        ? (replyTargetMsg?.text?.trim() || 'Original message unavailable.')
                        : null;
                    const replyAuthor = replyTargetMsg?.authorName
                        || (replyTargetMsg?.from === 'ai' ? 'Gemini' : (replyTargetMsg ? replyTargetMsg.authorEmail || 'Participant' : null));

                    return (
                        <React.Fragment key={m.id || m.ts || m.timestamp || idx}>
                            {showDivider && (
                                <>
                                    <div ref={unreadAnchorRef} />
                                    <div className="sticky top-2 z-10">
                                        <div className="mx-auto w-fit text-[11px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary">
                                            New messages
                                        </div>
                                    </div>
                                </>
                            )}
                            <Message
                                m={m}
                                mine={mine}
                                leftName={stripTitlesFrom(m.authorName || firstLeftName)}
                                onStartEdit={() => { setEditId(m.id); setEditText(m.text || ''); }}
                                onDelete={() => onDeleteMessage?.(m.id)}
                                onReact={(preset) => {
                                    if (preset) onToggleReaction?.(m.id, preset);
                                    else { setReactTargetId(m.id); setShowEmoji(true); }
                                }}
                                onReply={() => setReplyToId(m.id)}
                                isEditing={editId === m.id}
                                editText={editText}
                                setEditText={setEditText}
                                onSaveEdit={() => {
                                    if (editText.trim()) onEditMessage?.(m.id, editText.trim());
                                    setEditId(null);
                                    setEditText('');
                                }}
                                onCancelEdit={() => { setEditId(null); setEditText(''); }}
                                replyPreview={replyPreview}
                                replyAuthor={replyAuthor}
                                currentUserId={currentUser?.id}
                            />
                        </React.Fragment>
                    );
                })}
            </div>

            <div
                className={`absolute right-3 z-20 transition-opacity duration-150 pointer-events-none ${atBottom ? 'opacity-0' : 'opacity-100'}`}
                style={{ bottom: (composerH || 56) + 12 }}
            >
                <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="pointer-events-auto inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-background/90 backdrop-blur shadow hover:bg-background"
                    title="Jump to latest"
                >
                    <Icon name="ArrowDown" size={16} />
                </button>
            </div>

            <div ref={composerRef} className="border-t border-border p-3 sm:p-4 md:p-6 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky bottom-0 z-10">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Show AI-only badge when only AI is present */}
                    {geminiPresent && !hasHumans && (
                        <div className="flex items-center gap-1 order-1">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/20">
                                <Icon name="Sparkles" size={12} />
                                AI Chat
                            </div>
                        </div>
                    )}
                    {/* Show All/AI toggle only when there are both AI and human participants */}
                    {geminiPresent && hasHumans && (
                        <div className="flex items-center gap-1 order-1">
                            <Button
                                size="sm"
                                variant={recipientMode === 'all' ? 'default' : 'outline'}
                                onClick={() => setRecipientMode('all')}
                                iconName="Users"
                            >
                                All
                            </Button>
                            <Button
                                size="sm"
                                variant={recipientMode === 'ai' ? 'default' : 'outline'}
                                onClick={() => setRecipientMode('ai')}
                                iconName="Sparkles"
                            >
                                AI
                            </Button>
                        </div>
                    )}

                    {replyToId && (
                        <div className="order-2 w-full flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground mb-0.5">
                                    Replying to {replyTargetAuthor || 'message'}
                                </div>
                                <div className="text-sm text-foreground line-clamp-2 break-words">{replyTargetText}</div>
                            </div>
                            <Button
                                size="xs"
                                variant="ghost"
                                iconName="X"
                                aria-label="Cancel reply"
                                onClick={() => setReplyToId(null)}
                            />
                        </div>
                    )}

                    <div ref={emojiHostRef} className="relative flex-1 min-w-[200px] order-3">
                        <Textarea
                            ref={textareaRef}
                            minRows={1}
                            resize="none"
                            value={draft}
                            onChange={(e) => { setDraft(e.target.value); requestAnimationFrame(autoResizeTextarea); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            placeholder="Write a message…"
                            className="rounded-md border border-border bg-background"
                            textareaClassName="min-h-[36px] text-sm"
                        />
                        {showEmoji && (
                            <div
                                ref={emojiPopRef}
                                className="absolute bottom-full mb-2 box-border bg-popover border border-border rounded-md shadow-lg p-2 grid gap-1 z-50 justify-items-center pointer-events-auto select-none overflow-y-auto overflow-x-hidden hide-scrollbar"
                                style={{
                                    width: emojiWidth ? `${emojiWidth}px` : undefined,
                                    left: emojiLeft ? `${emojiLeft}px` : undefined,
                                    maxHeight: '12rem',
                                    gridTemplateColumns: `repeat(${emojiCols || 1}, ${CELL}px)`
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                            >
                                {EMOJIS.map((em) => (
                                    <button
                                        key={em}
                                        type="button"
                                        className="h-9 w-9 grid place-items-center rounded hover:bg-muted touch-manipulation overflow-hidden shrink-0"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (reactTargetId) {
                                                onToggleReaction?.(reactTargetId, em);
                                                setReactTargetId(null);
                                                setShowEmoji(false);
                                                return;
                                            }
                                            const el = textareaRef.current;
                                            const cur = draft;
                                            const start = el?.selectionStart ?? cur.length;
                                            const end = el?.selectionEnd ?? cur.length;
                                            const next = cur.slice(0, start) + em + cur.slice(end);
                                            setDraft(next);
                                            requestAnimationFrame(() => {
                                                el?.focus();
                                                const pos = start + em.length;
                                                el?.setSelectionRange(pos, pos);
                                                autoResizeTextarea();
                                            });
                                        }}
                                        title={em}
                                    >
                                        <span className="text-[18px] leading-none pointer-events-none select-none" style={emojiShiftStyle}>{em}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 order-3">
                        <label className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border hover:bg-muted cursor-pointer">
                            <Icon name="Paperclip" size={16} />
                            <input
                                type="file"
                                className="hidden"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.xlsx,.pptx,.txt,.zip"
                                onChange={handleAttach}
                            />
                        </label>
                        <Button
                            ref={emojiBtnRef}
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setReactTargetId(null); setShowEmoji((v) => !v); }}
                            title="Emoji"
                        >
                            <Icon name="Smile" size={16} />
                        </Button>
                        <Button type="button" variant="default" onClick={send} iconName="Send" disabled={!canSend}>Send</Button>
                    </div>

                    {uploadError && (
                        <div className="basis-full order-4 text-xs text-rose-600">{uploadError}</div>
                    )}
                    {uploading && (
                        <div className="basis-full order-4 text-xs text-muted-foreground">Uploading…</div>
                    )}
                    {!!attachments.length && (
                        <div className="basis-full order-4 pt-2 flex flex-wrap gap-2">
                            {attachments.map((a) => (
                                <div
                                    key={a.url || a.name}
                                    className="inline-flex items-center gap-2 px-2 py-1 rounded border border-border bg-muted/40 text-xs"
                                >
                                    <Icon name="Paperclip" size={12} />
                                    {a.url ? (
                                        <a href={a.url} target="_blank" rel="noreferrer" className="truncate max-w-[160px] underline">
                                            {a.name}
                                        </a>
                                    ) : (
                                        <span className="truncate max-w-[160px]">{a.name}</span>
                                    )}
                                    <button className="ml-1 rounded p-0.5 hover:bg-muted" onClick={() => removeAttachment(a.url || a.name)} title="Remove">
                                        <Icon name="X" size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
        </div>
    );
};

export default ChatWindow;