// src/pages/chat/components/ThreadList.jsx
import React, { useMemo, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Avatar, stripTitlesFrom } from '../utils/chatUtils';
import { useAuth } from '../../../contexts/AuthContext';

const SHARED_THREADS = 'mais.chat.shared.threads.v1';
const SHARED_MSGS = 'mais.chat.shared.messages.v1';

const memoryStore = new Map();

const readJSON = (key, fallback) => {
    if (!memoryStore.has(key)) return fallback;
    const value = memoryStore.get(key);
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const writeJSON = (key, value) => {
    try {
        memoryStore.set(key, JSON.parse(JSON.stringify(value)));
    } catch {
        memoryStore.set(key, value);
    }
};

const getLSKeys = (email) => {
    const normalized = String(email || '').toLowerCase() || 'anon';
    return {
        LS_THREADS: SHARED_THREADS,
        LS_MSGS: SHARED_MSGS,
        LS_META: `mais.chat.${normalized}.meta.v3`,
    };
};

const norm = (s = '') => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const safeTs = (v) => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
};

const getThreadMessages = (threadId, email) => {
    const snap = readJSON(getLSKeys(email).LS_MSGS, {});
    if (Array.isArray(snap)) return snap.filter((m) => m?.threadId === threadId);
    if (snap && typeof snap === 'object') {
        if (Array.isArray(snap[threadId])) return snap[threadId];
    }
    return [];
};

const getLastReadAtFromMeta = (threadId, email) => {
    const meta = readJSON(getLSKeys(email).LS_META, { reads: {} });
    const ts = meta?.reads?.[threadId];
    return safeTs(ts);
};

const setLastReadAtInMeta = (threadId, ts, email) => {
    const k = getLSKeys(email).LS_META;
    const meta = readJSON(k, { reads: {} });
    const next = { ...meta, reads: { ...(meta.reads || {}), [threadId]: safeTs(ts) } };
    writeJSON(k, next);
    try { window.dispatchEvent(new CustomEvent('chat:mark-read-upto', { detail: { threadId, ts: safeTs(ts) } })); } catch {}
};

const lastMessageTs = (threadId, items, email) => {
    const msgs = getThreadMessages(threadId, email);
    let ts = 0;
    for (let i = 0; i < msgs.length; i++) ts = Math.max(ts, safeTs(msgs[i]?.ts || msgs[i]?.timestamp));
    if (!ts) {
        const t = (items || []).find((x) => x.id === threadId);
        ts = safeTs(t?.lastMessageAt);
    }
    return ts;
};

const countUnreadForThread = (threadId, profile) => {
    const email = String(profile?.email || '').toLowerCase();
    const name = stripTitlesFrom(String(profile?.fullName || profile?.name || 'User'));
    const selfId = email ? `usr:${email}` : 'me';
    const candidates = [selfId, `usr:${email}`, `fac:${email}`, `stu:${email}`];
    const lastReadAt = getLastReadAtFromMeta(threadId, email);
    const msgs = getThreadMessages(threadId, email);
    let cnt = 0;
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i] || {};
        const ts = safeTs(m.ts || m.timestamp);
        if (ts <= lastReadAt) continue;
        const fromStr = String(m.from || '').toLowerCase();
        if (fromStr === 'self' || fromStr === 'teacher') continue;
        const fromAI = fromStr.includes('ai') || m.authorRole === 'ai';
        if (fromAI) continue;
        const authoredBy = String(m.authorId || '');
        const authorEmail = String(m.authorEmail || '').toLowerCase();
        const mineById = (authoredBy && candidates.includes(authoredBy));
        const mineByEmail = !!email && !!authorEmail && authorEmail === email;
        const mineByName = norm(stripTitlesFrom(m.authorName || '')) === norm(name);
        const mine = mineById || mineByEmail || mineByName;
        if (!mine) cnt++;
    }
    return cnt;
};

const initialUnreads = (items = [], profile = {}) => {
    const m = {};
    (items || []).forEach((t) => {
        m[t.id] = countUnreadForThread(t.id, profile);
    });
    return m;
};

