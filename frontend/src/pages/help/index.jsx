// src/pages/help/index.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import Header from '../../components/ui/Header';
import RoleSidebar from '../../components/ui/RoleSidebar';
import NavigationBreadcrumb from '../../components/ui/NavigationBreadcrumb';
import QuickActionPanel from '../../components/ui/QuickActionPanel';
import Button from '../../components/ui/Button';
import PageFooter from '../../components/ui/PageFooter';

import HelpHero from './components/HelpHero';
import KnowledgeBase from './components/KnowledgeBase';
import BugReporter from './components/BugReporter';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import Shortcuts from './components/Shortcuts';
import Changelog from './components/Changelog';
import CommandPalette from '../../components/ui/CommandPalette';

import useProfileDisplayName from '../../hooks/useProfileDisplayName';
import { useAuth } from '../../contexts/AuthContext';
import { ToastsProvider, ToastViewport, useToasts } from '../../components/ui/Toasts';
import { formatLastLogin } from '../../utils/datetime';
import Reveal from '../../components/motion/Reveal';
import { ANIMATION_DELAYS } from '../../constants/animations';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';
import { getUserPreferences, deleteUserPreference } from '../../data/userPreferencesApi';
import { extractApiErrorMessage } from '../../utils/apiErrors';
import { fetchChangelog, createChangelogEntry, updateChangelogEntry, deleteChangelogEntry } from '../../data/changelogApi';
import useDataUpdates from '../../hooks/useDataUpdates';
import apiClient from '../../utils/apiClient';

const BREADCRUMB_ANCHORS = {
    kb: 'kb',
    tickets: 'tickets',
    diagnostics: 'diagnostics',
    bug: 'bug',
    shortcuts: 'shortcuts',
    changelog: 'changelog',
};

