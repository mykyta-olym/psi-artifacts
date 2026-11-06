// src/hooks/useChatStore.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import chatApi from '../data/chatApi';
import apiClient from '../utils/apiClient';
import { extractApiErrorMessage } from '../utils/apiErrors';
import { createLogger } from '../utils/logger';
const logger = createLogger('useChatStore');

const TEACHER_ROLE_ALIASES = new Set(['teacher', 'faculty', 'professor']);
const STUDENT_ROLE_ALIASES = new Set(['student', 'pupil', 'learner']);

const normalizeEmail = (value = '') => String(value ?? '').trim().toLowerCase();

const canonicalRole = (role = '') => {
  const normalized = normalizeEmail(role);
  if (TEACHER_ROLE_ALIASES.has(normalized)) return 'teacher';
  if (STUDENT_ROLE_ALIASES.has(normalized)) return 'student';
  if (normalized === 'ai') return 'ai';
  return normalized || 'student';
};

const participantKey = (role = '', email = '') => {
  const canonical = canonicalRole(role);
  if (canonical === 'ai') return 'ai:gemini';
  const normalizedEmail = normalizeEmail(email);
  const prefix = canonical === 'teacher' ? 'fac' : canonical === 'student' ? 'stu' : 'usr';
  return normalizedEmail ? `${prefix}:${normalizedEmail}` : `${prefix}:unknown`;
};

const safeTs = (value) => {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) return num;
  return Date.now();
};

const normalizeThread = (dto) => {
  if (!dto) return null;
  const lastMessageAt = dto.lastMessageTs ?? dto.lastMessageAt ?? dto.updatedTs ?? dto.createdTs ?? Date.now();
  return {
    id: dto.id,
    title: dto.title || 'Chat',
    ownerId: dto.ownerId || '',
    ownerEmail: dto.ownerEmail || '',
    aiEnabled: !!dto.aiEnabled,
    participants: Array.isArray(dto.participants) ? dto.participants : [],
    createdTs: dto.createdTs ?? lastMessageAt,
    updatedTs: dto.updatedTs ?? lastMessageAt,
    lastMessageTs: dto.lastMessageTs ?? null,
    lastMessageAt,
    lastMessageText: dto.lastMessagePreview || '',
    _unread: dto.unreadCount ?? dto.unread ?? 0,
    _pin: dto.pinned ?? dto._pin ?? false
  };
};

const mapAttachment = (a = {}) => ({
  name: a.name || a.fileName || 'attachment',
  type: a.contentType || a.type || '',
  size: typeof a.size === 'number' ? a.size : 0,
  url: a.url || a.downloadUrl || null
});

const mapMessage = (message, selfKey, selfEmail) => {
  if (!message) return null;
  const authorRole = canonicalRole(message.authorRole);
  const normalizedSelfEmail = normalizeEmail(selfEmail);
  const normalizedAuthorEmail = normalizeEmail(message.authorEmail);
  const isSelf = message.authorId === selfKey || (!!normalizedSelfEmail && normalizedAuthorEmail === normalizedSelfEmail);
  const from = authorRole === 'ai'
    ? 'ai'
    : (isSelf ? 'self' : authorRole === 'teacher' ? 'teacher' : 'other');
    return {
    id: message.id,
    threadId: message.threadId,
    text: message.text ?? '',
    announcement: !!message.announcement,
    targetAi: !!message.targetAi,
    replyToId: message.replyToId ?? null,
    clientId: message.clientId ?? null,
    ts: safeTs(message.ts),
    authorId: message.authorId || '',
    authorEmail: normalizedAuthorEmail || '',
    authorRole,
    authorName: message.authorName || '',
    from,
    deleted: !!message.deleted,
    reactions: Array.isArray(message.reactions)
      ? message.reactions.map((r) => ({
        emoji: r.emoji,
        by: Array.isArray(r.by) ? r.by : []
      }))
      : [],
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map(mapAttachment)
      : []
  };
};

