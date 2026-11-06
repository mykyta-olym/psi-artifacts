// src/components/ui/NavigationBreadcrumb.jsx
import React, { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from 'contexts/AuthContext';

const routeLabels = {
  '/teacher-dashboard': 'Dashboard',
  '/student-dashboard': 'Dashboard',
  '/student-management': 'Student Management',
  '/faculty-management': 'Faculty Management',
  '/class-schedule-management': 'Class Schedule Management',
  '/attendance-tracking': 'Attendance Tracking',
  '/grade-management': 'Grade Management',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/help': 'Help',
  '/reports': 'Reports',

  // Custom labels requested
  '/anketa': 'Surveys',
  '/zapis': 'Course enrollment',
  '/terminy': 'Final evaluation enrollment',
};

const cx = (...a) => a.filter(Boolean).join(' ');

const buildCrumbs = (pathname, custom, homePath = '/') => {
  if (custom) return custom;
  const segments = pathname?.split('/')?.filter(Boolean) || [];
  const crumbs = [{ label: 'Home', path: homePath }];
  let current = '';
  segments.forEach((seg, i) => {
    current += `/${seg}`;
    const fallback = seg.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const label = routeLabels[current] || fallback;
    crumbs.push({ label, path: current, isLast: i === segments.length - 1 });
  });
  return crumbs;
};

const NavigationBreadcrumb = ({ customBreadcrumbs = null, className = '', mobileTitle, onOpenPalette }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const homePath =
      user?.role === 'teacher' ? '/teacher-dashboard' :
          user?.role === 'student' ? '/student-dashboard' :
              '/login';

  const crumbs = useMemo(
      () => buildCrumbs(location?.pathname, customBreadcrumbs, homePath),
      [location?.pathname, customBreadcrumbs, homePath]
  );

  const roleLabel = user?.role === 'teacher' ? 'Teacher' : user?.role === 'student' ? 'Student' : '';

  if (!crumbs || crumbs.length <= 1) return null;

  const prevCrumb = crumbs[crumbs.length - 2] || { path: homePath };
  const lastCrumb = crumbs[crumbs.length - 1];
  const title = mobileTitle || lastCrumb?.label || 'Back';

  const handleBack = () => {
    const state = window.history.state;
    const canBack = typeof state?.idx === 'number' ? state.idx > 0 : window.history.length > 1;
    if (canBack) navigate(-1);
    else navigate(prevCrumb.path || homePath, { replace: true });
  };

  const triggerPalette = () => {
    if (typeof onOpenPalette === 'function') {
      onOpenPalette();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('app:palette:open'));
    }
  };

  return (
      <>
        <nav
            className={cx('hidden sm:flex items-center justify-between gap-3 text-sm text-muted-foreground mb-4', className)}
            aria-label="Breadcrumb"
        >
          <ol className="flex items-center gap-2 overflow-x-auto">
            {crumbs.map((c, i) => (
                <li key={`${c.path}:${i}`} className="flex items-center gap-2 min-w-0">
                  {i > 0 && <Icon name="ChevronRight" size={14} className="text-muted-foreground/60 flex-shrink-0" />}
                  {c.isLast ? (
                      <span className="text-foreground font-medium truncate max-w-[40ch]">{c.label}</span>
                  ) : (
                      <Link
                          to={c.path}
                          className="hover:text-foreground transition-colors duration-200 truncate max-w-[28ch]"
                          title={c.label}
                      >
                        {c.label}
                      </Link>
                  )}
                </li>
            ))}
          </ol>
          {roleLabel && (
              <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/30 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {roleLabel}
              </span>
          )}
        </nav>

        <div className={cx('sm:hidden mb-3', className)}>
          <div
              className="
            sticky top-2 z-30
            mx-[-.25rem]
            rounded-xl border border-border
            bg-background/70 supports-[backdrop-filter]:backdrop-blur
            px-2 py-1.5
            shadow-card
          "
              role="navigation"
              aria-label="Mobile breadcrumb"
          >
            <div className="flex items-center gap-2">
              <button
                  type="button"
                  onClick={handleBack}
                  className="
                inline-flex items-center justify-center
                w-10 h-10 rounded-full
                border border-border bg-muted/50
                text-foreground hover:bg-muted
                active:scale-[.98] transition
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
              "
                  aria-label="Go back"
                  title="Back"
              >
                <Icon name="ChevronLeft" size={18} />
              </button>

              <div className="flex-1 min-w-0 px-1">
                <div className="text-sm font-semibold text-foreground truncate" title={title}>
                  {title}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                  <span className="truncate">{prevCrumb?.label || 'Home'}</span>
                  {roleLabel && (
                      <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {roleLabel}
                      </span>
                  )}
                </div>
              </div>

              <button
                  type="button"
                  onClick={triggerPalette}
                  className="
                inline-flex items-center justify-center
                w-10 h-10 rounded-full
                border border-border bg-muted/50
                text-foreground hover:bg-muted
                active:scale-[.98] transition
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
              "
                  aria-label="Command palette"
                  title="Command palette"
              >
                <Icon name="Command" size={18} />
              </button>
            </div>
          </div>
        </div>
      </>
  );
};

export default NavigationBreadcrumb;