const HelpPageInner = () => {
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const userRole = userProfile?.role || user?.role || 'student';
    const roleLabel = userRole === 'teacher' ? 'Teacher' : 'Student';
    const headerDisplayName = useProfileDisplayName(roleLabel);
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

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [paletteQuery, setPaletteQuery] = useState('');
    const [search, setSearch] = useState('');

    const [diag, setDiag] = useState(null);
    const [diagRunning, setDiagRunning] = useState(false);
    const [diagCollapsed, setDiagCollapsed] = useState(false);

    const [bug, setBug] = useState({
        category: 'ui',
        severity: 'medium',
        summary: '',
        repro: '',
        expected: '',
        actual: '',
        attachments: [],
    });
    const [bugPreviewMode, setBugPreviewMode] = useState('rendered');
    const [copied, setCopied] = useState(false);
    const lastLoginLabel = useMemo(() => formatLastLogin(user?.lastLoginAt), [user?.lastLoginAt]);

    const [changelog, setChangelog] = useState([]);
    const [changelogLoading, setChangelogLoading] = useState(true);

    // Load changelog from API
    const loadChangelog = useCallback(async () => {
        try {
            setChangelogLoading(true);
            const entries = await fetchChangelog();
            setChangelog(Array.isArray(entries) ? entries : []);
        } catch (error) {
            console.error('Failed to load changelog:', error);
            guardedNotify('changelog-load-error', 'error', extractApiErrorMessage(error, 'Failed to load changelog'));
            setChangelog([]);
        } finally {
            setChangelogLoading(false);
        }
    }, []);

    useEffect(() => {
        loadChangelog();
    }, [loadChangelog]);

    // Subscribe to real-time changelog updates
    useDataUpdates(useCallback((payload) => {
        if (payload.type === 'changelog.updated') {
            console.log('[Help] Changelog update received:', payload);
            // Reload changelog directly
            (async () => {
                try {
                    setChangelogLoading(true);
                    console.log('[Help] Invalidating changelog cache...');
                    apiClient.invalidateCache('/changelog');
                    console.log('[Help] Fetching changelog after update...');
                    const entries = await fetchChangelog();
                    console.log('[Help] Fetched entries:', entries?.length, entries);
                    setChangelog(Array.isArray(entries) ? entries : []);
                    console.log('[Help] Changelog state updated');
                } catch (error) {
                    console.error('[Help] Failed to reload changelog after update:', error);
                    setChangelog([]);
                } finally {
                    setChangelogLoading(false);
                }
            })();
        }
    }, []));

    const handleAddChangelogEntry = async (entry) => {
        try {
            const created = await createChangelogEntry({
                version: entry.version,
                date: new Date(entry.date),
                title: entry.title,
                points: entry.points
            });
            setChangelog(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
            guardedNotify('changelog-add', 'success', 'Changelog entry added');
        } catch (error) {
            console.error('Failed to create changelog entry:', error);
            guardedNotify('changelog-add-error', 'error', extractApiErrorMessage(error, 'Failed to add changelog entry'));
        }
    };

    const handleEditChangelogEntry = async (entry) => {
        try {
            const updated = await updateChangelogEntry(entry.id, {
                version: entry.version,
                date: new Date(entry.date),
                title: entry.title,
                points: entry.points
            });
            setChangelog(prev => (Array.isArray(prev) ? prev : []).map(item => item.id === updated.id ? updated : item));
            guardedNotify('changelog-edit', 'success', 'Changelog entry updated');
        } catch (error) {
            console.error('Failed to update changelog entry:', error);
            guardedNotify('changelog-edit-error', 'error', extractApiErrorMessage(error, 'Failed to update changelog entry'));
        }
    };

    const handleDeleteChangelogEntry = async (id) => {
        if (window.confirm('Are you sure you want to delete this changelog entry?')) {
            try {
                await deleteChangelogEntry(id);
                setChangelog(prev => (Array.isArray(prev) ? prev : []).filter(item => item.id !== id));
                guardedNotify('changelog-delete', 'success', 'Changelog entry deleted');
            } catch (error) {
                console.error('Failed to delete changelog entry:', error);
                guardedNotify('changelog-delete-error', 'error', extractApiErrorMessage(error, 'Failed to delete changelog entry'));
            }
        }
    };

    const bugMarkdown = useMemo(() => {
        const lines = [
            `# Bug Report`,
            ``,
            `**Category:** ${bug.category}`,
            `**Severity:** ${bug.severity}`,
            ``,
            `## Summary`,
            bug.summary || '_(short summary)_',
            ``,
            `## Steps to Reproduce`,
            bug.repro || '- Step 1\n- Step 2\n- Step 3',
            ``,
            `## Expected Result`,
            bug.expected || '_what you expected_',
            ``,
            `## Actual Result`,
            bug.actual || '_what happened instead_',
            ``,
            `---`,
            `Generated: ${new Date().toISOString()}`,
        ];
        return lines.join('\n');
    }, [bug]);

    const bugHtml = useMemo(() => renderMarkdownSafe(bugMarkdown), [bugMarkdown]);

    const jumpTo = (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
        setIsPaletteOpen(false);
        guardedNotify('help-jump', 'info', 'Jumped');
    };

    const paletteActions = [
        { id: 'open-students', icon: 'Users', label: 'Open Students', hint: 'Go to student management', run: () => navigate('/student-management') },
        { id: 'open-attendance', icon: 'CheckSquare', label: 'Open Attendance', hint: 'Track attendance', run: () => navigate('/attendance-tracking') },
        { id: 'open-grades', icon: 'BookOpen', label: 'Open Grades', hint: 'Grade management', run: () => navigate('/grade-management') },
        { id: 'open-activities', icon: 'BarChart3', label: 'Open Activities', hint: 'View activity feed', run: () => navigate('/activities') },
        { id: 'open-profile', icon: 'User', label: 'Open Profile', hint: 'Profile & settings', run: () => navigate('/profile') },
        { id: 'jump-kb', icon: 'HelpCircle', label: 'Help: Knowledge Base', hint: 'Scroll to Knowledge Base', run: () => jumpTo(BREADCRUMB_ANCHORS.kb) },
        { id: 'jump-tickets', icon: 'Ticket', label: 'Help: Support Tickets', hint: 'View support tickets', run: () => jumpTo(BREADCRUMB_ANCHORS.tickets) },
        { id: 'jump-diagnostics', icon: 'Activity', label: 'Help: Diagnostics', hint: 'System diagnostics', run: () => jumpTo(BREADCRUMB_ANCHORS.diagnostics) },
        { id: 'jump-report', icon: 'Bug', label: 'Help: Report a Bug', hint: 'Open bug reporter', run: () => jumpTo(BREADCRUMB_ANCHORS.bug) },
        { id: 'jump-shortcuts', icon: 'Keyboard', label: 'Help: Shortcuts', hint: 'List of shortcuts', run: () => jumpTo(BREADCRUMB_ANCHORS.shortcuts) },
        { id: 'jump-changelog', icon: 'History', label: 'Help: Changelog', hint: 'Scroll to Changelog', run: () => jumpTo(BREADCRUMB_ANCHORS.changelog) },
        { id: 'open-faculty', icon: 'UserCheck', label: 'Open Faculty', hint: 'Manage teachers', run: () => navigate('/faculty-management') },
        { id: 'find-teacher', icon: 'UserSearch', label: 'Find Teacher', hint: 'Search teachers', run: () => navigate('/faculty-management') },
    ];

    const runDiagnostics = async () => {
        setDiagRunning(true);
        guardedNotify('help-diag-start', 'info', 'Running diagnostics…', { lockMs: 1000 });
        const started = performance.now();
        const latency = await measureLatency();
        const fps = await measureFps(1000);
        const storage = await getStorageEstimate();
        const webgl = await getWebGLInfo();
        const battery = await getBatteryInfo();
        const permissions = await collectPermissions([
            'notifications',
            'clipboard-read',
            'clipboard-write',
            'geolocation',
        ]);
        const ua = await getUAInfo();
        const info = {
            time: new Date().toISOString(),
            online: navigator.onLine,
            language: navigator.language,
            userAgent: ua.userAgent,
            platform: ua.platform ?? null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            deviceMemory: navigator.deviceMemory ?? null,
            hardwareConcurrency: navigator.hardwareConcurrency ?? null,
            viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
            colorScheme: getColorScheme(),
            permissions,
            latencyMs: latency,
            fps,
            storage,
            webgl,
            battery,
            ua,
            measuredInMs: Math.round(performance.now() - started),
        };
        try {
            const preferences = await getUserPreferences();
            info.preferenceKeys = Object.keys(preferences || {}).sort();
            info.preferencesSnapshot = preferences;
        } catch {
            info.preferenceKeys = [];
            info.preferencesSnapshot = {};
        }
        setDiag(info);
        setDiagRunning(false);
        guardedNotify('help-diag-complete', 'success', 'Diagnostics complete', { lockMs: 4000 });
    };

    const downloadSupportBundle = async () => {
        let preferences = {};
        try {
            preferences = await getUserPreferences();
        } catch {
            preferences = {};
        }
        const payload = { generatedAt: new Date().toISOString(), diagnostics: diag || {}, preferences };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        aDownload(url, `support_bundle_${Date.now()}.json`);
        URL.revokeObjectURL(url);
        guardedNotify('help-support-bundle', 'success', 'Support bundle downloaded', { lockMs: 2500 });
    };

    const copyDiagnosticsJson = async () => {
        try { await navigator.clipboard?.writeText(JSON.stringify(diag || {}, null, 2)); } catch {}
        guardedNotify('help-diag-copy', 'success', 'Diagnostics copied to clipboard', { lockMs: 2200 });
    };

    const clearLocalCache = async () => {
        const ok = window.prompt('Type CLEAR to remove MAIS local cache (profile, preferences, views).');
        if (ok !== 'CLEAR') return;
        try {
            const preferences = await getUserPreferences();
            const keys = Object.keys(preferences || {});
            await Promise.all(keys.map((key) => deleteUserPreference(key)));
            guardedNotify('help-cache-cleared', 'success', 'Preferences cleared', { lockMs: 4000 });
        } catch (error) {
            guardedNotify(
                'help-cache-clear-error',
                'error',
                extractApiErrorMessage(error, 'Failed to clear preferences'),
                { lockMs: 4000 },
            );
        }
    };

    const copyBug = async () => {
        try { await navigator.clipboard?.writeText(bugMarkdown); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
        guardedNotify('help-bug-copy', 'success', 'Bug markdown copied', { lockMs: 2000 });
    };
    const copyBugHtml = async () => {
        try { await navigator.clipboard?.writeText(bugHtml); } catch {}
        guardedNotify('help-bug-html-copy', 'success', 'Preview HTML copied', { lockMs: 2000 });
    };
    const downloadBug = () => {
        const blob = new Blob([bugMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        aDownload(url, `bug_report_${Date.now()}.md`);
        URL.revokeObjectURL(url);
        guardedNotify('help-bug-download', 'success', 'Bug report saved', { lockMs: 2200 });
    };
    const mailBug = () => {
        const subject = encodeURIComponent(`[MAIS] Bug: ${bug.summary || '(no summary)'}`);
        const body = encodeURIComponent(bugMarkdown + '\n\n---\nTip: attach screenshots if possible.');
        window.location.href = `mailto:support@mais.example?subject=${subject}&body=${body}`;
        guardedNotify('help-bug-mail', 'info', 'Mail draft opened', { lockMs: 2200 });
    };

    const handleLogout = () => navigate('/');

    useEffect(() => {
        const onKey = (e) => {
            const tag = (e.target?.tagName || '').toLowerCase();
            const editable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
            if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                setIsPaletteOpen((o) => !o);
                guardedNotify('help-palette-toggle', 'info', 'Command palette toggled', { lockMs: 1500 });
                return;
            }
            handleGCombos(e, editable, navigate);
        };
        document.addEventListener('keydown', onKey, { capture: true });
        window.addEventListener('keydown', onKey, { capture: true });
        return () => {
            document.removeEventListener('keydown', onKey, { capture: true });
            window.removeEventListener('keydown', onKey, { capture: true });
        };
    }, [navigate]);

    const dynamicSideMargin = isSidebarCollapsed ? 'md:ml-16' : 'md:ml-72';

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Header userRole={userRole} userName={headerDisplayName} onLogout={handleLogout} />
            <RoleSidebar
                userRole={userRole}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            <div className={`${dynamicSideMargin} ml-0 transition-all duration-300 mt-16 min-h-[calc(100vh-4rem)] flex flex-col`}>
                <main className="flex-1">
                    <div className="px-6 pt-3 pb-6">
                        <NavigationBreadcrumb />
                        <Reveal as={motion.section} delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true}>
                            <HelpHero
                                role={userRole}
                                search={search}
                                onSearch={setSearch}
                                onOpenPalette={() => { setIsPaletteOpen(true); guardedNotify('help-palette-open', 'info', 'Command palette opened', { lockMs: 2000 }); }}
                                onJumpTo={(anchor) => jumpTo(anchor)}
                                onDownloadBundle={() => {
                                    downloadSupportBundle();
                                }}
                                onClearCache={() => {
                                    clearLocalCache();
                                }}
                                clearing={false}
                                bundleMsg=""
                            />
                        </Reveal>

                        <Reveal delay={ANIMATION_DELAYS.SUBTITLE} variant="keycap" waitForLoaders={true} className="mb-6">
                            <QuickActionPanel userRole={userRole} onQuickAction={() => {}} />
                        </Reveal>

                        <Reveal as={motion.section} className="grid grid-cols-1 xl:grid-cols-3 gap-6" delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true}>
                            <div className="xl:col-span-2 space-y-6">
                                <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="pop" waitForLoaders={true}>
                                    <KnowledgeBase 
                                        anchorId={BREADCRUMB_ANCHORS.kb} 
                                        query={search}
                                        userRole={userRole}
                                    />
                                </Reveal>

                                <Reveal delay={ANIMATION_DELAYS.TABS} variant="pop" waitForLoaders={true}>
                                    <BugReporter
                                        anchorId={BREADCRUMB_ANCHORS.bug}
                                        bug={bug}
                                        setBug={setBug}
                                        bugMarkdown={bugMarkdown}
                                        bugHtml={bugHtml}
                                        copied={copied}
                                        onCopyMd={copyBug}
                                        onCopyHtml={copyBugHtml}
                                        onDownload={downloadBug}
                                        onMail={mailBug}
                                        previewMode={bugPreviewMode}
                                        setPreviewMode={setBugPreviewMode}
                                    />
                                </Reveal>
                            </div>

                            <div className="space-y-6">
                                <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="slideScale" waitForLoaders={true}>
                                    <DiagnosticsPanel
                                        anchorId={BREADCRUMB_ANCHORS.diagnostics}
                                        diag={diag}
                                        diagRunning={diagRunning}
                                        diagCollapsed={diagCollapsed}
                                        setDiagCollapsed={setDiagCollapsed}
                                        runDiagnostics={runDiagnostics}
                                        copyDiagnosticsJson={copyDiagnosticsJson}
                                        downloadSupportBundle={downloadSupportBundle}
                                        bundleMsg=""
                                    />
                                </Reveal>

                                <Reveal delay={ANIMATION_DELAYS.SIDEBAR_PANEL} variant="slideScale" waitForLoaders={true}>
                                    <Shortcuts anchorId={BREADCRUMB_ANCHORS.shortcuts} />
                                </Reveal>

                                <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="slideScale" waitForLoaders={true}>
                                    <Changelog 
                                        anchorId={BREADCRUMB_ANCHORS.changelog} 
                                        items={changelog}
                                        onAdd={handleAddChangelogEntry}
                                        onEdit={handleEditChangelogEntry}
                                        onDelete={handleDeleteChangelogEntry}
                                        isTeacher={userRole === 'teacher'}
                                    />
                                </Reveal>
                            </div>
                        </Reveal>
                    </div>
                </main>

                <PageFooter
                    left={[
                        `MAIS 2.0 • ${roleLabel} Portal`,
                        lastLoginLabel,
                    ]}
                    actions={[
                        <Button
                            key="refresh"
                            variant="ghost"
                            size="sm"
                            iconName="RefreshCw"
                            onClick={() => window.location.reload()}
                        >
                            refresh
                        </Button>,
                    ]}
                />
            </div>

            <CommandPalette
                open={isPaletteOpen}
                onClose={() => setIsPaletteOpen(false)}
                actions={paletteActions}
                query={paletteQuery}
                onQuery={setPaletteQuery}
            />
        </div>
    );
};