const emailFromId = (value = '') => {
  const raw = String(value ?? '');
  if (!raw) return '';
  const idx = raw.indexOf(':');
  const candidate = idx >= 0 ? raw.slice(idx + 1) : raw;
  return candidate.toLowerCase();
};

const canonicalKey = (participant) => {
  if (!participant) return '';
  if (participant.email) return String(participant.email).toLowerCase();
  if (participant.id) {
    const email = emailFromId(participant.id);
    if (email) return email;
    return String(participant.id).toLowerCase();
  }
  return '';
};

const dedupeParticipants = (list = []) => {
  const map = new Map();
  for (const item of list || []) {
    if (!item) continue;
    const key = canonicalKey(item);
    if (!key) continue;
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...item });
      continue;
    }
    const prefer =
      (current.role !== 'ai' && item.role === 'ai') ||
      (current.role !== 'faculty' && item.role === 'faculty') ||
      (!current.name && item.name);
    if (prefer) {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
};

const sortThreads = (list) => {
  return [...list].sort((a, b) => {
    if (!!b._pin - !!a._pin !== 0) return +b._pin - +a._pin;
    const aTime = safeTs(a.lastMessageAt ?? a.updatedTs ?? a.createdTs);
    const bTime = safeTs(b.lastMessageAt ?? b.updatedTs ?? b.createdTs);
    return bTime - aTime;
  });
};

const buildAttachmentPayload = (attachments = []) =>
  attachments.map((a) => ({
    name: a.name || a.fileName || 'attachment',
    contentType: a.type || a.contentType || null,
    size: typeof a.size === 'number' ? a.size : 0,
    url: a.url || null
  }));

