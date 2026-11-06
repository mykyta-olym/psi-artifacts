// src/components/ui/QuickActionPanel.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';
import Input from './Input';
import { useAuth } from '../../contexts/AuthContext';
import useUserPreference from '../../hooks/useUserPreference';
import {
  fetchStudents,
  fetchFaculty,
  fetchCourses,
  fetchScheduleEvents,
  fetchRooms,
} from '../../data/maisApiAdapter';
import { fetchPrograms } from '../../data/programsApi';
import { fetchDepartments } from '../../data/departmentsApi';
import { cn } from '../../utils/cn';
import useSelectedStudyValue from '../../hooks/useSelectedStudyValue';

const RECENTS_LIMIT = 10;
const SUGGEST_LIMIT = 8;

const stripCourseCode = (txt = '') =>
    String(txt).replace(/\s*[([]\s*\d{5,}\s*[)\]]\s*/g, ' ').replace(/\b\d{5,}\b/g, ' ').replace(/\s+/g, ' ').trim();

const norm = (s = '') =>
    String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const roleOf = (u) => (u?.role === 'teacher' ? 'teacher' : 'student');

const isBcInf = (rec) => String(rec?.programCode || '').toLowerCase() === 'inf_bc_d_sk';

const TITLE_PREFIXES = /^(?:Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|Mgr\. art\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+/gi;
const TITLE_SUFFIXES = /\s*,\s*(?:PhD\.|CSc\.|DrSc\.|ThDr\.|ArtD\.)$/i;
const stripTitles = (name = '') => String(name || '').replace(TITLE_PREFIXES, '').replace(TITLE_SUFFIXES, '').trim();

const QuickActionPanel = ({ userRole, className = '', onQuickAction }) => {
  const { user } = useAuth();
  const detectedRole = roleOf(user);
  const role = userRole || detectedRole;

  const [searchQuery, setSearchQuery] = useState('');
  const recentsPref = useUserPreference('quick.recents', []);
  const recents = useMemo(
    () => (Array.isArray(recentsPref.value) ? recentsPref.value.filter((x) => x?.term).slice(0, RECENTS_LIMIT) : []),
    [recentsPref.value],
  );
  const { value: selectedStudy } = useSelectedStudyValue();
  const [highlight, setHighlight] = useState(-1);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();

  const [studentsData, setStudentsData] = useState([]);
  const [facultyData, setFacultyData] = useState([]);
  const [coursesData, setCoursesData] = useState([]);
  const [roomsData, setRoomsData] = useState([]);
  const [scheduleData, setScheduleData] = useState([]);
  const [programsData, setProgramsData] = useState([]);
  const [departmentsData, setDepartmentsData] = useState([]);

  const handleNavigate = useCallback((nextPath = '', params = '') => {
    if (!nextPath) return;
    const target = `${nextPath}${params || ''}`;
    navigate(target);
  }, [navigate]);

  const handleActionTrigger = useCallback((action) => {
    if (!action) return;
    handleNavigate(action.path, action.params);
    onQuickAction?.(action.id, action.label);
  }, [handleNavigate, onQuickAction]);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (!user?.email) return;
    
    let cancelled = false;
    (async () => {
      try {
        const [stud, fac, crs, rms, sch, progs, depts] = await Promise.all([
          fetchStudents({ page: 1, pageSize: 250, sort: 'fullName', order: 'asc' }).catch(() => []),
          fetchFaculty({ page: 1, pageSize: 250, sort: 'fullName', order: 'asc' }).catch(() => []),
          fetchCourses().catch(() => []),
          fetchRooms().catch(() => []),
          fetchScheduleEvents().catch(() => []),
          fetchPrograms().catch(() => []),
          fetchDepartments().catch(() => []),
        ]);
        if (cancelled) return;
        setStudentsData(Array.isArray(stud) ? stud : []);
        setFacultyData(Array.isArray(fac) ? fac : []);
        setCoursesData(Array.isArray(crs) ? crs : []);
        setRoomsData(Array.isArray(rms) ? rms : []);
        setScheduleData(Array.isArray(sch) ? sch : []);
        setProgramsData(Array.isArray(progs) ? progs : []);
        setDepartmentsData(Array.isArray(depts) ? depts : []);
      } catch {
        if (!cancelled) {
          setStudentsData([]);
          setFacultyData([]);
          setCoursesData([]);
          setRoomsData([]);
          setScheduleData([]);
          setProgramsData([]);
          setDepartmentsData([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  const quickActions = useMemo(() => ({
    teacher: [
      { id: 'chat-center', label: 'Chats', icon: 'MessageSquare', path: '/chat' },
      { id: 'chat-new', label: 'New Chat', icon: 'MessageSquarePlus', path: '/chat', params: '?compose=1' },
      { id: 'students', label: 'Students', icon: 'Users', path: '/student-management' },
      { id: 'add-student', label: 'Add Student', icon: 'UserPlus', path: '/student-management', params: '?action=add' },
      { id: 'faculty-open', label: 'Faculty', icon: 'UserCog', path: '/faculty-management' },
      { id: 'add-faculty', label: 'Add Faculty', icon: 'UserPlus', path: '/faculty-management', params: '?action=add' },
      { id: 'attendance', label: 'Attendance', icon: 'CheckSquare', path: '/attendance-tracking' },
      { id: 'schedule', label: 'Schedule', icon: 'Calendar', path: '/class-schedule-management' },
      { id: 'grades', label: 'Grades', icon: 'BookOpen', path: '/grade-management' },
      { id: 'print-reports-teacher', label: 'Print Reports', icon: 'Printer', path: '/print-reports' },
      { id: 'resources', label: 'Resources', icon: 'Database', path: '/resource-management' },
      { id: 'final-thesis-teacher', label: 'Final Thesis', icon: 'ScrollText', path: '/final-thesis/teacher' },
      { id: 'surveys', label: 'Surveys', icon: 'Clipboard', path: '/anketa' },
      { id: 'activities', label: 'Activities', icon: 'BarChart3', path: '/activities' },
      { id: 'help-support', label: 'Help & Support', icon: 'HelpCircle', path: '/help' }
    ],
    student: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/student-dashboard' },
      { id: 'student-studies', label: 'Student Studies', icon: 'GraduationCap', path: '/student-studies' },
      { id: 'print-reports', label: 'Print Reports', icon: 'Printer', path: '/print-reports' },
      { id: 'final-thesis', label: 'Final Thesis', icon: 'FileText', path: '/final-thesis' },
      { id: 'surveys', label: 'Surveys', icon: 'Clipboard', path: '/anketa' },
      { id: 'help-support', label: 'Help & Support', icon: 'HelpCircle', path: '/help' },
      { id: 'students', label: 'Students', icon: 'Users', path: '/student-management' },
      { id: 'faculty-open', label: 'Faculty', icon: 'UserCog', path: '/faculty-management' },
      { id: 'activities', label: 'Activities', icon: 'BarChart3', path: '/activities' },
      { id: 'schedule', label: 'Schedule', icon: 'Calendar', path: '/class-schedule-management' },
      { id: 'Final evaluation enrollment', label: 'Termíny', icon: 'CalendarDays', path: '/terminy' },
      { id: 'Course enrollment', label: 'Zápis', icon: 'FileStack', path: '/zapis' },
    ],
  }), []);

  const baseActions = quickActions?.[role] || quickActions.teacher;
  const actions = useMemo(() => {
    const isArchivedStudy = !!selectedStudy && selectedStudy.ongoing === false;
    const limitStudentMenu = role === 'student' && (isBcInf(selectedStudy) || isArchivedStudy);
    const allowedStudentPaths = new Set([
      '/student-dashboard',
      '/student-studies',
      '/print-reports',
      '/final-thesis',
      '/anketa',
      '/help',
      '/student-management',
      '/faculty-management',
    ]);
    const filtered = limitStudentMenu
      ? baseActions.filter((a) => !a.path || allowedStudentPaths.has(a.path))
      : baseActions;
    if (!isArchivedStudy) return filtered;
    const restrictedPaths = new Set(['/chat', '/activities']);
    return filtered.filter((action) => !action.path || !restrictedPaths.has(action.path));
  }, [baseActions, role, selectedStudy]);

  const persistRecentNow = (term) => {
    const t = String(term || '').trim();
    if (!t) return;
    const withoutDup = recents.filter((r) => r?.term?.toLowerCase() !== t.toLowerCase());
    const updated = [{ term: t, ts: Date.now() }, ...withoutDup].slice(0, RECENTS_LIMIT);
    recentsPref.setValue(updated);
  };

  const removeRecent = (term) => {
    const t = String(term || '').trim().toLowerCase();
    const updated = recents.filter((r) => (r?.term || '').toLowerCase() !== t);
    recentsPref.setValue(updated);
  };

  const clearRecents = () => {
    recentsPref.setValue([]);
  };

  const globalIndex = useMemo(() => {
    const items = [];

    (studentsData || []).forEach((s) => {
      const given = s.givenName || s.firstName || '';
      const family = s.familyName || s.lastName || '';
      const baseName = `${given} ${family}`.trim();
      const titleRaw = baseName || s.fullName || s.displayName || s.name || '';
      const title = stripTitles(titleRaw);
      items.push({
        type: 'student',
        icon: 'User',
        title,
        subtitle: s.email || '',
        key: `stu:${s.id}`,
        nav: () => navigate(`/student-management?search=${encodeURIComponent(baseName || title)}`),
        hay: norm([titleRaw, s.email].join(' '))
      });
    });

    (facultyData || []).forEach((f) => {
      const baseName = `${f.givenName || ''} ${f.familyName || ''}`.trim();
      const titleRaw = baseName || f.fullName || f.displayName || f.name || '';
      const title = stripTitles(titleRaw);
      items.push({
        type: 'faculty',
        icon: 'UserCheck',
        title,
        subtitle: f.email || '',
        key: `fac:${f.id}`,
        nav: () => navigate(`/faculty-management?search=${encodeURIComponent(baseName || title)}`),
        hay: norm([titleRaw, f.email, ...(f.departments || [])].join(' '))
      });
    });

    (coursesData || []).forEach((c) => {
      const name = stripCourseCode(c.nameEn || c.nameSk || '');
      const courseNav = role === 'teacher' 
        ? () => navigate(`/resource-management?tab=courses&search=${encodeURIComponent(c.code)}`)
        : () => navigate(`/class-schedule-management?course=${encodeURIComponent(c.code)}`);
      
      items.push({
        type: 'course',
        icon: 'BookOpen',
        title: name,
        subtitle: c.code || '',
        key: `crs:${c.code}`,
        nav: courseNav,
        hay: norm([name, c.code].join(' '))
      });
    });

    (roomsData || []).forEach((r) => {
      items.push({
        type: 'room',
        icon: 'Building2',
        title: r.name,
        subtitle: r.type || '',
        key: `room:${r.id || r.name}`,
        nav: () => navigate(`/class-schedule-management?room=${encodeURIComponent(r.name)}`),
        hay: norm([r.name, r.type].join(' '))
      });
    });

    (scheduleData || []).forEach((t) => {
      const course = (coursesData || []).find((c) => c.code === t.courseCode);
      const courseName = stripCourseCode(course?.nameEn || course?.nameSk || t.courseCode);
      const title = `${courseName} • ${t.day} ${t.slot}`;
      items.push({
        type: 'schedule',
        icon: 'Calendar',
        title,
        subtitle: `Room: ${t.room}`,
        key: `slot:${t.day}|${t.slot}|${t.courseCode}`,
        nav: () =>
            navigate(
                `/class-schedule-management?course=${encodeURIComponent(t.courseCode)}&day=${encodeURIComponent(t.day)}&time=${encodeURIComponent(t.slot)}`
            ),
        hay: norm([courseName, t.room, t.day, t.slot, t.courseCode].join(' '))
      });
    });

    (programsData || []).forEach((p) => {
      const title = p.name || '';
      items.push({
        type: 'program',
        icon: 'GraduationCap',
        title,
        subtitle: p.code || p.level || '',
        key: `prog:${p.id || p.code}`,
        nav: () => navigate(`/student-management?program=${encodeURIComponent(p.code || p.name)}`),
        hay: norm([title, p.code, p.level, p.faculty].join(' '))
      });
    });

    (departmentsData || []).forEach((d) => {
      const title = d.name || '';
      items.push({
        type: 'department',
        icon: 'Building',
        title,
        subtitle: d.faculty || d.code || '',
        key: `dept:${d.id || d.code}`,
        nav: () => navigate(`/faculty-management?department=${encodeURIComponent(d.name || d.code)}`),
        hay: norm([title, d.code, d.faculty].join(' '))
      });
    });

    return items;
  }, [studentsData, facultyData, coursesData, roomsData, scheduleData, programsData, departmentsData, navigate]);

  const computeSuggestions = useCallback(
    (query, { limit = SUGGEST_LIMIT, grouped = true } = {}) => {
      const q = norm(query);
      if (!q) return [];
      const scored = [];

      for (const it of globalIndex) {
        const idx = it.hay.indexOf(q);
        if (idx === -1) continue;
        let score = 1000 - idx - Math.min(it.title.length, 60);
        // eslint-disable-next-line no-useless-escape
        if (new RegExp(`(^|\\s)${q}`).test(it.hay)) score += 200;
        if (it.type === 'student') score += 50;
        if (it.type === 'faculty') score += 40;
        if (it.type === 'program') score += 35;
        if (it.type === 'department') score += 33;
        if (it.type === 'course') score += 30;
        scored.push({ ...it, _score: score });
      }

      scored.sort((a, b) => b._score - a._score);
      if (!grouped) return scored.slice(0, limit);

      const groups = [
        { id: 'student', label: 'Students' },
        { id: 'faculty', label: 'Faculty' },
        { id: 'program', label: 'Programs' },
        { id: 'department', label: 'Departments' },
        { id: 'course', label: 'Courses' },
        { id: 'room', label: 'Rooms' },
        { id: 'schedule', label: 'Schedule' }
      ];

      const out = [];
      for (const g of groups) {
        const part = scored.filter((x) => x.type === g.id).slice(0, 3);
        out.push(...part);
        if (out.length >= limit) break;
      }
      return out.slice(0, limit);
    },
    [globalIndex]
  );

  const suggestions = useMemo(() => computeSuggestions(searchQuery), [searchQuery, computeSuggestions]);

  const goEverywhere = (term, suggestionList) => {
    const t = String(term || '').trim();
    if (!t) return;

    const list = suggestionList && suggestionList.length ? suggestionList : computeSuggestions(t, { grouped: true, limit: SUGGEST_LIMIT });
    let best = list[0];
    if (!best) {
      const fallback = computeSuggestions(t, { grouped: false, limit: 1 });
      best = fallback[0];
    }
    if (!best) {
      setSearchQuery(t);
      return;
    }
    persistRecentNow(best.title);
    onQuickAction?.('search', best.title);
    best.nav();
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    const term = searchQuery?.trim();
    if (!term) return;
    goEverywhere(term, suggestions);
    setSearchQuery('');
  };

  const handleSearchWith = (term) => {
    const clean = String(term || '').trim();
    if (!clean) return;
    goEverywhere(clean);
    setSearchQuery('');
  };

  const onKeyDown = (e) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(suggestions.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < suggestions.length) {
        e.preventDefault();
        const picked = suggestions[highlight];
        persistRecentNow(picked.title);
        onQuickAction?.('search', picked.title);
        picked.nav();
        setSearchQuery('');
      }
    } else if (e.key === 'Escape') {
      setHighlight(-1);
    }
  };

  const lastUpdatedTime = useMemo(() => {
    const ts = recents.length ? recents.reduce((m, r) => Math.max(m, r.ts || 0), 0) : Date.now();
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [recents]);

  return (
      <MotionConfig transition={{ type: prefersReduced ? 'tween' : 'spring', duration: prefersReduced ? 0.35 : undefined, stiffness: 110, damping: 18, mass: 0.6 }}>
        <div className={cn('bg-card rounded-lg border border-border p-6', className)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
            <Icon name="Zap" size={20} className="text-accent" />
          </div>

          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))] gap-3 mb-4">
            {actions?.map((action) => (
                <motion.div key={action?.id} whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.995 }} className="transform-gpu will-change-transform">
                  <Button
                      variant="outline"
                      onClick={() => handleActionTrigger(action)}
                      className="h-20 p-3 group overflow-hidden w-full"
                  >
                    <div className="w-full min-w-0 flex flex-col items-center justify-center">
                      <motion.span whileHover={{ scale: 1.06, rotate: 0.001 }} className="mb-2">
                        <Icon name={action?.icon} size={20} className="text-primary group-hover:opacity-90 transition-opacity" />
                      </motion.span>
                      <span className="text-[11px] sm:text-xs font-medium text-center leading-tight min-w-0 w-full break-words line-clamp-2">
                    {action?.label}
                  </span>
                    </div>
                    <motion.span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100" />
                  </Button>
                </motion.div>
            ))}
          </div>

          <div className="border-t border-border pt-4 relative">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input
                  type="text"
                  placeholder="Search students, faculty, programs, departments, courses…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e?.target?.value);
                    setHighlight(-1);
                  }}
                  onKeyDown={onKeyDown}
                  className="flex-1"
                  leadingIcon="Search"
              />
              <Button type="submit" variant="default" iconName="Search" disabled={!searchQuery?.trim()}>
                Search
              </Button>
            </form>

            {Boolean(searchQuery.trim() || suggestions.length > 0) && (
                <div ref={listRef} className="absolute mt-2 left-0 right-0 z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-modal overflow-hidden">
                  {suggestions.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground flex items-center justify-between">
                        <span>No results</span>
                        <Button size="xs" variant="outline" iconName="Globe" onClick={() => handleSearchWith(searchQuery)}>
                          Search everywhere
                        </Button>
                      </div>
                  ) : (
                      <ul className="max-h-80 overflow-auto">
                        {suggestions.map((s, idx) => (
                            <li key={s.key}>
                              <button
                                  type="button"
                                  onClick={() => {
                                    persistRecentNow(s.title);
                                    onQuickAction?.('search', s.title);
                                    s.nav();
                                    setSearchQuery('');
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${idx === highlight ? 'bg-muted' : ''}`}
                              >
                        <span className="w-5 flex items-center justify-center shrink-0">
                          <Icon name={s.icon} size={16} className="opacity-80" />
                        </span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{s.title}</div>
                                  {s.subtitle && <div className="text-xs text-muted-foreground truncate">{s.subtitle}</div>}
                                </div>
                                <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground">{s.type}</span>
                              </button>
                            </li>
                        ))}
                      </ul>
                  )}
                </div>
            )}

            <div className="mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Recent</span>
                {recents.length > 0 && (
                    <button
                        type="button"
                        onClick={clearRecents}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Clear all recent searches"
                    >
                      Clear all
                    </button>
                )}
              </div>

              {recents.length === 0 ? (
                  <div className="mt-2 text-xs text-muted-foreground italic">No recent searches yet.</div>
              ) : (
                  <div className="mt-1 text-xs">
                    {recents
                        .slice()
                        .sort((a, b) => b.ts - a.ts)
                        .map(({ term }, i) => (
                            <span key={term} className="inline-flex items-center mr-3 mb-1 max-w-[40vw] sm:max-w-none">
                      <button
                          type="button"
                          className="text-primary hover:text-primary/80 transition-colors truncate"
                          onClick={() => handleSearchWith(term)}
                          title={`Search "${term}"`}
                      >
                        {term}
                      </button>
                      <button
                          type="button"
                          onClick={() => removeRecent(term)}
                          className="ml-1 opacity-60 hover:opacity-100 shrink-0"
                          aria-label={`Remove "${term}"`}
                          title="Remove"
                      >
                        <Icon name="X" size={12} />
                      </button>
                              {i < recents.length - 1 && <span className="ml-2 text-muted-foreground">•</span>}
                    </span>
                        ))}
                  </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-success"></div>
                <span className="text-muted-foreground">System Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="status-indicator bg-accent"></div>
                <span className="text-muted-foreground">3 Pending</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Last updated: {lastUpdatedTime}</div>
          </div>
        </div>
      </MotionConfig>
  );
};

export default memo(QuickActionPanel);