const ThreadItem = ({ item, active, unread, onClick, onPin, onUnpin, onDelete, onClear, resolveName }) => {
    const computedTitle = useMemo(() => {
        if (item.title?.trim()) return item.title;
        const names = (item.participants || []).map(resolveName).filter(Boolean);
        return names.length ? names.join(', ') : 'Untitled chat';
    }, [item.title, item.participants, resolveName]);

    const last = item.lastMessageText || '';
    const time = item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item.id); } };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick(item.id)}
            onKeyDown={onKey}
            className={`w-full px-3 sm:px-4 py-3 sm:py-3 text-left hover:bg-muted/30 transition-colors flex gap-3 items-start cursor-pointer rounded-lg border border-border bg-card ${active ? 'bg-muted/40 border-primary/30' : ''}`}
            title={computedTitle}
        >
            <div className="mt-0.5">
                <Avatar name={computedTitle} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{computedTitle}</div>
                    {item.pinned && <Icon name="Pin" size={14} className="text-primary" />}
                    {!!unread && (
                        <span className="ml-auto text-[11px] bg-primary/10 border border-primary/30 text-primary px-1.5 py-0.5 rounded">{unread}</span>
                    )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{last || 'No messages yet'}</div>
            </div>
            <div className="pl-1 text-[11px] text-muted-foreground self-start whitespace-nowrap">{time}</div>
            <div className="ml-auto" role="group" aria-label="Thread actions">
                <div className="flex items-center gap-1">
                    {item.pinned ? (
                        <Button size="xs" variant="ghost" iconName="PinOff" title="Unpin" onClick={(e) => { e.stopPropagation(); onUnpin(item.id); }} />
                    ) : (
                        <Button size="xs" variant="ghost" iconName="Pin" title="Pin" onClick={(e) => { e.stopPropagation(); onPin(item.id); }} />
                    )}
                    <Button size="xs" variant="ghost" iconName="Broom" title="Clear" onClick={(e) => { e.stopPropagation(); onClear(item.id); }} />
                    <Button size="xs" variant="ghost" iconName="Trash2" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} />
                </div>
            </div>
        </div>
    );
};

const ThreadList = ({ items, selectedId, onSelect, onPin, onUnpin, onDelete, onClear }) => {
    const { user, userProfile } = useAuth();
    const primaryEmail = user?.email || userProfile?.email || '';
    const profile = useMemo(() => ({
        email: primaryEmail,
        fullName: userProfile?.full_name || user?.full_name || '',
        name: userProfile?.full_name || user?.full_name || ''
    }), [primaryEmail, user?.full_name, userProfile?.full_name]);

    const [unreads, setUnreads] = useState(() => initialUnreads(items, profile));

    const computeAll = useCallback(
        (list) => {
            setUnreads(initialUnreads(list || [], profile));
        },
        [profile]
    );

    useLayoutEffect(() => {
        setUnreads(initialUnreads(items, profile));
    }, [items, profile]);

    useEffect(() => {
        const onStorage = () => computeAll(items || []);
        const onMsg = (e) => {
            const tid = e?.detail?.threadId;
            if (!tid) return;
            setUnreads((prev) => ({ ...prev, [tid]: countUnreadForThread(tid, profile) }));
        };
        const onHydrate = (e) => {
            const incoming = (e && e.detail && typeof e.detail === 'object' && e.detail['unreadMap']) || {};
            if (incoming && typeof incoming === 'object') setUnreads((prev) => ({ ...prev, ...incoming }));
        };
        const onMarkReadUpto = (e) => {
            const tid = e?.detail?.threadId;
            if (!tid) return;
            setUnreads((prev) => ({ ...prev, [tid]: 0 }));
        };
        const onFocus = () => computeAll(items || []);
        window.addEventListener('storage', onStorage);
        window.addEventListener('chat:message', onMsg);
        window.addEventListener('threads:hydrate-unread', onHydrate);
        window.addEventListener('chat:mark-read-upto', onMarkReadUpto);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('chat:message', onMsg);
            window.removeEventListener('threads:hydrate-unread', onHydrate);
            window.removeEventListener('chat:mark-read-upto', onMarkReadUpto);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [items, computeAll, profile]);

    useEffect(() => {
        if (!selectedId) return;
        setUnreads((prev) => ({ ...prev, [selectedId]: 0 }));
        setLastReadAtInMeta(selectedId, Date.now(), primaryEmail);
    }, [selectedId, primaryEmail]);

    const markThreadReadNow = useCallback(
        (id) => {
            const ts = lastMessageTs(id, items, primaryEmail) || Date.now();
            setLastReadAtInMeta(id, ts, primaryEmail);
            setUnreads((prev) => ({ ...prev, [id]: 0 }));
        },
        [items, primaryEmail]
    );

    const handleSelect = (id) => {
        onSelect(id);
        markThreadReadNow(id);
    };

    if (!items?.length) {
        return <div className="p-4 sm:p-6 text-sm text-muted-foreground">No chats yet. Click "New chat".</div>;
    }

    return (
        <div role="list" aria-label="Chats" className="p-3 sm:p-4 space-y-2">
            {items.map((t) => (
                <ThreadItem
                    key={t.id}
                    item={t}
                    active={t.id === selectedId}
                    unread={unreads[t.id] || 0}
                    onClick={handleSelect}
                    onPin={onPin}
                    onUnpin={onUnpin}
                    onDelete={onDelete}
                    onClear={onClear}
                    resolveName={(p) => p?.name || ''}
                />
            ))}
        </div>
    );
};

export default ThreadList;