export default function useChatStore() {
    const { user, userProfile } = useAuth();
  const primaryEmail = user?.email || userProfile?.email || '';
  const authEmail = normalizeEmail(primaryEmail || userProfile?.email || '');
  const profileMatches = userProfile?.email && normalizeEmail(userProfile.email) === authEmail;
  const rawRole = user?.role || userProfile?.role || '';
  const selfRole = canonicalRole(rawRole);
  const isFaculty = selfRole === 'teacher';
  const selfId = authEmail ? participantKey(selfRole, authEmail) : 'me';
  const defaultName =
    (profileMatches ? (userProfile?.full_name || userProfile?.name) : null) ||
    (normalizeEmail(user?.email) === authEmail ? (user?.full_name || user?.name) : null) ||
    (authEmail ? authEmail.split('@')[0] : 'User');

  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState([]);
  const [messagesByThread, setMessagesByThread] = useState(new Map());
  const [currentUser, setCurrentUser] = useState({ id: selfId, name: defaultName });

  const threadsRef = useRef(threads);
  const messagesRef = useRef(messagesByThread);
  const inflightThreadFetch = useRef(new Map());
const connectionRef = useRef(null);
const joinedThreadRef = useRef(null);
const connectionStateRef = useRef('disconnected');
const queuedThreadIdRef = useRef(null);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    messagesRef.current = messagesByThread;
  }, [messagesByThread]);

    useEffect(() => {
    setCurrentUser((prev) => ({
      id: selfId,
      name: prev?.name || defaultName
    }));
  }, [selfId, defaultName]);

  const reportError = useCallback((error, fallback) => {
    const message = extractApiErrorMessage(error, fallback);
    logger.error(message, error);
    return message;
  }, []);

  const upsertThread = useCallback((partial) => {
    if (!partial || !partial.id) {
      logger.debug('[chat] upsertThread ignored - no id', partial);
      return;
    }
    setThreads((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      const existing = map.get(partial.id) || {};
      const merged = {
        ...existing,
        ...partial
      };
      merged.lastMessageAt = merged.lastMessageAt ?? merged.lastMessageTs ?? merged.updatedTs ?? merged.createdTs ?? Date.now();
      map.set(partial.id, merged);
      const sorted = sortThreads(Array.from(map.values()));
      logger.debug('[chat] upsertThread - thread added/updated', {
        threadId: partial.id,
        title: partial.title,
        prevCount: prev.length,
        newCount: sorted.length,
        isNew: !existing.id
      });
      return sorted;
    });
  }, []);

  const removeThread = useCallback((threadId) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    setMessagesByThread((prev) => {
      const map = new Map(prev);
      map.delete(threadId);
      return map;
    });
  }, []);

  const replaceMessages = useCallback((threadId, messages) => {
    setMessagesByThread((prev) => {
      const map = new Map(prev);
      map.set(threadId, messages);
      return map;
    });
  }, []);

  const mergeMessage = useCallback((threadId, message) => {
    if (!message) return;
    setMessagesByThread((prev) => {
      const map = new Map(prev);
      const list = map.get(threadId) || [];
      const filtered = list.filter((m) => m.id !== message.id);
      filtered.push(message);
      filtered.sort((a, b) => safeTs(a.ts) - safeTs(b.ts));
      map.set(threadId, filtered);
      return map;
    });
  }, []);

  const removeMessage = useCallback((threadId, messageId) => {
    setMessagesByThread((prev) => {
      const map = new Map(prev);
      const list = map.get(threadId) || [];
      const filtered = list.filter((m) => m.id !== messageId);
      map.set(threadId, filtered);
      return map;
    });
  }, []);

  const updateMessageLocal = useCallback((threadId, messageId, updater) => {
    setMessagesByThread((prev) => {
      const map = new Map(prev);
      const list = map.get(threadId) || [];
      const next = list.map((m) => (m.id === messageId ? updater(m) : m));
      map.set(threadId, next);
      return map;
    });
  }, []);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatApi.listThreads();
      const mapped = Array.isArray(data) ? data.map(normalizeThread).filter(Boolean) : [];
      setThreads(sortThreads(mapped));
    } catch (error) {
      reportError(error, 'Unable to load chat threads.');
    } finally {
      setLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
        try {
            const unreadMap = {};
      threads.forEach((t) => {
        unreadMap[t.id] = t._unread || 0;
      });
                window.dispatchEvent(new CustomEvent('threads:hydrate-unread', { detail: { unreadMap } }));
    } catch {
      /* noop */
    }
  }, [threads]);

  useEffect(() => {
    const handleMarkRead = (event) => {
      const threadId = event?.detail?.threadId;
      if (!threadId) return;
      upsertThread({ id: threadId, _unread: 0 });
    };
    const handleMarkUnread = (event) => {
      const threadId = event?.detail?.threadId;
      if (!threadId) return;
      fetchThreads();
    };
    window.addEventListener('chat:mark-read-upto', handleMarkRead);
    window.addEventListener('chat:mark-unread-from', handleMarkUnread);
    return () => {
      window.removeEventListener('chat:mark-read-upto', handleMarkRead);
      window.removeEventListener('chat:mark-unread-from', handleMarkUnread);
    };
  }, [fetchThreads, upsertThread]);

    useEffect(() => {
    if (!authEmail) return undefined;

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/chat`;
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Error)
      .build();

    const handleMessageCreated = (payload) => {
      if (!payload?.threadId) {
        logger.debug('[chat] MessageCreated ignored - no threadId', payload);
        return;
      }
      logger.debug('[chat] MessageCreated received', {
        threadId: payload.threadId,
        messageId: payload.id,
        authorEmail: payload.authorEmail,
        text: payload.text?.substring(0, 50)
      });
      const mapped = mapMessage(payload, selfId, authEmail);
      if (mapped) {
        mergeMessage(payload.threadId, mapped);
        
        // Check if message is from current user
        const isFromSelf = mapped.from === 'self' || 
                          (mapped.authorEmail && normalizeEmail(mapped.authorEmail) === normalizeEmail(authEmail));
        
        // Update thread with latest message info
        const threadUpdate = {
          id: payload.threadId,
          lastMessageAt: mapped.ts,
          lastMessageTs: mapped.ts,
          lastMessageText: mapped.text || '',
          updatedTs: mapped.ts
        };
        
        // Increment unread count if message is not from self
        if (!isFromSelf) {
          const currentThread = threadsRef.current.find(t => t.id === payload.threadId);
          const currentUnread = currentThread?._unread || 0;
          threadUpdate._unread = currentUnread + 1;
        }
        
        upsertThread(threadUpdate);
        logger.debug('[chat] MessageCreated processed - thread updated', {
          threadId: payload.threadId,
          isFromSelf,
          unread: threadUpdate._unread
        });
      }
    };

    const handleMessageUpdated = (payload) => {
      if (!payload?.threadId) return;
      const mapped = mapMessage(payload, selfId, authEmail);
      mergeMessage(payload.threadId, mapped);
    };

    const handleMessageDeleted = (payload) => {
      if (!payload?.threadId || !payload?.messageId) return;
      removeMessage(payload.threadId, payload.messageId);
    };

    const handleThreadUpdated = (payload) => {
      if (!payload?.id) {
        logger.debug('[chat] ThreadUpdated ignored - no id', payload);
        return;
      }
      logger.debug('[chat] ThreadUpdated received', {
        threadId: payload.id,
        title: payload.title,
        participants: payload.participants?.map(p => ({ email: p.email, id: p.id }))
      });
      
      // Check if current user is a participant in this thread
      const participants = Array.isArray(payload.participants) ? payload.participants : [];
      const isParticipant = participants.some((p) => {
        if (!p) return false;
        const participantEmail = normalizeEmail(p.email || '');
        const participantId = String(p.id || '').toLowerCase();
        const normalizedAuthEmail = normalizeEmail(authEmail);
        const normalizedSelfId = String(selfId || '').toLowerCase();
        
        // Check by email (exact match)
        if (participantEmail && normalizedAuthEmail && participantEmail === normalizedAuthEmail) {
          return true;
        }
        
        // Check by participant ID (exact match)
        if (participantId && normalizedSelfId && participantId === normalizedSelfId) {
          return true;
        }
        
        // Check if participant ID contains email (format: "fac:email" or "stu:email")
        if (participantId.includes(':') && normalizedAuthEmail) {
          const emailFromId = participantId.split(':')[1];
          if (emailFromId === normalizedAuthEmail) {
            return true;
          }
        }
        
        return false;
      });
      
      // If user is not a participant, remove the thread from the list
      if (!isParticipant) {
        logger.debug('[chat] ThreadUpdated ignored - user is not a participant', {
          threadId: payload.id,
          authEmail,
          selfId
        });
        removeThread(payload.id);
        return;
      }
      
      const mapped = normalizeThread(payload);
      logger.debug('[chat] ThreadUpdated - normalized thread', {
        threadId: mapped?.id,
        title: mapped?.title,
        hasId: !!mapped?.id,
        mapped
      });
      if (mapped) {
        upsertThread(mapped);
        logger.debug('[chat] ThreadUpdated processed - thread updated', {
          threadId: payload.id,
          title: payload.title
        });
      } else {
        logger.warn('[chat] ThreadUpdated - normalizeThread returned null', payload);
      }
    };

    const handleThreadCleared = (payload) => {
      if (!payload?.threadId) return;
      replaceMessages(payload.threadId, []);
    };

    const handleThreadDeleted = (payload) => {
      if (!payload?.threadId) return;
      removeThread(payload.threadId);
      if (joinedThreadRef.current === payload.threadId) {
        joinedThreadRef.current = null;
      }
    };

    const handleReactions = (payload) => {
      if (!payload?.threadId) return;
      const mapped = mapMessage(payload, selfId, authEmail);
      mergeMessage(payload.threadId, mapped);
    };

    const handleThreadCreated = (payload) => {
      if (!payload?.id) return;
      
      // Check if current user is a participant in this thread
      const participants = Array.isArray(payload.participants) ? payload.participants : [];
      const isParticipant = participants.some((p) => {
        if (!p) return false;
        const participantEmail = normalizeEmail(p.email || '');
        const participantId = String(p.id || '').toLowerCase();
        const normalizedAuthEmail = normalizeEmail(authEmail);
        const normalizedSelfId = String(selfId || '').toLowerCase();
        
        // Check by email (exact match)
        if (participantEmail && normalizedAuthEmail && participantEmail === normalizedAuthEmail) {
          return true;
        }
        
        // Check by participant ID (exact match)
        if (participantId && normalizedSelfId && participantId === normalizedSelfId) {
          return true;
        }
        
        // Check if participant ID contains email (format: "fac:email" or "stu:email")
        if (participantId.includes(':') && normalizedAuthEmail) {
          const emailFromId = participantId.split(':')[1];
          if (emailFromId === normalizedAuthEmail) {
            return true;
          }
        }
        
        return false;
      });
      
      if (!isParticipant) {
        // User is not a participant, ignore this thread
        logger.debug('[chat] ThreadCreated ignored - user is not a participant', {
          threadId: payload.id,
          authEmail,
          selfId,
          participants: participants.map(p => ({ email: p.email, id: p.id }))
        });
        return;
      }
      
      logger.debug('[chat] ThreadCreated received - adding thread', {
        threadId: payload.id,
        title: payload.title,
        authEmail,
        selfId,
        participants: participants.map(p => ({ email: p.email, id: p.id }))
      });
      
      const normalized = normalizeThread(payload);
      logger.debug('[chat] ThreadCreated - normalized thread', {
        threadId: normalized?.id,
        title: normalized?.title,
        hasId: !!normalized?.id,
        normalized
      });
      if (normalized) {
        upsertThread(normalized);
      } else {
        logger.warn('[chat] ThreadCreated - normalizeThread returned null', payload);
      }
    };

    connection.on('MessageCreated', handleMessageCreated);
    connection.on('MessageUpdated', handleMessageUpdated);
    connection.on('MessageDeleted', handleMessageDeleted);
    connection.on('ThreadCreated', handleThreadCreated);
    connection.on('ThreadUpdated', handleThreadUpdated);
    connection.on('ThreadCleared', handleThreadCleared);
    connection.on('ThreadDeleted', handleThreadDeleted);
    connection.on('MessageReactionsUpdated', handleReactions);

    connection.onreconnected(async () => {
      connectionStateRef.current = 'connected';
      let targetGroup = joinedThreadRef.current || queuedThreadIdRef.current;
      if (targetGroup) {
        try {
          await connection.invoke('JoinThread', targetGroup);
          joinedThreadRef.current = targetGroup;
          queuedThreadIdRef.current = null;
        } catch (err) {
          logger.error('[chat] Failed to rejoin SignalR group', err);
        }
      }
    });

    connection.onreconnecting(() => {
      connectionStateRef.current = 'connecting';
    });

    connection.onclose(() => {
      connectionStateRef.current = 'disconnected';
    });

    connectionRef.current = connection;

    connection.start()
      .then(async () => { 
        connectionStateRef.current = 'connected';
        logger.debug('[chat] SignalR connected successfully');
        // Rejoin any queued thread after connection
        if (queuedThreadIdRef.current && connectionRef.current) {
          try {
            const threadId = queuedThreadIdRef.current;
            await connectionRef.current.invoke('JoinThread', threadId);
            joinedThreadRef.current = threadId;
            queuedThreadIdRef.current = null;
          } catch (err) {
            logger.error('[chat] Failed to join queued thread after connection', err);
          }
        }
      })
      .catch((err) => {
        logger.error('[chat] SignalR connection failed', err);
        connectionStateRef.current = 'disconnected';
      });

    return () => {
      connection.stop().catch(() => {});
      connectionRef.current = null;
      joinedThreadRef.current = null;
      connectionStateRef.current = 'disconnected';
      queuedThreadIdRef.current = null;
    };
  }, [authEmail, mergeMessage, removeMessage, removeThread, replaceMessages, selfId, upsertThread]);

  const joinHubGroup = useCallback(async (threadId) => {
    if (!connectionRef.current || !threadId) return;
    const normalizedThreadId = String(threadId);
    if (!normalizedThreadId) return;
    queuedThreadIdRef.current = normalizedThreadId;
    if (connectionStateRef.current !== 'connected') {
      return;
    }

    try {
      if (joinedThreadRef.current && joinedThreadRef.current !== normalizedThreadId) {
        await connectionRef.current.invoke('LeaveThread', joinedThreadRef.current);
      }
      await connectionRef.current.invoke('JoinThread', normalizedThreadId);
      joinedThreadRef.current = normalizedThreadId;
      queuedThreadIdRef.current = null;
    } catch (err) {
      logger.error('[chat] Failed to join SignalR group', err);
    }
  }, []);

  const ensureThreadLoaded = useCallback(async (threadId, options = {}) => {
    const force = !!options.force;
    if (!threadId) return null;
    if (!force && messagesRef.current.has(threadId)) {
      await joinHubGroup(threadId);
      return {
        thread: threadsRef.current.find((t) => t.id === threadId) || null,
        messages: messagesRef.current.get(threadId) || []
      };
    }

    if (!force && inflightThreadFetch.current.has(threadId)) {
      return inflightThreadFetch.current.get(threadId);
    }

    if (force) {
      inflightThreadFetch.current.delete(threadId);
    }

    const promise = (async () => {
      try {
        const detail = await chatApi.getThread(threadId);
        const mappedThread = normalizeThread(detail) || { id: threadId };
        upsertThread(mappedThread);
        const mappedMessages = Array.isArray(detail?.messages)
          ? detail.messages.map((m) => mapMessage(m, selfId, authEmail)).filter(Boolean)
          : [];
        replaceMessages(threadId, mappedMessages);
        await joinHubGroup(threadId);
        return { thread: mappedThread, messages: mappedMessages };
      } catch (error) {
        reportError(error, 'Unable to load chat thread.');
        throw error;
      } finally {
        inflightThreadFetch.current.delete(threadId);
      }
    })();

    inflightThreadFetch.current.set(threadId, promise);
    return promise;
  }, [authEmail, joinHubGroup, replaceMessages, reportError, selfId, upsertThread]);

  const setCurrentUserName = useCallback((name) => {
    setCurrentUser((prev) => ({
      id: prev?.id || selfId,
      name: String(name || defaultName || 'User')
    }));
  }, [defaultName, selfId]);

  const createThread = useCallback(async ({ title = 'New chat', participants = [], inviteAi = false } = {}) => {
    try {
      const payload = {
        title,
        participants: participants
          .filter(Boolean)
          .map((p) => ({
            email: p.email || p.id || '',
            role: p.role,
            name: p.name
          })),
        inviteAi: !!inviteAi
      };
      const created = await chatApi.createThread(payload);
      const mappedThread = normalizeThread(created) || { id: created?.id };
      upsertThread(mappedThread);
      const mappedMessages = Array.isArray(created?.messages)
        ? created.messages.map((m) => mapMessage(m, selfId, authEmail)).filter(Boolean)
        : [];
      replaceMessages(mappedThread.id, mappedMessages);
      return mappedThread;
    } catch (error) {
      const message = reportError(error, 'Unable to start chat.');
      throw new Error(message);
    }
  }, [authEmail, replaceMessages, reportError, selfId, upsertThread]);

  const addMessage = useCallback(async (threadId, payload = {}) => {
    try {
      const request = {
        text: payload.text ?? '',
        replyToId: payload.replyToId ?? null,
        announcement: !!payload.announcement,
        targetAi: !!payload.targetAi,
        attachments: buildAttachmentPayload(payload.attachments)
      };
      const response = await chatApi.sendMessage(threadId, request);
      const mapped = mapMessage(response, selfId, authEmail);
      mergeMessage(threadId, mapped);

      const thread = threadsRef.current.find((t) => t.id === threadId);
      upsertThread({
        id: threadId,
        lastMessageAt: mapped?.ts,
        lastMessageTs: mapped?.ts,
        lastMessageText: mapped?.text || '',
        updatedTs: mapped?.ts,
        _unread: 0
      });

                try {
                    window.dispatchEvent(new CustomEvent('chat:message', {
                        detail: {
                            threadId,
            title: thread?.title || 'Chat',
            message: {
              id: mapped?.id,
              text: mapped?.text || '',
              ts: mapped?.ts,
              from: mapped?.from,
              authorName: mapped?.authorName || ''
            }
                        }
                    }));
      } catch {
        /* ignore */
      }

      if (request.targetAi) {
        await ensureThreadLoaded(threadId);
      }

      return mapped;
    } catch (error) {
      const message = reportError(error, 'Unable to send message.');
      throw new Error(message);
    }
  }, [authEmail, ensureThreadLoaded, mergeMessage, reportError, selfId, upsertThread]);

  const updateMessage = useCallback(async (threadId, messageId, updater) => {
    const existing = (messagesRef.current.get(threadId) || []).find((m) => m.id === messageId);
    if (!existing) return null;
    const updatedFields = typeof updater === 'function' ? updater(existing) : {};
    const text = 'text' in updatedFields ? updatedFields.text : existing.text;
    try {
      const response = await chatApi.updateMessage(threadId, messageId, { text });
      const mapped = mapMessage(response, selfId, authEmail);
      mergeMessage(threadId, mapped);
      return mapped;
    } catch (error) {
      const message = reportError(error, 'Unable to edit message.');
      throw new Error(message);
    }
  }, [authEmail, mergeMessage, reportError, selfId]);

  const deleteMessage = useCallback(async (threadId, messageId) => {
    try {
      await chatApi.deleteMessage(threadId, messageId);
      removeMessage(threadId, messageId);
    } catch (error) {
      const message = reportError(error, 'Unable to delete message.');
      throw new Error(message);
    }
  }, [removeMessage, reportError]);

  const toggleReaction = useCallback(async (threadId, messageId, emoji) => {
    try {
      const response = await chatApi.toggleReaction(threadId, messageId, { emoji });
      const mapped = mapMessage(response, selfId, authEmail);
      mergeMessage(threadId, mapped);
      return mapped;
    } catch (error) {
      const message = reportError(error, 'Unable to update reaction.');
      throw new Error(message);
    }
  }, [authEmail, mergeMessage, reportError, selfId]);

  const markRead = useCallback(async (threadId, ts) => {
    const timestamp = ts || Date.now();
    try {
      await chatApi.markRead(threadId, { ts: timestamp });
      upsertThread({ id: threadId, _unread: 0 });
      try {
        window.dispatchEvent(new CustomEvent('chat:mark-read-upto', { detail: { threadId, ts: timestamp } }));
      } catch {
        /* ignore */
      }
    } catch (error) {
      reportError(error, 'Unable to update read status.');
    }
  }, [reportError, upsertThread]);

  const pinThread = useCallback(async (threadId, pinned) => {
    try {
      await chatApi.pinThread(threadId, { pinned: !!pinned });
      upsertThread({ id: threadId, _pin: !!pinned });
    } catch (error) {
      reportError(error, 'Unable to update pin.');
    }
  }, [reportError, upsertThread]);

  const clearThread = useCallback(async (threadId) => {
    try {
      await chatApi.clearThread(threadId);
      replaceMessages(threadId, []);
      upsertThread({
        id: threadId,
        lastMessageAt: 0,
        lastMessageTs: null,
        lastMessageText: '',
        _unread: 0
      });
    } catch (error) {
      reportError(error, 'Unable to clear conversation.');
    }
  }, [replaceMessages, reportError, upsertThread]);

  const deleteThread = useCallback(async (threadId) => {
    try {
      await chatApi.deleteThread(threadId);
      removeThread(threadId);
    } catch (error) {
      reportError(error, 'Unable to delete chat.');
    }
  }, [removeThread, reportError]);

  const updateThread = useCallback(async (threadId, patch) => {
    try {
      const current = threadsRef.current.find((t) => t.id === threadId);
      if (!current) {
        await ensureThreadLoaded(threadId, { force: true });
        return;
      }
      const ownerEmail = (current.ownerEmail || emailFromId(current.ownerId)).toLowerCase();
      const isOwner = !ownerEmail || ownerEmail === authEmail;
      const canManage = isOwner || isFaculty;

      if (!canManage) {
        await ensureThreadLoaded(threadId);
        reportError(new Error('You do not have permission to modify this conversation.'), 'You do not have permission to modify this conversation.');
        return;
      }

      const existing = dedupeParticipants(current?.participants || []);
      const updates = {};
      let aiPreference = typeof patch?.aiEnabled === 'boolean' ? !!patch.aiEnabled : undefined;
      let participantsChanged = false;

      if (patch?.participants) {
        const desired = dedupeParticipants(patch.participants);
        const desiredNonAi = desired.filter((p) => (p?.role || '').toLowerCase() !== 'ai');
        const desiredEmails = new Set();
        const normalizedDesired = desiredNonAi
          .map((participant) => {
            const email = (participant.email || emailFromId(participant.id)).toLowerCase();
            if (!email) return null;
            desiredEmails.add(email);
            return {
              email,
              role: participant.role,
              name: participant.name,
            };
          })
          .filter(Boolean);

        const existingNonAi = existing.filter((p) => (p?.role || '').toLowerCase() !== 'ai');
        const existingEmails = new Set(existingNonAi.map((p) => (p.email || emailFromId(p.id) || '').toLowerCase()).filter(Boolean));
        const hasAdditions = normalizedDesired.some((entry) => !existingEmails.has(entry.email));
        const removedEmails = Array.from(existingEmails).filter((email) => !desiredEmails.has(email));
        const hasRemovals = removedEmails.length > 0;

        if ((hasAdditions || hasRemovals) && normalizedDesired.length) {
          updates.participants = normalizedDesired;
          participantsChanged = true;
        }

        const existingHasAi = existing.some((p) => (p?.role || '').toLowerCase() === 'ai');
        const desiredHasAi = desired.some((p) => (p?.role || '').toLowerCase() === 'ai');
        if (aiPreference === undefined) {
          if (desiredHasAi) aiPreference = true;
          else if (!desiredHasAi && existingHasAi) aiPreference = false;
        }
      }

      if (typeof patch?.title === 'string' && patch.title.trim() && patch.title !== current.title) {
        updates.title = patch.title;
      }
      if (typeof aiPreference === 'boolean') {
        updates.aiEnabled = aiPreference;
      }
      if (patch?.ownerEmail) {
        updates.ownerEmail = patch.ownerEmail;
      } else if (patch?.ownerId) {
        const newOwnerEmail = emailFromId(patch.ownerId);
        if (newOwnerEmail) updates.ownerEmail = newOwnerEmail;
      }

      if (Object.keys(updates).length === 0) {
        if (participantsChanged) {
          await ensureThreadLoaded(threadId, { force: true });
        }
        return;
      }

      const response = await chatApi.updateThread(threadId, updates);
      if (response && typeof response === 'object') {
        const mapped = normalizeThread(response);
        if (mapped) upsertThread(mapped);
      } else {
        await ensureThreadLoaded(threadId, { force: true });
      }
    } catch (error) {
      reportError(error, 'Unable to update chat.');
    }
  }, [authEmail, ensureThreadLoaded, isFaculty, reportError, upsertThread]);

    return useMemo(() => ({
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
    }), [
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
  ]);
}

