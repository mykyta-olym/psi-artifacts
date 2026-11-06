// src/components/ui/RoleSidebar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import useUserPreference from '../../hooks/useUserPreference';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';

const SIDEBAR_CSS = `
sb styles...
`.replace('sb styles...', `
.sb{
  position:fixed; left:0; z-index:76;
  border-right:1px solid rgba(255,255,255,.14);
  background: rgba(12,26,40,.60);
  backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%);
  box-shadow: 0 22px 60px rgba(0,0,0,.35);
  display:flex; flex-direction:column;
  will-change: width;
  overflow-x:hidden; overflow-y:hidden;
  contain: layout paint;
  overscroll-behavior: contain;
}
.sb__hdr{ display:flex; align-items:center; justify-content:space-between; padding:.9rem 1rem; border-bottom:1px solid rgba(255,255,255,.14) }
.sb__title{ font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; font-weight:700; color:rgba(255,255,255,.7) }
.sb__groupTitle{ padding:0 1rem; margin:.5rem 0 .25rem; font-size:.7rem; color:rgba(255,255,255,.6); text-transform:uppercase; letter-spacing:.08em; font-weight:700 }
.sb__link{
  display:flex; align-items:center; gap:.75rem;
  border-radius:.6rem; padding:.5rem .6rem; font-size:.92rem;
  color:rgba(255,255,255,.82);
  transition: background .18s ease, color .18s ease;
}
.sb__link:hover:not(.sb__link--active){ color:#fff; background: rgba(255,255,255,.08) }
.sb__link--active,
.sb__link--active:hover{ background: rgba(14,165,233,.80); color:#fff; box-shadow: 0 10px 26px rgba(14,165,233,.35) }
.sb__badge{
  min-width:1.2rem; height:1.2rem; padding:0; font-size:.68rem; border-radius:9999px;
  display:grid; place-items:center; background:#FBBF24; color:#111; font-weight:700;
}
.mbar{
  position:fixed; inset-inline:0; bottom:0; z-index:78;
  border-top:1px solid rgba(255,255,255,.14);
  background: rgba(10,22,34,.82);
  backdrop-filter: blur(12px) saturate(160%); -webkit-backdrop-filter: blur(12px) saturate(160%);
}
.mbar__wrap{ display:flex; align-items:center; justify-content:space-around; padding:.4rem .4rem; padding-bottom: calc(env(safe-area-inset-bottom, 0) + .25rem); }
.mbar__item{
  min-width:0; flex:1 1 0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:.2rem; padding:.35rem .35rem; border-radius:.6rem; color:rgba(255,255,255,.8);
  transition: background .18s ease, color .18s ease;
}
.mbar__item:hover:not(.mbar__item--active){ color:#fff; background: rgba(255,255,255,.08) }
.mbar__item--active,
.mbar__item--active:hover{ color:#111; background:#38BDF8; }
.mbar__lbl{ font-size:.72rem; line-height:1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.sb .scroll{ scrollbar-width:thin; scrollbar-color: rgba(255,255,255,.25) transparent }
.sb .scroll::-webkit-scrollbar{ width:8px; height:8px }
.sb .scroll::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.22); border-radius:9999px }
.sb .scroll::-webkit-scrollbar-track{ background: transparent }
`);

const cx = (...a) => a.filter(Boolean).join(' ');
const isBcInf = (rec) => String(rec?.programCode || '').toLowerCase() === 'inf_bc_d_sk';

