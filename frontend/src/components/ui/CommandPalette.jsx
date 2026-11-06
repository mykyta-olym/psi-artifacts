// src/components/ui/CommandPalette.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';

const cx = (...a) => a.filter(Boolean).join(' ');
const toId = (s) => (String(s || Math.random()).toLowerCase().replace(/[^\w-]+/g, '-').slice(0, 64) || ('cmd-' + Math.random().toString(36).slice(2, 8)));

const isBcInf = (rec) => String(rec?.programCode || '').toLowerCase() === 'inf_bc_d_sk';
const isArchived = (rec) => !!rec && rec.ongoing === false;

const ALLOWED_STUDENT_PATHS_IN_ARCHIVES = new Set([
    '/student-dashboard',
    '/student-studies',
    '/print-reports',
    '/final-thesis',
    '/anketa',
    '/help',
    '/student-management',
    '/faculty-management',
]);
const ALLOWED_STUDENT_LABELS_IN_ARCHIVES = new Set([
    'Dashboard',
    'Studies',
    'Print Reports',
    'Final Thesis',
    'Surveys',
    'Help',
    'Student Management',
    'Faculty Management',
]);

const STUDENT_NAV = [
    { label: 'Dashboard', path: '/student-dashboard', icon: 'LayoutDashboard', hint: 'Overview & quick stats' },
    { label: 'Students', path: '/student-management', icon: 'Users', hint: 'Student directory' },
    { label: 'Faculty', path: '/faculty-management', icon: 'Users2', hint: 'Faculty directory' },
    { label: 'Activities', path: '/activities', icon: 'BarChart3', hint: 'Analytics & activity feed' },
    { label: 'Schedule', path: '/class-schedule-management', icon: 'Calendar', hint: 'Classes & timetable' },
    { label: 'Studies', path: '/student-studies', icon: 'GraduationCap', hint: 'Study selection & details' },
    { label: 'Print Reports', path: '/print-reports', icon: 'Printer', hint: 'Certificates & confirmations' },
    { label: 'Final Thesis', path: '/final-thesis', icon: 'FileText', hint: 'Thesis workflow' },
    { label: 'Final evaluation enrollment', path: '/terminy', icon: 'CalendarDays', hint: 'Exam dates & deadlines' },
    { label: 'Course enrollment', path: '/zapis', icon: 'FileStack', hint: 'Enrollment' },
    { label: 'Surveys', path: '/anketa', icon: 'Clipboard', hint: 'Course & service surveys' },
    { label: 'Chat', path: '/chat', icon: 'MessageSquare', hint: 'Conversations' },
    { label: 'Help', path: '/help', icon: 'HelpCircle', hint: 'FAQ & support' },
];

const TEACHER_NAV = [
    { label: 'Dashboard', path: '/teacher-dashboard', icon: 'LayoutDashboard', hint: 'Overview & quick stats' },
    { label: 'Students', path: '/student-management', icon: 'Users', hint: 'Advisees & classes' },
    { label: 'Faculty', path: '/faculty-management', icon: 'Users2', hint: 'Faculty directory' },
    { label: 'Schedule', path: '/class-schedule-management', icon: 'Calendar', hint: 'Class schedule' },
    { label: 'Attendance', path: '/attendance-tracking', icon: 'CheckSquare', hint: 'Track attendance' },
    { label: 'Grades', path: '/grade-management', icon: 'BookOpen', hint: 'Assessments & grades' },
    { label: 'Print Reports', path: '/print-reports', icon: 'Printer', hint: 'Certificates & confirmations' },
    { label: 'Final Thesis', path: '/final-thesis/teacher', icon: 'ScrollText', hint: 'Thesis supervision' },
    { label: 'Surveys', path: '/anketa', icon: 'Clipboard', hint: 'Create & analyze surveys' },
    { label: 'Chat', path: '/chat', icon: 'MessageSquare', hint: 'Conversations' },
    { label: 'Activities', path: '/activities', icon: 'BarChart3', hint: 'Analytics' },
    { label: 'Help', path: '/help', icon: 'HelpCircle', hint: 'FAQ & support' },
];

function buildDefaultActions(role, navigate) {
    const list = role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;
    return list.map((it) => ({
        id: toId(it.path),
        label: it.label,
        hint: it.hint || it.path,
        icon: it.icon,
        path: it.path,
        run: () => navigate(it.path),
    }));
}

