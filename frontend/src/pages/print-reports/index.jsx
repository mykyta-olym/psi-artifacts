// src/pages/print-reports/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Icon from '../../components/AppIcon';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import PageFooter from '../../components/ui/PageFooter';
import SectionCard from './components/SectionCard';
import ModalBase from '../../components/ui/ModalBase';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { useAuth } from '../../contexts/AuthContext';
import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import useUserPreference from '../../hooks/useUserPreference';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { formatLastLogin } from '../../utils/datetime';
import useDataUpdates from '../../hooks/useDataUpdates';
import {
    assignDocumentsToFaculty,
    assignDocumentsToStudents,
    fetchDocumentById,
    fetchFaculty,
    fetchMyDocuments,
    fetchStudents,
    generateTeacherProfileDocument,
    renderPrintDocument
} from '../../data/maisApiAdapter';
import { defaultForm } from './utils/reportUtils';

const CUSTOM_TEMPLATE_KEY = 'custom_teacher';
const MIN_SEARCH_LENGTH = 2;
const deliveryOptions = [
    { value: 'manual', label: 'Manual selection' },
    { value: 'all_active', label: 'Broadcast to all active students' }
];
const scopeOptions = [
    {
        value: 'students',
        label: 'Students',
        helper: 'Registry search by name, ID, email',
        icon: 'User'
    },
    {
        value: 'faculty',
        label: 'Faculty',
        helper: 'Staff directory with department context',
        icon: 'UserCheck'
    }
];
const systemTemplateLibrary = [
    {
        key: 'confirm',
        label: 'Confirmation of study',
        description: 'Official confirmation for general requests.',
        source: 'system'
    },
    {
        key: 'confirm_upsvar',
        label: 'Labour office confirmation',
        description: 'ÚPSVaR ready certificate with required wording.',
        source: 'system'
    }
];
const placeholderHints = [
    { token: '{{fullName}}', label: 'Student full name' },
    { token: '{{program}}', label: 'Study program' },
    { token: '{{year}}', label: 'Study year' },
    { token: '{{faculty}}', label: 'Faculty name' },
    { token: '{{currentDate}}', label: 'Current date' }
];
const initialCustomHtml = `
<div class="doc" style="font-family: 'Inter', system-ui; padding: 32px; color: #111827;">
    <header style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 18px;">
        <h1 style="margin: 0; font-size: 20px;">{{faculty}} • Automated notice</h1>
        <p style="margin: 4px 0 0; color: #6b7280;">Issued {{currentDate}}</p>
    </header>
    <p>Hello {{fullName}},</p>
    <p>
        This is a personalized update regarding your study program <strong>{{program}}</strong> (year {{year}}).
        Replace this paragraph with any HTML content. All placeholder tokens will be substituted during delivery.
    </p>
    <p>Kind regards,<br />{{faculty}}</p>
</div>
`;

const openHtmlPreview = (html, guardedNotify) => {
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html || '<p>No content</p>');
        win.document.close();
    } else {
        guardedNotify?.('doc-view', 'info', 'Popup blocked – allow popups to view documents');
    }
};