const baseSections = {
    teacher: [
        { title: 'Dashboard', items: [
                { label: 'Teacher Dashboard', path: '/teacher-dashboard', icon: 'LayoutDashboard' },
            ]},
        { title: 'Students', items: [
                { label: 'Student Management', path: '/student-management', icon: 'Users' },
            ]},
        { title: 'Communication', items: [
                { label: 'Chat', path: '/chat', icon: 'MessageSquare' },
                { label: 'New Chat', path: '/chat?compose=1', icon: 'MessageSquarePlus' },
            ]},
        { title: 'Faculty', items: [
                { label: 'Faculty Management', path: '/faculty-management', icon: 'UserCog' },
            ]},
        { title: 'Academics', items: [
                { label: 'Class Schedule', path: '/class-schedule-management', icon: 'Calendar' },
                { label: 'Attendance Tracking', path: '/attendance-tracking', icon: 'CheckSquare' },
                { label: 'Grade Management', path: '/grade-management', icon: 'BookOpen' },
                { label: 'Print Reports', path: '/print-reports', icon: 'Printer' },
                { label: 'Final Thesis', path: '/final-thesis/teacher', icon: 'ScrollText' },
                { label: 'Exam Terms', path: '/terminy/teacher', icon: 'CalendarDays' },
                { label: 'Surveys', path: '/anketa', icon: 'Clipboard' },
            ]},
        { title: 'Resources', items: [
                { label: 'Resource Management', path: '/resource-management', icon: 'Database' },
            ]},
        { title: 'Activities', items: [
                { label: 'Activities', path: '/activities', icon: 'BarChart3' },
            ]},
        { title: 'Help', items: [
                { label: 'Help Center', path: '/help', icon: 'HelpCircle' },
            ]},
    ],
    student: [
        { title: 'Dashboard', items: [
                { label: 'Student Dashboard', path: '/student-dashboard', icon: 'LayoutDashboard' },
            ]},
        { title: 'Academics', items: [
                { label: 'Schedule', path: '/class-schedule-management', icon: 'Calendar' },
                { label: 'Student Studies', path: '/student-studies', icon: 'GraduationCap' },
                { label: 'Print Reports', path: '/print-reports', icon: 'Printer' },
                { label: 'Final Thesis', path: '/final-thesis', icon: 'FileText' },
                { label: 'Final evaluation enrollment', path: '/terminy', icon: 'CalendarDays' },
                { label: 'Course enrollment', path: '/zapis', icon: 'FileStack' },
                { label: 'Surveys', path: '/anketa', icon: 'Clipboard' },
            ]},
        { title: 'Communication', items: [
                { label: 'Chat', path: '/chat', icon: 'MessageSquare' },
                { label: 'New Chat', path: '/chat?compose=1', icon: 'MessageSquarePlus' },
            ]},
        { title: 'Students', items: [
                { label: 'Student Management', path: '/student-management', icon: 'Users' },
            ]},
        { title: 'Faculty', items: [
                { label: 'Faculty Management', path: '/faculty-management', icon: 'UserCog' },
            ]},
        { title: 'Activities', items: [
                { label: 'Activities', path: '/activities', icon: 'BarChart3' },
            ]},
        { title: 'Help', items: [
                { label: 'Help Center', path: '/help', icon: 'HelpCircle' },
            ]},
    ],
};

const normalizeCategory = (n) => {
    const c = String(n?.category || n?.type || '').toLowerCase();
    if (['messages','announcements','alerts','attendance','grades'].includes(c)) return c;
    return 'alerts';
};