function normalizeIncomingActions(actions, navigate) {
    return (actions || []).map((a, idx) => {
        const id = a.id || toId(a.path || a.href || `${a.label}-${idx}`);
        const run = a.run || (a.path ? () => navigate(a.path) : a.href ? () => (window.location.href = a.href) : undefined);
        return { ...a, id, run };
    });
}

function filterByArchives(actions, role, selectedStudy) {
    if (role !== 'student') return actions;
    const limit = isArchived(selectedStudy) || isBcInf(selectedStudy);
    if (!limit) return actions;

    const allowed = actions.filter((a) => {
        const p = a.path || a.href || '';
        const lbl = String(a.label || '').trim();
        if (p) return ALLOWED_STUDENT_PATHS_IN_ARCHIVES.has(p);
        if (lbl) return ALLOWED_STUDENT_LABELS_IN_ARCHIVES.has(lbl);
        return false;
    });
    const restricted = new Set(['/chat', '/activities']);
    return allowed.filter((a) => !(a.path && restricted.has(a.path)));
}

const CommandPalette = ({ open, onClose, actions = [], query, onQuery }) => {
    const { user } = useAuth() || {};
    const role = (user?.role === 'teacher' ? 'teacher' : 'student');
    const navigate = useNavigate();

    const isControlled = typeof open === 'boolean';
    const [internalOpen, setInternalOpen] = useState(Boolean(open));
    useEffect(() => { if (isControlled) setInternalOpen(open); }, [isControlled, open]);
    useEffect(() => {
        if (isControlled) return;
        const onOpenEvt = () => setInternalOpen(true);
        const onCloseEvt = () => setInternalOpen(false);
        window.addEventListener('app:palette:open', onOpenEvt);
        window.addEventListener('app:palette:close', onCloseEvt);
        return () => {
            window.removeEventListener('app:palette:open', onOpenEvt);
            window.removeEventListener('app:palette:close', onCloseEvt);
        };
    }, [isControlled]);
    const close = () => (isControlled ? onClose?.() : setInternalOpen(false));

    const isQueryControlled = typeof query === 'string';
    const [internalQuery, setInternalQuery] = useState(query || '');
    useEffect(() => { if (isQueryControlled) setInternalQuery(query); }, [isQueryControlled, query]);
    const setQuery = (v) => (isQueryControlled ? onQuery?.(v) : setInternalQuery(v));
    const qVal = isQueryControlled ? query : internalQuery;

    const defaultActions = useMemo(() => buildDefaultActions(role, navigate), [role, navigate]);
    const incoming = useMemo(() => normalizeIncomingActions(actions, navigate), [actions, navigate]);

    const merged = useMemo(() => {
        const map = new Map();
        [...defaultActions, ...incoming].forEach((a) => { if (!map.has(a.id)) map.set(a.id, a); });
        return Array.from(map.values());
    }, [defaultActions, incoming]);

    const { value: selectedStudy } = useSelectedStudyValue();
    const studyFiltered = useMemo(
        () => filterByArchives(merged, role, selectedStudy),
        [merged, role, selectedStudy],
    );

    const [active, setActive] = useState(-1);
    useEffect(() => { if (internalOpen) setActive(-1); }, [internalOpen]);

    const filtered = useMemo(() => {
        const q = (qVal || '').trim().toLowerCase();
        if (!q) return studyFiltered;
        return studyFiltered.filter((a) => {
            const hay = `${a.label} ${a.hint || ''} ${a.path || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [studyFiltered, qVal]);

    useEffect(() => { setActive(-1); }, [qVal]);

    const move = (dir) => {
        if (!filtered.length) return;
        setActive((i) => {
            if (i === -1) return dir > 0 ? 0 : filtered.length - 1;
            return (i + dir + filtered.length) % filtered.length;
        });
    };
    const runActive = () => {
        if (active < 0) return;
        const item = filtered[active];
        close();
        setTimeout(() => item?.run?.(), 50);
    };

    const onKey = (e) => {
        const k = e.key;
        if (k === 'ArrowDown' || k === 'j' || k === 'J') { e.preventDefault(); move(+1); }
        else if (k === 'ArrowUp' || k === 'k' || k === 'K') { e.preventDefault(); move(-1); }
        else if (k === 'Enter') { e.preventDefault(); runActive(); }
        else if (k === 'Escape') { e.preventDefault(); close(); }
    };

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
    );
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const m = window.matchMedia('(max-width: 640px)');
        const onChange = (e) => setIsMobile(e.matches);
        m.addEventListener?.('change', onChange);
        return () => m.removeEventListener?.('change', onChange);
    }, []);

    const listRef = useRef(null);
    const pointerStartRef = useRef({ x: 0, y: 0, active: false });
    const ignoreClickRef = useRef(false);

    const onListPointerDown = (e) => {
        const x = 'clientX' in e ? e.clientX : 0;
        const y = 'clientY' in e ? e.clientY : 0;
        pointerStartRef.current = { x, y, active: true };
        ignoreClickRef.current = false;
    };
    const onListPointerMove = (e) => {
        if (!pointerStartRef.current.active) return;
        const x = 'clientX' in e ? e.clientX : 0;
        const y = 'clientY' in e ? e.clientY : 0;
        const dx = Math.abs(x - pointerStartRef.current.x);
        const dy = Math.abs(y - pointerStartRef.current.y);
        if (dx > 6 || dy > 6) ignoreClickRef.current = true;
    };
    const onListPointerUp = () => { pointerStartRef.current.active = false; };
    const onListPointerCancel = () => { pointerStartRef.current.active = false; ignoreClickRef.current = true; };

    const onItemClick = (runFn) => {
        if (ignoreClickRef.current) { ignoreClickRef.current = false; return; }
        close();
        setTimeout(() => runFn?.(), 50);
    };

    if (!internalOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000]" onClick={close}>
            <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

            <div
                className="absolute left-1/2 top-[15%] -translate-x-1/2 w-[92vw] max-w-[720px] bg-popover text-popover-foreground border border-border rounded-lg shadow-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Command Palette"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-2 border-b border-border flex items-center gap-2">
                    <Icon name="Search" size={16} className="text-muted-foreground" />
                    <input
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-sm py-2"
                        placeholder="Type a command or search…"
                        value={qVal}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKey}
                        aria-activedescendant={active >= 0 ? filtered[active]?.id : undefined}
                    />
                    {isMobile ? (
                        <button
                            type="button"
                            onClick={close}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted/50 text-foreground hover:bg-muted active:scale-[.98] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            aria-label="Close"
                            title="Close"
                        >
                            <Icon name="X" size={16} />
                        </button>
                    ) : (
                        <span className="text-[11px] text-muted-foreground px-2">Esc</span>
                    )}
                </div>

                <div
                    className={cx('max-h-[50vh] overflow-auto select-none thin-scrollbar')}
                    role="listbox"
                    ref={listRef}
                    onPointerDown={onListPointerDown}
                    onPointerMove={onListPointerMove}
                    onPointerUp={onListPointerUp}
                    onPointerCancel={onListPointerCancel}
                    onMouseLeave={() => setActive(-1)}
                >
                    {filtered.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground select-text">No results.</div>
                    ) : (
                        <ul className="p-1">
                            {filtered.map((a, idx) => {
                                const isActive = idx === active;
                                return (
                                    <li key={a.id} id={a.id}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={isActive}
                                            className={cx(
                                                'w-full text-left flex items-center gap-2 px-3 py-2 rounded transition',
                                                isActive ? 'bg-muted' : 'hover:bg-muted'
                                            )}
                                            onClick={() => onItemClick(a.run)}
                                            onMouseEnter={() => setActive(idx)}
                                            title={a.path || a.hint || a.label}
                                        >
                                            <Icon name={a.icon || 'Circle'} size={16} className="text-muted-foreground" />
                                            <div className="flex-1 select-text">
                                                <div className="text-sm">{a.label}</div>
                                                {!!a.hint && <div className="text-[11px] text-muted-foreground">{a.hint}</div>}
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="p-2 border-t border-border text-[11px] text-muted-foreground">
                    Tip: Use <kbd className="px-1 bg-muted rounded">J</kbd>/<kbd className="px-1 bg-muted rounded">K</kbd> or ↑/↓ to move, <kbd className="px-1 bg-muted rounded">Enter</kbd> to run.
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;