const HelpPage = () => {
    return (
        <ToastsProvider>
            <HelpPageInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default HelpPage;

function getColorScheme() {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'unspecified';
}
function aDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}
async function measureLatency() {
    const samples = [];
    for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await new Promise((r) => setTimeout(r, 200));
        const drift = performance.now() - t0 - 200;
        samples.push(Math.max(0, Math.round(drift)));
    }
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}
async function measureFps(durationMs = 1000) {
    return await new Promise((resolve) => {
        let frames = 0;
        let start = performance.now();
        function loop() {
            frames += 1;
            const now = performance.now();
            if (now - start >= durationMs) {
                const fps = Math.round((frames * 1000) / (now - start));
                resolve(fps);
                return;
            }
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    });
}
async function getWebGLInfo() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return {};
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null;
        const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
        const version = gl.getParameter(gl.VERSION);
        return { vendor, renderer, version };
    } catch {
        return {};
    }
}
async function getStorageEstimate() {
    try {
        const est = await navigator.storage?.estimate?.();
        return { usage: est?.usage ?? null, quota: est?.quota ?? null };
    } catch {
        return { usage: null, quota: null };
    }
}
async function getBatteryInfo() {
    try {
        if ('getBattery' in navigator && typeof navigator.getBattery === 'function') {
            const b = await navigator.getBattery();
            return { level: b?.level, charging: b?.charging };
        }
        return null;
    } catch {
        return null;
    }
}
function renderMarkdownSafe(md) {
    const escaped = String(md || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;/g')
        .replace(/>/g, '&gt;');
    const html = escaped
        .replace(/^###### (.*)$/gm, '<h6>$1</h6>')
        .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
        .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br/>');
    return `<p>${html}</p>`;
}
function handleGCombos(e, editable, navigate) {
    if (editable) return;
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const now = Date.now();
    if (!window.__maisCombo) window.__maisCombo = { last: null, at: 0 };

    if (e.code === 'KeyG') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        window.__maisCombo = { last: 'g', at: now };
        return;
    }

    if (e.code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        window.__maisCombo = { last: null, at: 0 };
        navigate('/faculty-management');
        return;
    }

    if (window.__maisCombo.last === 'g' && now - window.__maisCombo.at < 1000) {
        if (e.code === 'KeyA') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            window.__maisCombo = { last: null, at: 0 };
            navigate('/activities');
            return;
        }
        if (e.code === 'KeyP') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            window.__maisCombo = { last: null, at: 0 };
            navigate('/profile');
            return;
        }
        window.__maisCombo = { last: null, at: 0 };
    }
}
async function collectPermissions(names = []) {
    const out = {};
    for (const name of names) {
        try {
            if (!navigator.permissions?.query) { out[name] = 'unknown'; continue; }
            const st = await navigator.permissions.query({ name });
            out[name] = st?.state ?? 'unknown';
        } catch {
            out[name] = 'unknown';
        }
    }
    return out;
}
async function getUAInfo() {
    const ua = navigator.userAgent || null;
    let brands = null, mobile = null, platform = null, platformVersion = null, architecture = null, model = null, fullVersion = null;
    try {
        const uad = 'userAgentData' in navigator ? navigator.userAgentData : null;
        if (uad) {
            brands = Array.isArray(uad.brands) ? uad.brands : null;
            mobile = typeof uad.mobile === 'boolean' ? uad.mobile : null;
            platform = typeof uad.platform === 'string' ? uad.platform : null;
            const gehv = typeof uad['getHighEntropyValues'] === 'function' ? uad['getHighEntropyValues'].bind(uad) : null;
            if (gehv) {
                const hv = await gehv(['platform', 'platformVersion', 'architecture', 'model', 'uaFullVersion']);
                platform = typeof hv?.platform === 'string' ? hv.platform : platform;
                platformVersion = typeof hv?.platformVersion === 'string' ? hv.platformVersion : null;
                architecture = typeof hv?.architecture === 'string' ? hv.architecture : null;
                model = typeof hv?.model === 'string' ? hv.model : null;
                fullVersion = typeof hv?.['uaFullVersion'] === 'string' ? hv['uaFullVersion'] : null;
            }
        }
    } catch {}
    return { userAgent: ua, brands, mobile, platform, platformVersion, architecture, model, fullVersion };
}