const RoleSidebar = ({ isCollapsed: isCollapsedProp, onToggleCollapse, className = '' }) => {
    const { user } = useAuth();
    const notificationsContext = useNotifications();
    const { notifications = [], activityFeed = [] } = notificationsContext || {};
    const location = useLocation();
    const shouldReduceMotion = useReducedMotion();
    const role = user?.role === 'teacher' ? 'teacher' : 'student';

    useEffect(() => {
        if (!document.getElementById('sb-inline-styles')) {
            const s = document.createElement('style');
            s.id = 'sb-inline-styles';
            s.textContent = SIDEBAR_CSS;
            document.head.appendChild(s);
        }
    }, []);

    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize, { passive: true });
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const sidebarCollapsedPreference = useUserPreference('ui.sidebar.collapsed', false);
    const [collapsedState, setCollapsedState] = useState(() => !!sidebarCollapsedPreference.value);
    useEffect(() => {
        setCollapsedState(!!sidebarCollapsedPreference.value);
    }, [sidebarCollapsedPreference.value]);
    const collapsed = typeof isCollapsedProp === 'boolean' ? isCollapsedProp : collapsedState;
    const setCollapsed = (next) => {
        if (typeof isCollapsedProp === 'boolean') {
            onToggleCollapse?.(next);
        } else {
            setCollapsedState(next);
            sidebarCollapsedPreference.setValue(next);
            onToggleCollapse?.(next);
        }
    };

    const expandedWidth = 288;
    const collapsedWidth = 64;

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (isMobile) {
            root.style.setProperty('--sidebar-offset', '0px');
            body.classList.remove('sidebar-active');
            return () => {
                root.style.removeProperty('--sidebar-offset');
                body.classList.remove('sidebar-active');
            };
        }
        const offset = collapsed ? collapsedWidth : expandedWidth;
        root.style.setProperty('--sidebar-offset', `${offset}px`);
        body.classList.add('sidebar-active');
        return () => {
            root.style.removeProperty('--sidebar-offset');
            body.classList.remove('sidebar-active');
        };
    }, [isMobile, collapsed, collapsedWidth, expandedWidth]);

    const counts = useMemo(() => {
        let messages = 0, alerts = 0, announcements = 0, grades = 0, attendance = 0;
        (notifications || []).forEach(n => {
            if (!n?.unread) return;
            const cat = normalizeCategory(n);
            if (cat === 'messages') messages++;
            if (cat === 'announcements') announcements++;
            if (cat === 'alerts') alerts++;
            if (cat === 'grades') grades++;
            if (cat === 'attendance') attendance++;
            if (cat === 'alerts' && String(n?.meta?.status || '').toLowerCase() === 'absent') attendance++;
        });
        const needAction = (activityFeed || []).filter(a => a?.requiresAction).length;
        return { messages, alerts, announcements, grades, attendance, needAction };
    }, [notifications, activityFeed]);

    const { value: selectedStudy, loading: selectedStudyLoading } = useSelectedStudyValue();
    const isArchivedStudy = role === 'student' && !!selectedStudy && selectedStudy.ongoing === false;
    const limitStudentMenu = role === 'student' && (isBcInf(selectedStudy) || isArchivedStudy);
    const allowedStudentPaths = new Set([
        '/student-dashboard',
        '/student-studies',
        '/print-reports',
        '/student-management',
        '/faculty-management',
        '/final-thesis',
        '/anketa',
        '/help',
    ]);

    const sections = useMemo(() => {
        const src = baseSections[role] || baseSections.student;
        const mapBadge = (item) => {
            const p = item.path || '';
            if (p.startsWith('/chat') && p.includes('compose=1')) return { ...item, badge: undefined };
            let badge = undefined;
            if (p === '/chat') badge = counts.messages;
            else if (p === '/attendance-tracking') badge = counts.attendance || counts.alerts || undefined;
            else if (p === '/grade-management') badge = counts.grades || undefined;
            else if (p === '/student-studies') badge = counts.grades || undefined;
            else if (p === '/activities') badge = counts.needAction || undefined;
            else if (p === '/class-schedule-management') badge = counts.announcements || undefined;
            else if (p === '/terminy') badge = counts.announcements || undefined;
            return { ...item, badge: badge && badge > 0 ? badge : undefined };
        };
        const withBadges = src.map(section => ({ ...section, items: section.items.map(mapBadge) }));
        let filteredSections = withBadges;
        if (limitStudentMenu) {
            filteredSections = filteredSections
                .map(sec => ({
                    ...sec,
                    items: sec.items.filter(i => allowedStudentPaths.has((i.path || '').split('?')[0]))
                }))
                .filter(sec => sec.items.length > 0);
        }
        if (isArchivedStudy) {
            const restricted = new Set(['/chat', '/activities']);
            filteredSections = filteredSections
                .map(sec => ({
                    ...sec,
                    items: sec.items.filter(i => !restricted.has((i.path || '').split('?')[0]))
                }))
                .filter(sec => sec.items.length > 0);
        }
        return filteredSections;
    }, [role, counts, limitStudentMenu, isArchivedStudy]);

    const normPath = (p) => {
        if (!p) return '/';
        if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
        return p;
    };

    const splitPath = (p) => {
        const [path, q = ''] = (p || '').split('?');
        return { path: normPath(path), params: new URLSearchParams(q) };
    };

    const current = { path: normPath(location.pathname), params: new URLSearchParams(location.search) };

    const itemsWithQueryByBase = useMemo(() => {
        const map = new Map();
        for (const s of sections) {
            for (const it of s.items) {
                const { path, params } = splitPath(it.path);
                if ([...params.keys()].length === 0) continue;
                if (!map.has(path)) map.set(path, []);
                map.get(path).push({ item: it, params });
            }
        }
        return map;
    }, [sections]);

    const queryMatches = (targetParams, currentParams) => {
        for (const [k, v] of targetParams.entries()) {
            if (currentParams.get(k) !== v) return false;
        }
        return true;
    };

    const isActive = (fullPath) => {
        if (!fullPath) return false;
        const tgt = splitPath(fullPath);
        const pathMatch = current.path === tgt.path || current.path.startsWith(tgt.path + '/');
        if ([...tgt.params.keys()].length > 0) {
            if (!pathMatch) return false;
            return queryMatches(tgt.params, current.params);
        }
        if (!pathMatch) return false;
        const qItems = itemsWithQueryByBase.get(tgt.path) || [];
        for (const qi of qItems) {
            if (queryMatches(qi.params, current.params)) return false;
        }
        return true;
    };

    if (isMobile) {
        const picksByRole = {
            teacher: [
                '/teacher-dashboard',
                '/attendance-tracking',
                '/class-schedule-management',
                '/print-reports',
                '/chat',
                '/final-thesis/teacher',
            ],
            student: [
                '/student-dashboard',
                '/student-studies',
                '/print-reports',
                '/final-thesis',
                '/anketa',
            ],
        };

        const all = sections.flatMap(s => s.items);
        const byPath = new Map(all.map(i => [i.path, i]));
        const findByPathLoose = (p) => {
            if (byPath.has(p)) return byPath.get(p);
            const want = p.split('?')[0];
            for (const it of all) {
                const base = (it.path || '').split('?')[0];
                if (base === want) return it;
            }
            return null;
        };

        const ordered = [];
        const seen = new Set();
        for (const p of (picksByRole[role] || [])) {
            const it = findByPathLoose(p);
            if (it && !seen.has(it.path)) {
                if (it.path === '/chat?compose=1') continue;
                ordered.push(it);
                seen.add(it.path);
            }
            if (ordered.length >= 5) break;
        }

        if (ordered.length < 5) {
            for (const it of all) {
                if (it.path === '/chat?compose=1') continue;
                if (seen.has(it.path)) continue;
                ordered.push(it);
                seen.add(it.path);
                if (ordered.length >= 5) break;
            }
        }

        return (
            <nav className="mbar" role="navigation" aria-label="Primary">
                <div className="mbar__wrap">
                    {ordered.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cx('mbar__item', active && 'mbar__item--active')}
                                title={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                <div className="relative">
                                    <Icon name={item.icon} size={20} color="currentColor" />
                                    {!!item.badge && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-black text-[10px] grid place-items-center font-bold">
                      {item.badge}
                    </span>
                                    )}
                                </div>
                                <span className="mbar__lbl">{(item.label || '').split(' ')[0]}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        );
    }

    const transition = shouldReduceMotion
        ? { duration: 0 }
        : { type: 'spring', stiffness: 640, damping: 36, mass: 0.6 };

    return (
        <motion.aside
            className={cx('sb', 'top-16 md:top-[72px] bottom-0', className)}
            aria-label="Sidebar"
            initial={false}
            animate={{ width: collapsed ? collapsedWidth : expandedWidth }}
            transition={transition}
        >
            <div className="sb__hdr">
                {!collapsed && <h2 className="sb__title">Navigation</h2>}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="ml-auto text-white/85 hover:text-white hover:bg-white/10"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={collapsed ? 'Expand' : 'Collapse'}
                    type="button"
                >
                    <Icon name={collapsed ? 'ChevronRight' : 'ChevronLeft'} size={16} color="currentColor" />
                </Button>
            </div>

            <nav className="flex-1 overflow-y-auto thin-scrollbar py-3" role="navigation">
                <div className="space-y-5">
                    {sections.map((section) => (
                        <div key={section.title} className="px-2">
                            {!collapsed && (
                                <div className="sb__groupTitle">
                                    {section.title}
                                </div>
                            )}
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={cx('sb__link', active && 'sb__link--active')}
                                            title={collapsed ? item.label : undefined}
                                            aria-current={active ? 'page' : undefined}
                                        >
                                            <div className="relative shrink-0 grid place-items-center w-6">
                                                <Icon name={item.icon} size={18} color="currentColor" />
                                                {collapsed && !!item.badge && (
                                                    <span className="absolute -top-1.5 -right-1.5 sb__badge">{item.badge}</span>
                                                )}
                                            </div>
                                            {!collapsed && (
                                                <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                                                    <span className="truncate">{item.label}</span>
                                                    {!!item.badge && <span className="sb__badge">{item.badge}</span>}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>

            <div className="px-3 py-3 border-t border-white/14">
                <div className={cx('flex items-center gap-3', collapsed && 'justify-center')}>
                    <div className="shrink-0 grid w-8 h-8 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                        <Icon name="User" size={16} color="#fff" />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-white/95 capitalize">{role} Portal</p>
                            <p className="text-[12px] text-white/70">MAIS 2.0</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.aside>
    );
};

export default RoleSidebar;