const buildTeacherProfileHtml = (profile = {}, fallbackUser = {}) => {
    const name = profile.full_name || fallbackUser.full_name || fallbackUser.email || 'Teacher';
    const email = fallbackUser.email || profile.email || '—';
    const faculty = profile.faculty || '—';
    const phone = profile.phone || '—';
    const office = profile.office || '—';
    const dept = profile.department || faculty || 'Faculty';
    const certifications = Array.isArray(profile.certifications) ? profile.certifications : [];
    const workingHours = profile.workingHours && typeof profile.workingHours === 'object'
        ? Object.entries(profile.workingHours)
        : [];
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${name} • Profile summary</title>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#f8fafc;margin:0;padding:32px;color:#0f172a}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;max-width:960px;margin:0 auto;box-shadow:0 10px 30px rgba(15,23,42,0.08)}
    h1{margin:0 0 4px;font-size:26px}
    .muted{color:#64748b;font-size:14px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:24px}
    .tile{border:1px dashed #e2e8f0;border-radius:12px;padding:16px}
    .tile h3{margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8}
    ul{margin:0;padding-left:18px;color:#334155}
    li{margin-bottom:6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>${name}</h1>
    <p class="muted">${dept}</p>
    <div class="grid">
      <div class="tile"><h3>Contact</h3><p>Email: ${email}<br/>Phone: ${phone}<br/>Office: ${office}</p></div>
      <div class="tile"><h3>Faculty</h3><p>${faculty}</p></div>
      <div class="tile"><h3>Availability</h3>
        ${workingHours.length ? `<ul>${workingHours.map(([day, value]) => `<li>${day}: ${value}</li>`).join('')}</ul>` : '<p>Not specified</p>'}
      </div>
      <div class="tile"><h3>Certifications</h3>
        ${certifications.length ? `<ul>${certifications.map((item) => `<li>${item}</li>`).join('')}</ul>` : '<p>No certifications on record.</p>'}
      </div>
    </div>
  </div>
</body>
</html>
`;
};

const formatTimestamp = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const preferenceKeyForLibrary = (email) => (email ? `printReports.library.${email.toLowerCase()}` : '');

const useGuardedNotify = () => {
    const { notify } = useToasts();
    const locksRef = useRef(new Map());

    return useCallback((key, type, message, options = {}) => {
        const lockKey = key || type || 'default';
        const lockMs = Number(options.lockMs) || 0;
        if (lockMs > 0) {
            const last = locksRef.current.get(lockKey) || 0;
            const now = Date.now();
            if (now - last < lockMs) return;
            locksRef.current.set(lockKey, now);
        }
        const { lockMs: _omit, ...rest } = options;
        notify(type, message, rest);
    }, [notify]);
};

const useTemplateLibrary = (userEmail, guardedNotify) => {
    const preferenceKey = preferenceKeyForLibrary(userEmail);
    const preference = useUserPreference(preferenceKey, { items: [] });

    const storedTemplates = useMemo(() => {
        const items = Array.isArray(preference.value?.items) ? preference.value.items : [];
        return items
            .filter((tpl) => tpl?.key && tpl?.label)
            .map((tpl) => ({ ...tpl, source: 'custom' }));
    }, [preference.value]);

    const templateLibrary = useMemo(() => [...systemTemplateLibrary, ...storedTemplates], [storedTemplates]);

    const saveTemplate = useCallback(async (template) => {
        const trimmed = {
            key: template?.key?.trim(),
            label: template?.label?.trim(),
            description: template?.description?.trim() || '',
            source: 'custom'
        };
        if (!trimmed.key || !trimmed.label) {
            guardedNotify('library-validate', 'error', 'Template title and key are required');
            return;
        }
        const keysToDrop = new Set([trimmed.key]);
        const next = [...storedTemplates.filter((tpl) => !keysToDrop.has(tpl.key)), trimmed];
        await preference.setValue({ items: next });
        guardedNotify(trimmed.key, 'success', template?.key ? 'Template updated' : 'Template saved to your library');
    }, [storedTemplates, preference, guardedNotify]);

    const removeTemplate = useCallback(async (key) => {
        const next = storedTemplates.filter((tpl) => tpl.key !== key);
        await preference.setValue({ items: next });
        guardedNotify('library-remove', 'success', 'Template removed from library');
    }, [storedTemplates, preference, guardedNotify]);

    return {
        templateLibrary,
        storedTemplates,
        saveTemplate,
        removeTemplate,
        preferenceLoading: preference.loading
    };
};

const RecipientTargetingSection = ({
    targetMode,
    onTargetModeChange,
    recipientScope,
    onRecipientScopeChange,
    searchQuery,
    onSearchQueryChange,
    searchResults,
    searchLoading,
    selectedRecipients,
    onSelectRecipient,
    onRemoveRecipient,
    onClearSelected
}) => {
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const trimmedQuery = searchQuery.trim();
    const dropdownVisible = targetMode !== 'all_active' && (trimmedQuery.length >= MIN_SEARCH_LENGTH || searchLoading);
    const isSearchDisabled = targetMode === 'all_active' && recipientScope === 'students';
    const loadingCopy = recipientScope === 'faculty' ? 'Searching faculty…' : 'Searching students…';
    const emptyCopy = recipientScope === 'faculty'
        ? 'No faculty match this query.'
        : 'No students match this query.';
    const placeholder = recipientScope === 'faculty'
        ? 'Search faculty by name, department, email…'
        : 'Search students by name, ID, email…';

    const selectionCounts = useMemo(() => selectedRecipients.reduce((acc, item) => {
        if (item.type === 'faculty') acc.faculty += 1;
        else acc.students += 1;
        return acc;
    }, { students: 0, faculty: 0 }), [selectedRecipients]);

    useEffect(() => {
        setHighlightIndex(-1);
    }, [searchResults.length, recipientScope]);

    const handlePick = useCallback((record) => {
        onSelectRecipient(record);
        setHighlightIndex(-1);
    }, [onSelectRecipient]);

    const handleKeyDown = (event) => {
        if (!searchResults.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightIndex((idx) => Math.min(searchResults.length - 1, idx + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightIndex((idx) => Math.max(0, idx - 1));
        } else if (event.key === 'Enter') {
            if (highlightIndex >= 0 && highlightIndex < searchResults.length) {
                event.preventDefault();
                handlePick(searchResults[highlightIndex]);
            }
        }
    };

    return (
        <SectionCard
            title="Recipients & delivery"
            description="Choose delivery mode, toggle audience scope, and queue recipients."
            iconName="Target"
        >
            <div className="space-y-4">
                <Select
                    label="Delivery mode"
                    value={targetMode}
                    onChange={onTargetModeChange}
                    options={deliveryOptions}
                />
                <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Recipient scope</div>
                    <div className="grid grid-cols-2 gap-2">
                        {scopeOptions.map((option) => {
                            const active = recipientScope === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onRecipientScopeChange(option.value)}
                                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${active ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-border bg-background text-muted-foreground hover:border-border/80'}`}
                                >
                                    <Icon name={option.icon} size={16} className={active ? 'text-primary' : 'text-muted-foreground'} />
                                    <div className="text-xs">
                                        <div className="font-semibold text-sm text-foreground">{option.label}</div>
                                        <div className="text-[11px] text-muted-foreground">{option.helper}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="relative">
                    <Input
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        disabled={isSearchDisabled}
                        onKeyDown={handleKeyDown}
                        leadingIcon="Search"
                    />
                    <div className="text-[11px] text-muted-foreground mt-1">
                        {isSearchDisabled
                            ? 'Broadcast delivers to every active student automatically. Switch scope or mode to search individuals.'
                            : 'Type at least two characters to search the selected audience.'}
                    </div>
                    {dropdownVisible && (
                        <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
                            {searchLoading ? (
                                <div className="px-4 py-3 text-sm text-muted-foreground">{loadingCopy}</div>
                            ) : searchResults.length > 0 ? (
                                <ul className="max-h-64 overflow-y-auto">
                                    {searchResults.map((entry, index) => {
                                        const active = index === highlightIndex;
                                        return (
                                            <li key={`${entry.type}-${entry.id}`}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => handlePick(entry)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition ${active ? 'bg-muted' : 'hover:bg-muted/70'}`}
                                                >
                                                    <Icon name={entry.type === 'faculty' ? 'UserCheck' : 'User'} size={16} className="text-muted-foreground" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{entry.label}</div>
                                                        <div className="text-xs text-muted-foreground truncate">{entry.program || (entry.type === 'faculty' ? 'Faculty member' : 'Program not set')}</div>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="px-4 py-3 text-sm text-muted-foreground">{emptyCopy}</div>
                            )}
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {selectedRecipients.length === 0
                                ? 'No recipients queued yet.'
                                : `Queued: ${selectionCounts.students} students • ${selectionCounts.faculty} faculty`}
                        </span>
                        {selectedRecipients.length > 0 && (
                            <Button size="xs" variant="ghost" onClick={onClearSelected}>
                                Clear all
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                        {selectedRecipients.length === 0 && (
                            <div className="text-xs text-muted-foreground">Search above to queue recipients.</div>
                        )}
                        {selectedRecipients.map((recipient) => (
                            <div
                                key={`${recipient.type}-${recipient.id}`}
                                className={`px-3 py-2 rounded-md border text-xs flex items-center gap-2 ${recipient.type === 'faculty' ? 'border-primary/40 bg-primary/5' : 'border-muted/70 bg-muted/40'}`}
                            >
                                <div>
                                    <div className="font-semibold text-sm">{recipient.label}</div>
                                    <div className="text-muted-foreground">{recipient.type === 'faculty' ? 'Faculty member' : recipient.program || 'Student'}</div>
                                </div>
                                <Button size="xs" variant="ghost" onClick={() => onRemoveRecipient(recipient.id, recipient.type)}>
                                    Remove
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                    {targetMode === 'all_active'
                        ? 'Broadcast sends a personalized copy to every active student automatically. Manually selected faculty still receive their copies via Docs & guidance.'
                        : 'Manual mode renders previews with the first selected student. Faculty see the HTML exactly as composed.'}
                </div>
            </div>
        </SectionCard>
    );
};

const useRecipientTargeting = (guardedNotify) => {
        const [targetMode, setTargetMode] = useState('manual');
        const [recipientScope, setRecipientScope] = useState('students');
        const [searchQuery, setSearchQuery] = useState('');
        const [searchResults, setSearchResults] = useState([]);
        const [searchLoading, setSearchLoading] = useState(false);
        const [selectedRecipients, setSelectedRecipients] = useState([]);

        const selectedStudents = useMemo(() => selectedRecipients.filter((item) => item.type === 'student'), [selectedRecipients]);
        const selectedFaculty = useMemo(() => selectedRecipients.filter((item) => item.type === 'faculty'), [selectedRecipients]);
        const selectedContextStudent = selectedStudents[0] || null;

        useEffect(() => {
            const trimmed = searchQuery.trim();
            if (targetMode === 'all_active' && recipientScope === 'students') {
                setSearchResults([]);
                setSearchLoading(false);
                return;
            }
            if (!trimmed || trimmed.length < 2) {
                setSearchResults([]);
                setSearchLoading(false);
                return;
            }
            let cancelled = false;
            setSearchLoading(true);
            const handle = setTimeout(async () => {
                try {
                    const fetcher = recipientScope === 'students'
                        ? () => fetchStudents({ q: trimmed, pageSize: 8 })
                        : () => fetchFaculty({ q: trimmed, pageSize: 8 });
                    const res = await fetcher();
                    if (!cancelled) {
                        const normalized = (Array.isArray(res) ? res.slice(0, 8) : []).map((entry) => {
                            if (recipientScope === 'students') {
                                const label = entry.fullName || entry.name || [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.email || entry.id;
                                return {
                                    id: entry.id,
                                    label,
                                    program: entry.program || '',
                                    email: entry.email || '',
                                    type: 'student',
                                    raw: entry
                                };
                            }
                            const label = entry.fullName || entry.displayName || [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.email || entry.id;
                            return {
                                id: entry.id || entry.personId || entry.email,
                                label,
                                program: entry.departments?.[0] || entry.faculty || 'Faculty member',
                                email: entry.email || '',
                                type: 'faculty',
                                raw: entry
                            };
                        }).filter((item) => item.id);
                        setSearchResults(normalized);
                    }
                } catch {
                    if (!cancelled) setSearchResults([]);
                } finally {
                    if (!cancelled) setSearchLoading(false);
                }
            }, 220);
            return () => {
                cancelled = true;
                clearTimeout(handle);
            };
        }, [searchQuery, recipientScope, targetMode]);

        const handleSelectRecipient = useCallback((recipient) => {
            if (!recipient?.id) {
                guardedNotify('recipient-select', 'danger', 'Record is missing an id');
                return;
            }
            setSelectedRecipients((prev) => {
                if (prev.some((item) => item.id === recipient.id && item.type === recipient.type)) return prev;
                return [...prev, recipient].slice(0, 40);
            });
            setSearchQuery('');
            setSearchResults([]);
            guardedNotify('recipient-select', 'success', `${recipient.type === 'faculty' ? 'Faculty member' : 'Student'} added to selection`, { lockMs: 1400 });
        }, [guardedNotify]);

        const handleRemoveRecipient = useCallback((id, type) => {
            setSelectedRecipients((prev) => prev.filter((recipient) => !(recipient.id === id && recipient.type === type)));
        }, []);

        const clearSelectedRecipients = useCallback(() => {
            setSelectedRecipients([]);
        }, []);

        return {
            targetMode,
            setTargetMode,
            recipientScope,
            setRecipientScope,
            searchQuery,
            setSearchQuery,
            searchResults,
            searchLoading,
            selectedRecipients,
            selectedStudents,
            selectedFaculty,
            selectedContextStudent,
            handleSelectRecipient,
            handleRemoveRecipient,
            clearSelectedRecipients
        };
};

const useDocumentHistory = (userEmail, guardedNotify, ownerName, profile) => {
        const [remoteDocuments, setRemoteDocuments] = useState([]);
        const [documentsLoading, setDocumentsLoading] = useState(false);
        const [viewingDocId, setViewingDocId] = useState('');
        const [profileLoading, setProfileLoading] = useState(false);

        useEffect(() => {
            if (!userEmail) setRemoteDocuments([]);
        }, [userEmail]);

        const recordLocalDocument = useCallback((recordInput) => {
            // No-op: local documents не зберігаються, все йде в БД
            return null;
        }, []);

        const loadDocuments = useCallback(async () => {
            if (!userEmail) return;
            setDocumentsLoading(true);
            try {
                const res = await fetchMyDocuments({ includeHtml: false });
                setRemoteDocuments(Array.isArray(res) ? res : []);
            } catch {
                guardedNotify('docs-load', 'danger', 'Failed to load document history');
            } finally {
                setDocumentsLoading(false);
            }
        }, [userEmail, guardedNotify]);

        useEffect(() => {
            loadDocuments();
        }, [loadDocuments]);

        // Listen for data updates via SignalR
        const handleDataUpdate = useCallback((payload) => {
            if (!payload || !payload.type) return;
            
            // Refresh documents on document-related updates
            if (payload.type === 'document.updated' || payload.type === 'document.created') {
                console.log('[PrintReports] Document update received via SignalR:', payload);
                loadDocuments();
            }
        }, [loadDocuments]);

        useDataUpdates(handleDataUpdate);

        const openDocument = useCallback(async (doc) => {
            if (!doc?.id) return;
            setViewingDocId(doc.id);
            try {
                const res = await fetchDocumentById(doc.id);
                const html = res?.html || '';
                if (!html) {
                    guardedNotify('doc-view', 'danger', 'Document payload unavailable');
                    return;
                }
                openHtmlPreview(html, guardedNotify);
            } catch (e) {
                guardedNotify('doc-view', 'danger', e?.message || 'Failed to open document');
            } finally {
                setViewingDocId('');
            }
        }, [guardedNotify]);

        const combinedDocuments = useMemo(() => {
            return (remoteDocuments || []).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }, [remoteDocuments]);

        const generateProfileReport = useCallback(async () => {
            if (!userEmail) {
                guardedNotify('profile-doc', 'warning', 'Sign in to generate profile report');
                return;
            }
            setProfileLoading(true);
            try {
                await generateTeacherProfileDocument();
                guardedNotify('profile-doc', 'success', 'Profile report generated and saved');
                await loadDocuments();
                // Відкрити останній документ
                const res = await fetchMyDocuments({ includeHtml: false });
                const latest = Array.isArray(res) && res.length > 0 ? res[0] : null;
                if (latest) {
                    await openDocument(latest);
                }
            } catch (e) {
                guardedNotify('profile-doc', 'danger', e?.message || 'Failed to generate profile report');
            } finally {
                setProfileLoading(false);
            }
        }, [guardedNotify, loadDocuments, userEmail, openDocument]);

        return {
            documents: combinedDocuments,
            documentsLoading,
            viewingDocId,
            openDocument,
            loadDocuments,
            profileLoading,
            generateProfileReport,
            recordLocalDocument
        };
};

const useCustomComposer = ({
        baseForm,
        selectedContextStudent,
        targetMode,
    selectedStudents,
    selectedFaculty,
        guardedNotify,
        onAfterAssign,
        onRecordDocument,
        ownerName,
        enabled = true
}) => {
        const [customTitle, setCustomTitle] = useState('Student update');
        const [customHtml, setCustomHtml] = useState(initialCustomHtml);
        const [customPreviewHtml, setCustomPreviewHtml] = useState('');
        const [customPreviewLoading, setCustomPreviewLoading] = useState(false);
        const [customPreviewError, setCustomPreviewError] = useState('');
        const customPreviewRequest = useRef(0);
        const [assigning, setAssigning] = useState(false);
        const fileInputRef = useRef(null);

        const hasCustomPayload = customTitle.trim().length > 0 && customHtml.trim().length > 0;

        const requestCustomPreview = useCallback(async () => {
            if (!enabled) return;
            if (!customHtml.trim()) {
                setCustomPreviewHtml('');
                setCustomPreviewError('Add HTML content to render a preview.');
                return;
            }
            const reqId = ++customPreviewRequest.current;
            setCustomPreviewLoading(true);
            setCustomPreviewError('');
            try {
                const res = await renderPrintDocument({
                    template: CUSTOM_TEMPLATE_KEY,
                    form: baseForm,
                    studentId: selectedContextStudent?.id,
                    customHtml,
                    customTitle
                });
                if (customPreviewRequest.current === reqId) {
                    setCustomPreviewHtml(res?.html || '');
                }
            } catch (e) {
                if (customPreviewRequest.current === reqId) {
                    setCustomPreviewHtml('');
                    setCustomPreviewError(e?.message || 'Unable to render preview');
                }
            } finally {
                if (customPreviewRequest.current === reqId) {
                    setCustomPreviewLoading(false);
                }
            }
        }, [baseForm, customHtml, customTitle, selectedContextStudent?.id, enabled]);

        useEffect(() => {
            if (!enabled) {
                setCustomPreviewHtml('');
                setCustomPreviewError('');
                setCustomPreviewLoading(false);
                return;
            }
            if (!customHtml.trim()) {
                setCustomPreviewHtml('');
                setCustomPreviewError('Add HTML content to render a preview.');
                setCustomPreviewLoading(false);
                return;
            }
            const handle = setTimeout(() => {
                requestCustomPreview();
            }, 250);
            return () => clearTimeout(handle);
        }, [customHtml, customTitle, selectedContextStudent?.id, requestCustomPreview, enabled]);

        const validateCustomTemplate = useCallback(() => {
            if (!enabled) return false;
            if (!customTitle.trim()) {
                guardedNotify('custom-template', 'danger', 'Provide a template title');
                return false;
            }
            if (!customHtml.trim()) {
                guardedNotify('custom-template', 'danger', 'Provide HTML content');
                return false;
            }
            if (targetMode !== 'all_active' && selectedStudents.length === 0 && selectedFaculty.length === 0) {
                guardedNotify('custom-template', 'danger', 'Select at least one recipient');
                return false;
            }
            return true;
        }, [customTitle, customHtml, targetMode, selectedStudents.length, selectedFaculty.length, guardedNotify, enabled]);

        const buildStudentAssignmentPayload = useCallback(() => {
            const payload = {
                template: CUSTOM_TEMPLATE_KEY,
                form: baseForm,
                customHtml,
                customTitle,
                includeArchived: false
            };
            if (targetMode === 'all_active') {
                payload.applyToAllActive = true;
            } else {
                payload.studentIds = selectedStudents.map((student) => student.id);
            }
            return payload;
        }, [baseForm, customHtml, customTitle, targetMode, selectedStudents]);

        const buildFacultyAssignmentPayload = useCallback(() => ({
            template: CUSTOM_TEMPLATE_KEY,
            form: baseForm,
            customHtml,
            customTitle,
            facultyIds: selectedFaculty.map((recipient) => recipient.id)
        }), [baseForm, customHtml, customTitle, selectedFaculty]);

        const handleSendCustom = useCallback(async () => {
            if (!enabled) return;
            if (!validateCustomTemplate()) return;
            setAssigning(true);
            try {
                const promises = [];
                if (targetMode === 'all_active' || selectedStudents.length > 0) {
                    promises.push(assignDocumentsToStudents(buildStudentAssignmentPayload()));
                }
                if (selectedFaculty.length > 0) {
                    promises.push(assignDocumentsToFaculty(buildFacultyAssignmentPayload()));
                }
                await Promise.all(promises);
                const message = targetMode === 'all_active'
                    ? selectedFaculty.length > 0 ? 'Broadcast queued for all students and selected faculty' : 'Custom document queued for all active students'
                    : 'Custom document sent to selected recipients';
                guardedNotify('assign', 'success', message);
                if (onRecordDocument) {
                    onRecordDocument({
                        title: customTitle,
                        templateKey: CUSTOM_TEMPLATE_KEY,
                        html: customPreviewHtml || customHtml,
                        ownerName,
                        studentContext: selectedContextStudent,
                        kind: 'custom'
                    });
                }
                await onAfterAssign?.();
            } catch (e) {
                guardedNotify('assign', 'danger', e?.message || 'Failed to assign document');
            } finally {
                setAssigning(false);
            }
        }, [validateCustomTemplate, buildStudentAssignmentPayload, buildFacultyAssignmentPayload, guardedNotify, targetMode, selectedStudents.length, selectedFaculty.length, onAfterAssign, onRecordDocument, customTitle, customPreviewHtml, customHtml, ownerName, selectedContextStudent, enabled]);

        const handleTemplateUpload = useCallback(async (event) => {
            if (!enabled) return;
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                setCustomHtml(text);
                guardedNotify('upload-template', 'success', `Loaded HTML from ${file.name}`);
            } catch (e) {
                guardedNotify('upload-template', 'danger', e?.message || 'Failed to read file');
            } finally {
                event.target.value = '';
            }
        }, [guardedNotify, enabled]);

        const handleResetTemplate = useCallback(() => {
            if (!enabled) return;
            setCustomTitle('Student update');
            setCustomHtml(initialCustomHtml);
            guardedNotify('reset-template', 'info', 'Custom template reset');
        }, [guardedNotify, enabled]);

        return {
            customTitle,
            setCustomTitle,
            customHtml,
            setCustomHtml,
            customPreviewHtml,
            customPreviewLoading,
            customPreviewError,
            requestCustomPreview,
            assigning,
            hasCustomPayload,
            handleSendCustom,
            handleTemplateUpload,
            handleResetTemplate,
            fileInputRef
        };
};

const PrintReportsInner = () => {
        const { user, userProfile } = useAuth() || {};
        const role = (user?.role || 'teacher').toLowerCase();
    const isTeacher = role === 'teacher';
    const isStudent = role === 'student';
        const userName = useProfileDisplayName(userProfile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User');
        const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);
        const { isBlocked } = useGlobalLoaderBlocking();
        const navigate = useNavigate();
        const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
        const [templateModalOpen, setTemplateModalOpen] = useState(false);
        const [editingTemplate, setEditingTemplate] = useState(null);
        const [previewingTemplate, setPreviewingTemplate] = useState('');

        // Отримати studentId з обраного study для студентів
        const selectedStudy = useSelectedStudyValue();
        const currentStudentId = useMemo(() => {
            if (!isStudent) return null;
            
            // Спробувати отримати studentId з різних джерел
            const fromStudy = selectedStudy?.value?.studentId;
            const fromStudyPersonId = selectedStudy?.value?.personId;
            const fromProfile = userProfile?.studentId || userProfile?.student?.studentId;
            const fromProfilePersonId = userProfile?.personId;
            const fromProfileId = userProfile?.id;
            
            // Якщо studentId схожий на email, не використовувати
            const isEmail = (val) => val && String(val).includes('@');
            
            // Пріоритет: study.personId > study.studentId > profile.personId > profile.studentId > profile.id
            if (fromStudyPersonId && !isEmail(fromStudyPersonId)) return String(fromStudyPersonId).trim();
            if (fromStudy && !isEmail(fromStudy)) return String(fromStudy).trim();
            if (fromProfilePersonId && !isEmail(fromProfilePersonId)) return String(fromProfilePersonId).trim();
            if (fromProfile && !isEmail(fromProfile)) return String(fromProfile).trim();
            if (fromProfileId && !isEmail(fromProfileId)) return String(fromProfileId).trim();
            
            // Якщо нічого не знайдено - повернути null
            // Фільтр все одно спрацює по email якщо в документі є studentEmail
            return null;
        }, [isStudent, selectedStudy?.value?.studentId, selectedStudy?.value?.personId, userProfile]);

        const guardedNotify = useGuardedNotify();
        const baseForm = useMemo(() => defaultForm(userProfile, user, null), [userProfile, user]);

        // Debug: логування selectedStudy для діагностики
        useEffect(() => {
            if (isStudent && selectedStudy?.value) {
                console.log('[Print Reports] selectedStudy.value:', selectedStudy.value);
                console.log('[Print Reports] userProfile:', userProfile);
            }
        }, [isStudent, selectedStudy?.value, userProfile]);

        const {
            templateLibrary,
            saveTemplate,
            removeTemplate,
            preferenceLoading
        } = useTemplateLibrary(user?.email, guardedNotify);

        const {
            targetMode,
            setTargetMode,
            recipientScope,
            setRecipientScope,
            searchQuery,
            setSearchQuery,
            searchResults,
            searchLoading,
            selectedRecipients,
            selectedStudents,
            selectedFaculty,
            selectedContextStudent,
            handleSelectRecipient,
            handleRemoveRecipient,
            clearSelectedRecipients
        } = useRecipientTargeting(guardedNotify);

        const {
            documents,
            documentsLoading,
            viewingDocId,
            openDocument,
            loadDocuments,
            profileLoading,
            generateProfileReport,
            recordLocalDocument
        } = useDocumentHistory(user?.email, guardedNotify, userName, userProfile);

        const {
            customTitle,
            setCustomTitle,
            customHtml,
            setCustomHtml,
            customPreviewHtml,
            customPreviewLoading,
            customPreviewError,
            requestCustomPreview,
            assigning,
            hasCustomPayload,
            handleSendCustom,
            handleTemplateUpload,
            handleResetTemplate,
            fileInputRef
        } = useCustomComposer({
            baseForm,
            selectedContextStudent,
            targetMode,
            selectedStudents,
            selectedFaculty,
            guardedNotify,
            onAfterAssign: loadDocuments,
            onRecordDocument: recordLocalDocument,
            ownerName: userName,
            enabled: !isStudent
        });

        const sideOffset = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

        const openTemplateModal = useCallback((template = null) => {
            setEditingTemplate(template || null);
            setTemplateModalOpen(true);
        }, []);

        const closeTemplateModal = useCallback(() => {
            setTemplateModalOpen(false);
            setEditingTemplate(null);
        }, []);

        const handleTemplateSubmit = useCallback(async (draft) => {
            await saveTemplate(draft, { originalKey: editingTemplate?.source === 'custom' ? editingTemplate.key : undefined });
            closeTemplateModal();
        }, [saveTemplate, editingTemplate, closeTemplateModal]);

        const handlePreviewTemplate = useCallback(async (templateKey) => {
            setPreviewingTemplate(templateKey);
            try {
                const res = await renderPrintDocument({ template: templateKey, form: baseForm, studentId: selectedContextStudent?.id });
                if (res?.html) {
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(res.html);
                        win.document.close();
                    } else {
                        guardedNotify('preview-template', 'info', 'Allow popups to view previews');
                    }
                }
            } catch (e) {
                guardedNotify('preview-template', 'danger', e?.message || 'Failed to render template preview');
            } finally {
                setPreviewingTemplate('');
            }
        }, [baseForm, guardedNotify, selectedContextStudent?.id]);

        return (
            <div className="min-h-screen bg-background overflow-x-hidden">
                <Header userRole={role} userName={userName} onLogout={() => navigate('/')} />
                <RoleSidebar userRole={role} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
                <div className={`${sideOffset} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
                    <main className="flex-1">
                        <div className="px-6 pt-3 pb-6">
                            <NavigationBreadcrumb />
                            <Reveal variant="keycap" waitForLoaders={true} as={motion.section} className="space-y-5" delay={ANIMATION_DELAYS.HERO}>
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0">
                                    <h1 className="text-2xl font-bold text-foreground truncate">Print Reports</h1>
                                    <p className="text-sm text-muted-foreground">Orchestrate auto-delivered templates, craft custom notices, and keep every document in sync.</p>
                                    </div>
                                </div>
                            </Reveal>

                            <Reveal variant="keycap" waitForLoaders={true} as={motion.section} className={`grid grid-cols-1 ${isStudent ? '' : 'xl:grid-cols-3'} gap-6 mt-6`} delay={ANIMATION_DELAYS.SUBTITLE}>
                                <div className={`${isStudent ? '' : 'xl:col-span-2'} space-y-6`}>
                                    {!isStudent ? (
                                        <>
                                            <TemplateLibrarySection
                                                templates={templateLibrary}
                                                loading={preferenceLoading}
                                                onAddClick={() => openTemplateModal(null)}
                                                onPreview={handlePreviewTemplate}
                                                onRemove={removeTemplate}
                                                onEdit={openTemplateModal}
                                                previewingTemplate={previewingTemplate}
                                            />

                                            <CustomComposerSection
                                                customTitle={customTitle}
                                                onCustomTitleChange={setCustomTitle}
                                                customHtml={customHtml}
                                                onCustomHtmlChange={setCustomHtml}
                                                placeholderHints={placeholderHints}
                                                onRequestPreview={requestCustomPreview}
                                                previewHtml={customPreviewHtml}
                                                previewLoading={customPreviewLoading}
                                                previewError={customPreviewError}
                                                fileInputRef={fileInputRef}
                                                onUploadTemplate={handleTemplateUpload}
                                                onResetTemplate={handleResetTemplate}
                                                onSend={handleSendCustom}
                                                assigning={assigning}
                                                hasPayload={hasCustomPayload}
                                                targetMode={targetMode}
                                                selectedStudentsCount={selectedStudents.length}
                                                selectedFacultyCount={selectedFaculty.length}
                                                selectedRecipientsCount={selectedRecipients.length}
                                                onSaveMetadata={() => openTemplateModal(null)}
                                            />
                                        </>
                                    ) : (
                                        <StudentAccessNotice 
                                            onRefreshHistory={loadDocuments}
                                            documents={documents.filter((doc) => {
                                                const docStudentId = doc?.studentId;
                                                const docStudentEmail = doc?.studentEmail;
                                                if (doc?.ownerRole === 'teacher' && !docStudentId && !docStudentEmail) return false;
                                                if (docStudentId || docStudentEmail) {
                                                    if (docStudentEmail && user?.email) {
                                                        if (String(docStudentEmail).toLowerCase().trim() === String(user.email).toLowerCase().trim()) return true;
                                                    }
                                                    if (docStudentId && currentStudentId) {
                                                        const normalizeId = (id) => String(id || '').trim().replace(/-(bc|ing|mgr|phd)(-d)?(-sk)?$/i, '');
                                                        const docId = String(docStudentId).trim();
                                                        const currId = String(currentStudentId).trim();
                                                        if (normalizeId(docId) === normalizeId(currId)) return true;
                                                        if (docId === currId) return true;
                                                        if (docId.startsWith(currId + '-') || currId.startsWith(docId + '-')) return true;
                                                    }
                                                    return false;
                                                }
                                                return true;
                                            })}
                                            loading={documentsLoading}
                                            onOpenDocument={openDocument}
                                            viewingDocId={viewingDocId}
                                        />
                                    )}
                                </div>

                                <div className="xl:col-span-1 space-y-6">
                                    {!isStudent && (
                                        <>
                                            <RecipientTargetingSection
                                                targetMode={targetMode}
                                                onTargetModeChange={setTargetMode}
                                                recipientScope={recipientScope}
                                                onRecipientScopeChange={setRecipientScope}
                                                searchQuery={searchQuery}
                                                onSearchQueryChange={setSearchQuery}
                                                searchResults={searchResults}
                                                searchLoading={searchLoading}
                                                selectedRecipients={selectedRecipients}
                                                onSelectRecipient={handleSelectRecipient}
                                                onRemoveRecipient={handleRemoveRecipient}
                                                onClearSelected={clearSelectedRecipients}
                                            />

                                            <DocsGuidanceSection
                                                documents={documents}
                                                loading={documentsLoading}
                                                viewingDocId={viewingDocId}
                                                onOpenDocument={openDocument}
                                                currentUserEmail={user?.email}
                                                currentStudentId={currentStudentId}
                                                userRole={role}
                                            />

                                            <DocumentHistorySection
                                                documents={documents}
                                                loading={documentsLoading}
                                                viewingDocId={viewingDocId}
                                                onOpenDocument={openDocument}
                                                onRefresh={loadDocuments}
                                            />
                                        </>
                                    )}

                                    {isTeacher && (
                                        <TeacherUtilitiesSection
                                            onGenerateProfile={generateProfileReport}
                                            profileLoading={profileLoading}
                                            onRefreshHistory={loadDocuments}
                                            documentsLoading={documentsLoading}
                                        />
                                    )}

                                    <Reveal variant="keycap" waitForLoaders={true} as={motion.div} delay={ANIMATION_DELAYS.MAIN_CONTENT}>
                                        <QuickActionPanel userRole={role} onQuickAction={() => {}} />
                                    </Reveal>
                                </div>
                            </Reveal>
                        </div>
                    </main>

                    <PageFooter
                        left={[
                            `MAIS 2.0 • ${role === 'teacher' ? 'Teacher Portal' : 'Student Portal'}`,
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

                <TemplateModal
                    open={templateModalOpen}
                    onClose={closeTemplateModal}
                    onSubmit={handleTemplateSubmit}
                    initialData={editingTemplate}
                    mode={editingTemplate ? 'edit' : 'create'}
                />
            </div>
        );
    };

const TemplateLibrarySection = ({ templates, loading, onAddClick, onPreview, onRemove, onEdit, previewingTemplate }) => (
    <SectionCard title="Automated template library">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-muted-foreground">
                Use curated templates or register backend keys for instant previews. Custom entries stay local to your profile.
            </p>
            <Button size="sm" variant="outline" iconName="Plus" onClick={onAddClick}>
                Add template
            </Button>
        </div>
        {loading ? (
            <div className="mt-4 text-sm text-muted-foreground">Loading templates…</div>
        ) : (
            <div className="mt-4 space-y-3">
                {templates.map((item) => (
                    <div key={item.key} className="border border-border rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{item.label}</span>
                                <span className={`text-[11px] font-semibold tracking-wide uppercase ${item.source === 'system' ? 'text-primary' : 'text-amber-500'}`}>
                                    {item.source === 'system' ? 'System' : 'Custom'}
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <Button
                                size="sm"
                                variant="ghost"
                                iconName="Pencil"
                                onClick={() => onEdit?.(item)}
                            >
                                Edit
                            </Button>
                            {item.source === 'custom' && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    iconName="Trash"
                                    onClick={() => onRemove(item.key)}
                                    aria-label={`Remove ${item.label}`}
                                />
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                iconName="Eye"
                                onClick={() => onPreview(item.key)}
                                disabled={previewingTemplate === item.key}
                            >
                                {previewingTemplate === item.key ? 'Rendering…' : 'Preview'}
                            </Button>
                        </div>
                    </div>
                ))}
                {templates.length === 0 && (
                    <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                        No templates registered yet.
                    </div>
                )}
            </div>
        )}
    </SectionCard>
);

const CustomComposerSection = ({
    customTitle,
    onCustomTitleChange,
    customHtml,
    onCustomHtmlChange,
    placeholderHints,
    onRequestPreview,
    previewHtml,
    previewLoading,
    previewError,
    fileInputRef,
    onUploadTemplate,
    onResetTemplate,
    onSend,
    assigning,
    hasPayload,
    targetMode,
    selectedStudentsCount,
    selectedFacultyCount,
    selectedRecipientsCount,
    onSaveMetadata
}) => {
    const manualRecipientCount = selectedRecipientsCount;
    const broadcastLabel = selectedFacultyCount > 0
        ? `Broadcast to all students + ${selectedFacultyCount} faculty`
        : 'Broadcast to all active students';
    const manualLabel = manualRecipientCount > 0
        ? `Send to ${manualRecipientCount} recipient${manualRecipientCount > 1 ? 's' : ''}`
        : 'Select recipients first';

    return (
    <SectionCard title="Custom template designer">
        <p className="text-sm text-muted-foreground mb-4">
            Craft bespoke HTML templates, upload prepared layouts, and schedule them for selected cohorts.
        </p>
        <div className="space-y-4">
            <Input label="Template title" value={customTitle} onChange={(e) => onCustomTitleChange(e.target.value)} placeholder="e.g. Accommodation reminder" />
            <Textarea
                label="Template HTML"
                value={customHtml}
                onChange={(e) => onCustomHtmlChange(e.target.value)}
                minRows={12}
                resize="vertical"
                description="Supports inline styles. Placeholders will be replaced during rendering."
            />
            <div className="flex flex-wrap gap-2 text-xs">
                {placeholderHints.map((hint) => (
                    <span key={hint.token} className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                        {hint.token} – {hint.label}
                    </span>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                <Button iconName="Eye" onClick={onRequestPreview} disabled={!hasPayload || previewLoading}>
                    {previewLoading ? 'Rendering…' : 'Refresh preview'}
                </Button>
                <Button iconName="Upload" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Upload HTML
                </Button>
                <Button variant="ghost" iconName="RotateCcw" onClick={onResetTemplate}>
                    Reset
                </Button>
                <input ref={fileInputRef} type="file" accept=".html,.htm,.txt" hidden onChange={onUploadTemplate} />
            </div>
            <div className="border border-dashed rounded-xl p-4 bg-muted/30">
                <div className="text-sm font-medium mb-2">Live preview</div>
                <div className="relative h-[420px] bg-white rounded-lg overflow-hidden border border-border">
                    {previewLoading && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-white/80">
                            Rendering preview…
                        </div>
                    )}
                    {!previewLoading && previewHtml && (
                        <div className="absolute inset-0 overflow-auto bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    )}
                    {!previewLoading && !previewHtml && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
                            {previewError || 'Start typing HTML to see a rendered preview here.'}
                        </div>
                    )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">Preview mirrors the first selected student, if any.</div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    disabled={assigning || !hasPayload}
                    onClick={onSend}
                    iconName={targetMode === 'all_active' ? 'Users' : 'Send'}
                >
                    {assigning
                        ? 'Sending…'
                        : targetMode === 'all_active'
                            ? broadcastLabel
                            : manualLabel}
                </Button>
                <Button size="sm" variant="outline" iconName="Save" onClick={onSaveMetadata}>
                    Save metadata
                </Button>
            </div>
            {selectedFacultyCount > 0 && (
                <div className="text-[11px] text-muted-foreground">
                    Faculty recipients receive their copies via staff inbox in Docs &amp; guidance.
                </div>
            )}
        </div>
    </SectionCard>
);

};

const StudentAccessNotice = ({ onRefreshHistory, documents = [], loading, onOpenDocument, viewingDocId }) => {
    const list = Array.isArray(documents) ? documents : [];
    
    const getDocumentBadge = (doc) => {
        if (doc?.source === 'local') return { label: 'Local', class: 'bg-amber-100 text-amber-700' };
        if (doc?.templateKey === 'confirm' || doc?.templateKey === 'confirm_upsvar') return { label: 'System', class: 'bg-blue-100 text-blue-700' };
        return { label: 'Sent', class: 'bg-success/10 text-success' };
    };

    const getDocumentIcon = (doc) => {
        if (doc?.templateKey === 'confirm') return 'FileCheck';
        if (doc?.templateKey === 'confirm_upsvar') return 'GraduationCap';
        if (doc?.source === 'local') return 'Sparkles';
        return 'FileText';
    };

    return (
        <SectionCard
            title="Student documents"
            iconName="FileText"
            description="All confirmations and documents sent to you."
        >
            <div className="space-y-4">
                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                    <Button size="sm" iconName="RefreshCw" onClick={onRefreshHistory} disabled={loading}>
                        Refresh documents
                    </Button>
                    <Button size="sm" variant="outline" iconName="HelpCircle" onClick={() => window.open('/help', '_blank')}>
                        Help center
                    </Button>
                </div>

                {/* Documents Table */}
                {loading ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">Loading documents...</div>
                ) : list.length > 0 ? (
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-10">
                                            <Icon name="FileText" size={16} className="text-muted-foreground" />
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground min-w-[250px]">Document</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground min-w-[140px]">Type</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground min-w-[180px]">From</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground min-w-[140px]">Date</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground min-w-[100px]">Status</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-foreground w-24">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {list.map((doc) => {
                                        const badge = getDocumentBadge(doc);
                                        const icon = getDocumentIcon(doc);
                                        const isOpening = viewingDocId === doc.id;
                                        
                                        return (
                                            <tr 
                                                key={doc.id} 
                                                className="hover:bg-muted/30 transition-colors"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <Icon name={icon} size={14} className="text-primary" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-sm text-foreground truncate max-w-[300px]" title={doc.title}>
                                                        {doc.title}
                                                    </div>
                                                    {doc.description && (
                                                        <div className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">
                                                            {doc.description}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {doc.teacherName || doc.teacherEmail || doc.ownerName || doc.ownerEmail ? (
                                                        <div className="text-sm text-foreground">
                                                            {doc.teacherName || doc.teacherEmail || doc.ownerName || doc.ownerEmail}
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground italic">
                                                            <Icon name="Server" size={12} />
                                                            Sent from system
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                                                        {formatTimestamp(doc.createdAt)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-success">
                                                        <Icon name="CheckCircle2" size={14} />
                                                        Available
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        size="xs"
                                                        variant="ghost"
                                                        onClick={() => onOpenDocument(doc)}
                                                        disabled={isOpening}
                                                        className="gap-1.5"
                                                    >
                                                        <Icon 
                                                            name={isOpening ? 'Loader2' : 'Eye'} 
                                                            size={14} 
                                                            className={isOpening ? 'animate-spin' : ''} 
                                                        />
                                                        {isOpening ? 'Opening...' : 'View'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-border bg-card p-8 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                            <Icon name="Inbox" size={20} className="text-muted-foreground" />
                        </div>
                        <h4 className="font-semibold text-sm mb-1">No documents yet</h4>
                        <p className="text-sm text-muted-foreground">
                            Confirmations sent by the office will appear here.
                        </p>
                    </div>
                )}
                
                {/* Info Panel */}
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon name="Info" size={18} className="text-primary" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-2">How it works</h4>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                <li>Documents sent to you automatically appear in the table above</li>
                                <li>Click <strong>View</strong> to open any document</li>
                                <li>Documents stay cached locally so you can access them offline</li>
                                <li>Use the <strong>Refresh</strong> button to check for new documents</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                    Need a fresh enrollment confirmation or scholarship statement? Contact your study office and they will send the latest copy directly to your account.
                </p>
            </div>
        </SectionCard>
    );
};

const templateDescriptor = (doc) => {
    if (!doc) return 'Custom template';
    if (doc.templateLabel) return doc.templateLabel;
    const key = (doc.template || doc.templateKey || '').toString();
    if (!key) return 'Custom template';
    if (key === CUSTOM_TEMPLATE_KEY) return 'Custom template';
    return key.replace(/_/g, ' ');
};

const DocsGuidanceSection = ({ documents, loading, viewingDocId, onOpenDocument, currentUserEmail, currentStudentId, userRole }) => {
    const inboundDocuments = useMemo(() => {
        const list = Array.isArray(documents) ? documents : [];
        
        return list.filter((doc) => {
            
            // Для студентів показуємо документи надіслані їм
            if (userRole === 'student') {
                const docStudentId = doc?.studentId;
                const docStudentEmail = doc?.studentEmail;
                
                // Не показувати приватні документи викладачів (де ownerRole=teacher і немає studentId)
                if (doc?.ownerRole === 'teacher' && !docStudentId && !docStudentEmail) {
                    return false;
                }
                
                // Якщо є studentId або studentEmail, перевіряємо чи це для нашого студента
                if (docStudentId || docStudentEmail) {
                    // Спочатку перевірити по email якщо є
                    if (docStudentEmail && currentUserEmail) {
                        const matchesEmail = String(docStudentEmail).toLowerCase().trim() === String(currentUserEmail).toLowerCase().trim();
                        if (matchesEmail) return true;
                    }
                    
                    // Потім перевірити по ID
                    if (docStudentId && currentStudentId) {
                        // Нормалізувати ID для порівняння (видалити суфікси типу -ing, -bc)
                        const normalizeId = (id) => {
                            if (!id) return '';
                            const str = String(id).trim();
                            // Видалити суфікси -bc, -ing, -mgr, -phd тощо
                            return str.replace(/-(bc|ing|mgr|phd)(-d)?(-sk)?$/i, '');
                        };
                        
                        const docId = String(docStudentId).trim();
                        const currId = String(currentStudentId).trim();
                        const normalizedDocId = normalizeId(docId);
                        const normalizedCurrentId = normalizeId(currId);
                        
                        // Точна відповідність нормалізованих ID
                        if (normalizedDocId && normalizedCurrentId && normalizedDocId === normalizedCurrentId) return true;
                        // Точна відповідність оригінальних ID
                        if (docId === currId) return true;
                        // Перевірка чи один є частиною іншого (напр. kb079if vs kb079if-ing)
                        if (docId.startsWith(currId + '-') || currId.startsWith(docId + '-')) return true;
                    }
                    
                    // Якщо є studentId або studentEmail але не збігається - не показувати
                    return false;
                }
                
                // Інші документи показувати (системні підтвердження тощо)
                return true;
            }
            
            // Для викладачів показуємо тільки документи від інших викладачів
            if (doc?.ownerRole !== 'teacher') return false;
            if (!doc?.ownerEmail) return (doc?.ownerName || '').toLowerCase() !== (currentUserEmail || '').toLowerCase();
            return doc.ownerEmail.toLowerCase() !== (currentUserEmail || '').toLowerCase();
        });
    }, [documents, currentUserEmail, currentStudentId, userRole]);

    const sectionTitle = userRole === 'student' ? 'My documents' : 'Docs & guidance';
    const sectionDescription = userRole === 'student' 
        ? 'Confirmations and documents sent to you automatically appear here.'
        : 'Track documents shared by fellow teachers and open them directly.';
    
    // Діагностика для студентів
    const totalDocs = Array.isArray(documents) ? documents.length : 0;
    const filteredCount = inboundDocuments.length;
    
    // Для діагностики показати інформацію про перший документ
    const firstDoc = totalDocs > 0 ? documents[0] : null;
    const debugInfo = firstDoc ? `Doc has: studentId="${firstDoc.studentId || 'none'}", studentEmail="${firstDoc.studentEmail || 'none'}", ownerRole="${firstDoc.ownerRole || 'none'}"` : '';
    
    // Діагностика selectedStudy для розуміння чому currentStudentId не встановлений
    const debugStudy = userRole === 'student' && !currentStudentId 
        ? ` [Study: personId="${documents[0]?.personId || 'missing'}", studentId="${documents[0]?.studentId || 'missing'}"]`
        : '';
    
    const emptyMessage = userRole === 'student'
        ? (totalDocs > 0 
            ? `Found ${totalDocs} document(s) in history, but none match your student ID. Your ID: ${currentStudentId || 'not set'}, Email: ${currentUserEmail || 'not set'}. ${debugInfo}${debugStudy}`
            : 'No documents received yet. Confirmations sent by the office will appear here.')
        : 'No shared teacher documents yet. When colleagues send guidance, it will appear here.';

    return (
        <SectionCard
            title={sectionTitle}
            iconName="Share2"
            description={sectionDescription}
        >
            {loading ? (
                <div className="text-sm text-muted-foreground">Checking inbox…</div>
            ) : inboundDocuments.length > 0 ? (
                <ul className="space-y-3">
                    {inboundDocuments.slice(0, 5).map((doc) => (
                        <li key={`inbound-${doc.id}`}>
                            <button
                                type="button"
                                onClick={() => onOpenDocument(doc)}
                                className="w-full text-left rounded-xl border border-border/60 bg-background hover:bg-muted/60 transition flex items-center gap-3 p-3"
                                disabled={viewingDocId === doc.id}
                            >
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                    <Icon name="Mail" size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{doc.title}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {userRole === 'student' 
                                            ? (doc.teacherName || doc.teacherEmail 
                                                ? `From ${doc.teacherName || doc.teacherEmail} • ${formatTimestamp(doc.createdAt)}`
                                                : <span><span className="italic">Sent from system</span> • {formatTimestamp(doc.createdAt)}</span>)
                                            : `Shared by ${doc.ownerName || doc.ownerEmail || 'Teacher'} • ${formatTimestamp(doc.createdAt)}`}
                                    </div>
                                </div>
                                <span className="text-xs text-primary font-medium">
                                    {viewingDocId === doc.id ? 'Opening…' : 'Open'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-sm text-muted-foreground">{emptyMessage}</div>
            )}
        </SectionCard>
    );
};

const DocumentHistorySection = ({ documents, loading, viewingDocId, onOpenDocument, onRefresh }) => {
    const list = Array.isArray(documents) ? documents : [];
    const getVariant = (doc) => {
        if (doc?.source === 'local') return { icon: 'Sparkles', badge: doc?.meta?.kind === 'profile' ? 'Local profile' : 'Local draft', badgeClass: 'text-amber-700 bg-amber-100' };
        if (doc?.ownerRole === 'teacher') return { icon: 'Shield', badge: 'Private', badgeClass: 'text-primary bg-primary/10' };
        if (doc?.studentName || doc?.studentId) return { icon: 'User', badge: doc.studentName || doc.studentId, badgeClass: 'text-success bg-success/10' };
        return { icon: 'Server', badge: 'Sent from system', badgeClass: 'text-muted-foreground bg-muted italic' };
    };

    return (
        <SectionCard
            title="Document history"
            iconName="Clock"
            description="Every render appears here with timestamps, including locally cached copies."
            action={<Button size="xs" variant="ghost" iconName="RefreshCw" onClick={onRefresh} disabled={loading}>Refresh</Button>}
        >
            {loading ? (
                <div className="text-sm text-muted-foreground">Loading document history…</div>
            ) : list.length > 0 ? (
                <ul className="space-y-3">
                    {list.map((doc) => {
                        const meta = getVariant(doc);
                        return (
                            <li key={doc.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenDocument(doc)}
                                    className="w-full text-left rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 transition flex items-center gap-3 p-3"
                                    disabled={viewingDocId === doc.id}
                                >
                                    <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center">
                                        <Icon name={meta.icon} size={16} className="text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm text-foreground truncate">{doc.title}</span>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${meta.badgeClass}`}>{meta.badge}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {formatTimestamp(doc.createdAt)} • {templateDescriptor(doc)}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            From: {doc.teacherName || doc.teacherEmail || doc.ownerName || doc.ownerEmail || (
                                                <span className="italic">Sent from system</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs text-primary font-medium ml-2">
                                        {doc.source === 'local' ? 'View copy' : viewingDocId === doc.id ? 'Opening…' : 'Open'}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="text-sm text-muted-foreground">No documents yet. Generate a report to see it here.</div>
            )}
        </SectionCard>
    );
};

const TeacherUtilitiesSection = ({ onGenerateProfile, profileLoading, onRefreshHistory, documentsLoading }) => (
    <SectionCard title="Teacher tools">
        <div className="flex flex-wrap gap-2">
            <Button iconName="IdCard" onClick={onGenerateProfile} disabled={profileLoading}>
                {profileLoading ? 'Generating…' : 'Generate profile report'}
            </Button>
            <Button variant="outline" iconName="RefreshCw" onClick={onRefreshHistory} disabled={documentsLoading}>
                Refresh history
            </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Profile reports are saved to your document history automatically, even when rendered locally.</p>
    </SectionCard>
);

const TemplateModal = ({ open, onClose, onSubmit, initialData, mode = 'create' }) => {
    const [draft, setDraft] = useState({ label: '', key: '', description: '' });
    const [error, setError] = useState('');
    const isSystemOverride = initialData?.source === 'system';

    useEffect(() => {
        if (open) {
            setDraft({
                label: initialData?.label || '',
                key: initialData?.key || '',
                description: initialData?.description || ''
            });
            setError('');
        }
    }, [open, initialData]);

    const handleSave = async () => {
        if (!draft.label.trim() || !draft.key.trim()) {
            setError('Provide both a title and template key.');
            return;
        }
        await onSubmit({
            label: draft.label,
            key: draft.key,
            description: draft.description
        });
    };

    const title = mode === 'edit' ? 'Edit template' : 'Add template';
    const subtitle = mode === 'edit'
        ? 'Update the label, key, or helper text for this saved template.'
        : 'Register backend template keys for quick previews.';
    const primaryLabel = mode === 'edit' ? 'Save changes' : 'Save template';

    return (
        <ModalBase
            open={open}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} iconName="Save">{primaryLabel}</Button>
                </>
            )}
        >
            <div className="space-y-4">
                {isSystemOverride && (
                    <div className="text-xs text-muted-foreground bg-muted rounded-md p-2">
                        Editing a system template will save your personalized copy. The original system version remains available in the backend.
                    </div>
                )}
                <Input
                    label="Template title"
                    value={draft.label}
                    onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
                />
                <Input
                    label="Template key"
                    value={draft.key}
                    onChange={(e) => setDraft((prev) => ({ ...prev, key: e.target.value }))}
                    description="Match the key exposed by the backend renderer."
                />
                <Textarea
                    label="Description"
                    minRows={3}
                    value={draft.description}
                    onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                    description="Optional helper text displayed in the library."
                />
                {error && <p className="text-sm text-error">{error}</p>}
            </div>
        </ModalBase>
    );
};

const PrintReportsPage = () => {
    return (
        <ToastsProvider>
            <PrintReportsInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default PrintReportsPage;