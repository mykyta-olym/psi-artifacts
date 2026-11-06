// src/components/ui/Header.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationsContext";
import { getInitials, nameFromEmail } from "../../utils/displayName";
import Icon from "../AppIcon";
import Button from "./Button";
import useSelectedStudyValue from "../../hooks/useSelectedStudyValue";

/**
 * Calculate current academic week number.
 * Academic year teaching starts on the third Monday of September (after orientation week).
 * Winter semester: weeks 1-13 (mid-Sep to Dec), then exam period
 * Summer semester: weeks 1-13 (Feb-May), then exam period
 */
const getAcademicWeek = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  // Determine academic year start
  // If we're before September, use previous year's September as start
  const academicYear = currentMonth >= 8 ? currentYear : currentYear - 1;
  
  // Find the third Monday of September (teaching typically starts after orientation week)
  const sept1 = new Date(academicYear, 8, 1); // September 1st
  const dayOfWeek = sept1.getDay();
  // Days until first Monday
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
  // Third Monday = first Monday + 14 days
  const thirdMonday = new Date(sept1);
  thirdMonday.setDate(sept1.getDate() + daysToFirstMonday + 14);
  
  // Calculate weeks since semester start
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((now - thirdMonday) / msPerWeek) + 1;
  
  // Determine which semester we're in and calculate week
  if (currentMonth >= 8 || currentMonth <= 0) {
    // Winter semester (September - January)
    // Cap at 14 weeks (13 teaching + 1 exam prep), show "Exam period" after
    if (weeksSinceStart > 14) {
      return { week: null, semester: 'winter', isExamPeriod: true };
    }
    return { week: Math.max(1, Math.min(weeksSinceStart, 14)), semester: 'winter', isExamPeriod: false };
  } else if (currentMonth >= 1 && currentMonth <= 5) {
    // Summer semester (February - June)
    const summerStart = new Date(currentYear, 1, 1); // February 1st
    const firstMondaySummer = new Date(summerStart);
    const dow = firstMondaySummer.getDay();
    const daysToMonday = dow === 0 ? 1 : (dow === 1 ? 0 : 8 - dow);
    firstMondaySummer.setDate(firstMondaySummer.getDate() + daysToMonday);
    
    const summerWeeks = Math.floor((now - firstMondaySummer) / msPerWeek) + 1;
    if (summerWeeks > 14 || summerWeeks < 1) {
      return { week: null, semester: 'summer', isExamPeriod: true };
    }
    return { week: Math.max(1, Math.min(summerWeeks, 14)), semester: 'summer', isExamPeriod: false };
  } else {
    // July-August: vacation
    return { week: null, semester: 'vacation', isExamPeriod: false };
  }
};

const CSS = `
:root{ --hdr-h:4rem; }
@media (min-width:768px){ :root{ --hdr-h:4.5rem; } }

.hdr{
  position:fixed; inset-inline:0; top:0; z-index:80;
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  backdrop-filter: blur(12px) saturate(150%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-popover) 78%, transparent) 0%, color-mix(in srgb, var(--color-card) 78%, transparent) 100%);
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
  box-shadow: 0 10px 26px rgba(0,0,0,.28);
  transition:
    background .28s ease, box-shadow .28s ease, border-color .28s ease,
    -webkit-backdrop-filter .28s ease, backdrop-filter .28s ease;
}
.hdr::after{
  content:""; position:absolute; left:0; right:0; bottom:0; height:1px; pointer-events:none;
  background: linear-gradient(90deg, var(--grad-from), var(--grad-to));
  opacity:.25;
}
.hdr--condensed{
  -webkit-backdrop-filter: blur(14px) saturate(170%);
  backdrop-filter: blur(14px) saturate(170%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-popover) 88%, transparent) 0%, color-mix(in srgb, var(--color-card) 88%, transparent) 100%);
  border-bottom: 1px solid color-mix(in srgb, var(--color-ring) 22%, var(--color-border));
  box-shadow: 0 14px 34px rgba(0,0,0,.36), inset 0 -1px 0 rgba(255,255,255,.06);
}
@media (prefers-reduced-motion: reduce){
  .hdr, .hdr--condensed{ transition: none; }
}

.hdr__inner{max-width:112rem;margin-inline:auto;height:var(--hdr-h);padding-inline:1rem;display:flex;align-items:center;justify-content:space-between}

.drop{position:absolute;right:0;top:100%;margin-top:.5rem;min-width:14rem;background:rgba(10,22,34,.92);border:1px solid rgba(255,255,255,.14);border-radius:.75rem;box-shadow:0 20px 60px rgba(0,0,0,.45);-webkit-backdrop-filter:saturate(160%) blur(12px);backdrop-filter:saturate(160%) blur(12px);overflow:hidden}
.drop--w56{min-width:14rem;width:14rem}
.drop--w60{min-width:15rem;width:15rem}
.drop--notif{width:22rem;max-height:min(72vh, 560px);display:flex;flex-direction:column;overflow:hidden}
.drop__sectionTitle{position:static;top:0;z-index:1;padding:.5rem .75rem;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.72)}
.notif-head{position:sticky;top:0;background:rgba(10,22,34,.92);z-index:2}
.notif-scroll{flex:1;overflow:auto;overscroll-behavior:contain}
@media (max-width:1023.98px){
  .drop--notif{display:none}
  .notif-overlay{position:fixed;left:0;right:0;top:calc(var(--hdr-h) + env(safe-area-inset-top));bottom:0;z-index:79;background:transparent;display:flex;align-items:flex-start;justify-content:center;pointer-events:auto}
  .notif-sheet{margin-top:.5rem;width:calc(100vw - 2rem);max-width:32rem;max-height:min(72vh,560px);background:rgba(10,22,34,.92);border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.5);overflow:hidden;display:flex;flex-direction:column}
  .notif-row{padding:12px;gap:12px}
  .notif-icon{width:40px;height:40px;border-radius:10px}
  .notif-title{font-size:14px}
  .notif-time{font-size:11px}
  .title-line{display:flex;gap:8px;align-items:center;justify-content:space-between}
  @media (max-width:360px){ .title-line{flex-direction:column;align-items:flex-start;gap:4px} }
}

.btn-icon{display:grid;place-items:center;width:2.25rem;height:2.25rem;border-radius:.6rem;color:rgba(255,255,255,.88);transition:background-color .18s ease,color .18s ease,transform .18s ease}
.btn-icon:hover{color:#fff;background:rgba(255,255,255,.08);transform:translateY(-1px)}
.brand-grad{background-image:linear-gradient(90deg,var(--grad-from),var(--grad-to));-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 14px rgba(103,232,249,.25)}

.badge{position:absolute;min-width:16px;height:16px;padding:0;border-radius:9999px;top:-6px;right:-6px;display:grid;place-items:center;font-size:10px;font-weight:700;line-height:1;color:#000;background:#FBBF24}
.week-badge{display:flex;align-items:center;gap:.375rem;padding:.25rem .625rem;border-radius:.5rem;background:linear-gradient(135deg,rgba(56,189,248,.15),rgba(99,102,241,.15));border:1px solid rgba(56,189,248,.25);font-size:.75rem;font-weight:600;color:rgba(255,255,255,.9);white-space:nowrap;transition:all .2s ease}
.week-badge:hover{background:linear-gradient(135deg,rgba(56,189,248,.25),rgba(99,102,241,.25));border-color:rgba(56,189,248,.4)}
.week-badge__num{font-weight:700;background:linear-gradient(90deg,#38bdf8,#818cf8);-webkit-background-clip:text;background-clip:text;color:transparent}
.week-badge--exam{background:linear-gradient(135deg,rgba(251,191,36,.15),rgba(245,158,11,.15));border-color:rgba(251,191,36,.3)}
.week-badge--exam:hover{background:linear-gradient(135deg,rgba(251,191,36,.25),rgba(245,158,11,.25))}
.week-badge--vacation{background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(16,185,129,.15));border-color:rgba(34,197,94,.3)}
.menu-item{display:flex;align-items:center;gap:.5rem;width:100%;min-height:2.25rem;padding:.5rem .75rem;border-radius:.6rem;font-size:.9rem;color:rgba(255,255,255,.9);transition:background-color .15s ease, color .15s ease}
.menu-item:hover{color:#fff;background:rgba(255,255,255,.08)}
.h-active{background:linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent); color:#fff}
.chev{transition:transform .2s ease}
.is-open .chev{transform:rotate(180deg)}
.more-dots{display:inline-flex;gap:3px;margin-left:6px;vertical-align:middle}
.more-dots i{width:4px;height:4px;border-radius:9999px;background:currentColor;opacity:.6;transform:translateY(0);animation:bob 1.2s ease-in-out infinite;animation-play-state:paused}
.more-open .more-dots i{animation-play-state:running}
.more-dots i:nth-child(2){animation-delay:.15s}
.more-dots i:nth-child(3){animation-delay:.3s}
@keyframes bob{0%,100%{transform:translateY(0);opacity:.6}50%{transform:translateY(-2px);opacity:1}}
`;

const cx = (...a) => a.filter(Boolean).join(" ");

const STRIP_PREFIX = /^(?:Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|Mgr\. art\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s+/gi;
const STRIP_SUFFIX = /\s*,\s*(?:PhD\.|CSc\.|DrSc\.)$/i;
const stripTitles = (s = "") => String(s).replace(STRIP_PREFIX, "").replace(STRIP_SUFFIX, "").trim();

const initials = (name = "", email = "") => getInitials({ name, email }) || "U";
const roleOf = (u) => (u?.role === "teacher" ? "teacher" : "student");
const displayNameOf = (u, p) => {
    const name = stripTitles(p?.full_name || u?.full_name || "");
    if (name) return name;
    // Try to get readable name from email
    const email = u?.email || "";
    return nameFromEmail(email) || email?.split?.("@")?.[0] || "User";
};
const homeFor = (r) => (r === "teacher" ? "/teacher-dashboard" : "/student-dashboard");
const LOGIN_PATH = "/login";

const isBcInf = (rec) => String(rec?.programCode || "").toLowerCase() === "inf_bc_d_sk";

const normalizeCategory = (n) => {
  const c = String(n?.category || n?.type || "").toLowerCase();
  if (["messages", "announcements", "alerts", "attendance", "grades"].includes(c)) return c;
  return "alerts";
};
const getNotificationIcon = (n) => {
  const t = normalizeCategory(n);
  switch (t) {
    case "messages":
      return "MessageSquare";
    case "announcements":
      return "Megaphone";
    case "alerts":
      return "AlertTriangle";
    case "attendance":
      return "CheckSquare";
    case "grades":
      return "BookOpen";
    default:
      return "Bell";
  }
};
const getNotificationColor = (n) => {
  const p = n?.priority;
  if (p === "high") return "text-error";
  if (p === "medium") return "text-warning";
  const t = normalizeCategory(n);
  switch (t) {
    case "messages":
      return "text-primary";
    case "announcements":
      return "text-accent";
    case "alerts":
      return "text-error";
    default:
      return "text-muted-foreground";
  }
};

const Header = () => {
  const { user, userProfile, signOut } = useAuth();
  const notificationsContext = useNotifications();
  const { notifications, unread, readList, unreadCount, markAllRead, clearAll, markRead, markUnread } = notificationsContext || {
    notifications: [],
    unread: [],
    readList: [],
    unreadCount: 0,
    markAllRead: () => {},
    clearAll: () => {},
    markRead: () => {},
    markUnread: () => {},
  };

  const location = useLocation();
  const navigate = useNavigate();
  
  // Calculate academic week
  const academicWeekInfo = useMemo(() => getAcademicWeek(), []);

  useEffect(() => {
    if (!document.getElementById("hdr-inline-styles")) {
      const s = document.createElement("style");
      s.id = "hdr-inline-styles";
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }, []);

  const role = roleOf(user);
  const home = homeFor(role);
  const displayName = displayNameOf(user, userProfile);
  const email = user?.email || "";
  const initialsTxt = initials(displayName, email);

  const { value: selectedStudy } = useSelectedStudyValue();
  const isArchivedStudy = role === "student" && !!selectedStudy && selectedStudy.ongoing === false;
  const limitStudentMenu = role === "student" && (isBcInf(selectedStudy) || isArchivedStudy);
  const allowedStudentPaths = new Set([
    "/student-dashboard",
    "/student-studies",
    "/print-reports",
    "/final-thesis",
    "/anketa",
    "/help",
    "/student-management",
    "/faculty-management",
  ]);

  const nav = useMemo(() => {
    const base =
        role === "teacher"
            ? [
              { label: "Dashboard", path: "/teacher-dashboard", icon: "LayoutDashboard" },
              { label: "Students", path: "/student-management", icon: "Users" },
              { label: "Faculty", path: "/faculty-management", icon: "Users2" },
              { label: "Schedule", path: "/class-schedule-management", icon: "Calendar" },
              { label: "Attendance", path: "/attendance-tracking", icon: "CheckSquare" },
              { label: "Grades", path: "/grade-management", icon: "BookOpen" },
              { label: "Print Reports", path: "/print-reports", icon: "Printer" },
              { label: "Final Thesis", path: "/final-thesis/teacher", icon: "ScrollText" },
              { label: "Surveys", path: "/anketa", icon: "Clipboard" },
              { label: "Chat", path: "/chat", icon: "MessageSquare" },
              { label: "Activities", path: "/activities", icon: "BarChart3" },
              { label: "Help", path: "/help", icon: "HelpCircle" },
            ]
            : [
              { label: "Dashboard", path: "/student-dashboard", icon: "LayoutDashboard" },
              { label: "Students", path: "/student-management", icon: "Users" },
              { label: "Faculty", path: "/faculty-management", icon: "Users2" },
              { label: "Activities", path: "/activities", icon: "BarChart3" },
              { label: "Schedule", path: "/class-schedule-management", icon: "Calendar" },
              { label: "Studies", path: "/student-studies", icon: "GraduationCap" },
              { label: "Print Reports", path: "/print-reports", icon: "Printer" },
              { label: "Final Thesis", path: "/final-thesis", icon: "FileText" },
              { label: "Final evaluation enrollment", path: "/terminy", icon: "CalendarDays" },
              { label: "Course enrollment", path: "/zapis", icon: "FileStack" },
              { label: "Surveys", path: "/anketa", icon: "Clipboard" },
              { label: "Chat", path: "/chat", icon: "MessageSquare" },
              { label: "Help", path: "/help", icon: "HelpCircle" },
            ];
    let filtered = limitStudentMenu ? base.filter((it) => allowedStudentPaths.has(it.path)) : base;
    if (isArchivedStudy) {
      const restricted = new Set(["/chat", "/activities"]);
      filtered = filtered.filter((it) => !restricted.has(it.path));
    }
    return filtered;
  }, [role, limitStudentMenu, isArchivedStudy]);

  const visibleNav = nav.slice(0, 4);
  const overflowNav = nav.slice(4);
  const isActive = (p) => location?.pathname === p;

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [isLarge, setIsLarge] = useState(() =>
      typeof window !== "undefined" ? window.matchMedia("(min-width:1024px)").matches : true
  );

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 8);
    const mm = window.matchMedia("(min-width:1024px)");
    const onMM = (e) => setIsLarge(e.matches);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    mm.addEventListener?.("change", onMM);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mm.removeEventListener?.("change", onMM);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setIsNotifOpen(false);
        setIsMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setIsNotifOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  const goLogin = () => navigate(LOGIN_PATH, { replace: true });

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setIsNotifOpen(false);
    setIsMoreOpen(false);
    try {
      await signOut?.();
    } catch {}
    finally {
      setLoggingOut(false);
      goLogin();
    }
  };

  const openNotif = (n) => {
    markRead(n.id);
    setIsNotifOpen(false);
    if (n.href) navigate(n.href);
  };

  if (!user) {
    return (
        <header className={cx("hdr", condensed && "hdr--condensed")} data-reveal="guest">
          <div className="hdr__inner">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid w-8 h-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_8px_20px_rgba(2,132,199,.35)]">
                <Icon name="GraduationCap" size={18} color="#fff" />
              </div>
              <span className="font-semibold text-white">MAIS 2.0</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/help" className="text-sm text-white/80 hover:text-white underline underline-offset-4">Help</Link>
              <Link to={LOGIN_PATH} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-sky-500/80 text-white hover:bg-sky-500">
                <Icon name="LogIn" size={16} color="#fff" /> Sign in
              </Link>
            </div>
          </div>
        </header>
    );
  }

  return (
      <header className={cx("hdr", condensed && "hdr--condensed")} data-reveal={condensed ? "condensed" : "idle"}>
        <style id="hdr-inline-styles">{CSS}</style>

        <div className="hdr__inner">
          <div className="flex items-center gap-4">
            <Link to={home} className="flex items-center gap-3">
              <div className="grid w-9 h-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_8px_20px_rgba(2,132,199,.35)]">
                <Icon name="GraduationCap" size={18} color="#fff" />
              </div>
              <span className="font-semibold brand-grad tracking-tight">MAIS 2.0</span>
            </Link>
            
            {/* Academic Week Badge */}
            <WeekBadge weekInfo={academicWeekInfo} />
          </div>

          <nav className="desktop-nav items-center gap-1">
            {visibleNav.map((item) => (
                <Link
                    key={item.path}
                    to={item.path}
                    className={cx(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors",
                        isActive(item.path) ? "h-active" : "text-white/80 hover:text-white hover:bg-white/10"
                    )}
                >
                  <Icon name={item.icon} size={16} color="currentColor" />
                  <span>{item.label}</span>
                </Link>
            ))}

            {overflowNav.length > 0 && (
                <div className={cx("relative", isMoreOpen && "is-open more-open")}>
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setIsMoreOpen((v) => !v); setIsNotifOpen(false); }}
                      className="px-3 text-white/90 hover:text-white hover:bg-white/10"
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isMoreOpen ? "true" : "false"}
                      aria-controls="hdr-more-menu"
                  >
                <span className="inline-flex items-center">
                  More
                  <span className="more-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                </span>
                  </Button>
                  {isMoreOpen && (
                      <div id="hdr-more-menu" className="drop drop--w56" role="menu">
                        <div className="py-1">
                          {overflowNav.map((item) => (
                              <Link key={item.path} to={item.path} onClick={() => setIsMoreOpen(false)} className={cx("menu-item", isActive(item.path) && "h-active")} role="menuitem">
                                <Icon name={item.icon} size={16} color="currentColor" />
                                <span>{item.label}</span>
                              </Link>
                          ))}
                          <button type="button" onClick={handleLogout} className="menu-item" role="menuitem">
                            <Icon name="LogOut" size={16} color="currentColor" />
                            Sign out
                          </button>
                        </div>
                      </div>
                  )}
                </div>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/chat" title="Chat" className="btn-icon">
              <Icon name="MessageSquare" size={18} color="currentColor" />
            </Link>

            <div className="relative">
              <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={isNotifOpen ? "true" : "false"}
                  aria-controls="hdr-notif-panel"
                  onClick={() => { setIsNotifOpen((v) => !v); setIsMoreOpen(false); }}
                  className="btn-icon"
                  title="Notifications (Not implemented)"
              >
                <Icon name="Bell" size={18} color="currentColor" />
              </button>

              {isNotifOpen && isLarge && (
                  <div id="hdr-notif-panel" className="drop drop--notif" role="dialog" aria-modal="true">
                    <div className="notif-head flex items-center justify-between px-3 py-2 border-b border-white/15">
                      <div className="flex items-center gap-2 text-white">
                        <Icon name="Bell" size={16} color="#fff" />
                        <span className="text-sm font-semibold">Notifications</span>
                      </div>
                    </div>

                    <div className="notif-scroll thin-scrollbar">
                      <div className="p-8 text-center">
                        <div className="mb-3 opacity-50">
                          <Icon name="BellOff" size={48} color="currentColor" />
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                          This feature is not implemented
                        </p>
                      </div>
                    </div>
                  </div>
              )}
            </div>

      <AccountMenu
        displayName={displayName}
        email={email}
        roleLabel={role}
        initialsTxt={initialsTxt}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
          </div>
        </div>

        {isNotifOpen && !isLarge && (
            <div className="notif-overlay" role="dialog" aria-modal="true" onClick={() => setIsNotifOpen(false)}>
              <div className="notif-sheet thin-scrollbar" onClick={(e) => e.stopPropagation()}>
                <div className="notif-head flex items-center justify-between px-3 py-2 border-b border-white/15">
                  <div className="flex items-center gap-2 text-white">
                    <Icon name="Bell" size={16} color="#fff" />
                    <span className="text-sm font-semibold">Notifications</span>
                  </div>
                </div>
                <div className="notif-scroll">
                  <div className="p-8 text-center">
                    <div className="mb-3 opacity-50">
                      <Icon name="BellOff" size={48} color="currentColor" />
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      This feature is not implemented
                    </p>
                  </div>
                </div>
              </div>
            </div>
        )}

        {isNotifOpen && isLarge && <div className="fixed inset-0 z-[999]" onMouseDown={() => setIsNotifOpen(false)} onClick={() => setIsNotifOpen(false)} />}
        {isMoreOpen && <div className="fixed inset-0 z-[999]" onMouseDown={() => setIsMoreOpen(false)} onClick={() => setIsMoreOpen(false)} />}
      </header>
  );
};

export default Header;

function AccountMenu({ displayName, email, roleLabel, initialsTxt, onLogout, loggingOut }) {
  const [isOpen, setIsOpen] = useState(false);
  const [overlayArmed, setOverlayArmed] = useState(false);
  const armTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      armTimerRef.current && clearTimeout(armTimerRef.current);
      setOverlayArmed(false);
      armTimerRef.current = setTimeout(() => setOverlayArmed(true), 120);
    } else {
      armTimerRef.current && clearTimeout(armTimerRef.current);
      setOverlayArmed(false);
    }
    return () => armTimerRef.current && clearTimeout(armTimerRef.current);
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
      <div className={cx("relative", isOpen && "is-open")}>
        <button
            type="button"
            onClick={() => { setIsOpen((v) => !v); }}
            className="flex items-center gap-2 px-2 h-9 rounded-md text-white/90 hover:text-white hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={isOpen ? "true" : "false"}
            aria-controls="hdr-profile-menu"
            title="Account"
        >
          <div className="grid w-8 h-8 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
            <span className="text-[11px] font-semibold">{initialsTxt}</span>
          </div>
          <span className="hidden lg:block text-sm truncate max-w-[12rem]">{displayName}</span>
          <span className="chev"><Icon name="ChevronDown" size={16} color="currentColor" /></span>
        </button>

        {isOpen && (
            <div id="hdr-profile-menu" className="drop drop--w60" role="menu">
              <div className="px-3 py-2 border-b border-white/15">
                <div className="text-sm font-semibold text-white">{displayName}</div>
                <div className="text-xs text-white/70 truncate">{email}</div>
              </div>
              <Link to="/profile" onClick={() => setIsOpen(false)} className="menu-item" role="menuitem">
                <Icon name="User" size={16} color="currentColor" /> Profile
              </Link>
              <button type="button" onClick={onLogout} disabled={loggingOut} className="menu-item disabled:opacity-60" role="menuitem">
                <Icon name="LogOut" size={16} color="currentColor" />
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
        )}

        {isOpen && (
            <div
                className="fixed inset-0 z-[999]"
                style={{ pointerEvents: "auto" }}
                onMouseDown={() => { if (!overlayArmed) return; setIsOpen(false); }}
                onClick={() => { if (!overlayArmed) return; setIsOpen(false); }}
            />
        )}
      </div>
  );
}

function NotifLists({ unread, readList, openNotif, toggleUnread }) {
  return (
      <>
        {unread.length > 0 && (
            <>
              <div className="drop__sectionTitle">Unread ({unread.length})</div>
              <div className="divide-y divide-white/10">
                {unread.map((n) => (
                    <NotifRow key={n.id} n={n} onOpen={() => openNotif(n)} onToggle={() => toggleUnread(n.id, false)} />
                ))}
              </div>
            </>
        )}
        {readList.length > 0 && (
            <>
              <div className="drop__sectionTitle">Read</div>
              <div className="divide-y divide-white/10">
                {readList.map((n) => (
                    <NotifRow key={n.id} n={n} read onOpen={() => openNotif(n)} onToggle={() => toggleUnread(n.id, true)} />
                ))}
              </div>
            </>
        )}
        {unread.length === 0 && readList.length === 0 && (
            <div className="px-3 py-6 text-center text-white/70 text-sm">No notifications</div>
        )}
      </>
  );
}

function NotifRow({ n, read = false, onOpen, onToggle }) {
  const formatTimeAgo = (tsLike) => {
    const ts = tsLike instanceof Date ? +tsLike : (typeof tsLike === "string" ? Date.parse(tsLike) : +tsLike);
    if (!ts || Number.isNaN(ts)) return "";
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  const iconName = getNotificationIcon(n);
  const iconCls = getNotificationColor(n);

  return (
      <div className="relative">
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
            className={cx(
                "notif-row w-full text-left px-3 py-3 cursor-pointer transition-colors rounded-md",
                read ? "hover:bg-white/5" : "bg-primary/5 border border-primary/10 hover:bg-primary/10"
            )}
        >
          <div className="flex items-start gap-3">
            <div className="notif-icon w-9 h-9 rounded-md border border-white/15 bg-white/5 flex items-center justify-center flex-shrink-0">
              <Icon name={iconName} size={16} className={iconCls} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="title-line">
                <div className={cx("notif-title truncate", read ? "text-white/90" : "text-white font-semibold")}>{n.title}</div>
                <div className="notif-time text-[11px] text-white/70 whitespace-nowrap">{formatTimeAgo(n.time || n.timestamp)}</div>
              </div>
              {!!n.message && <div className="text-xs text-white/75 mt-1 break-words line-clamp-2">{n.message}</div>}
              {!!n.meta && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {Object.entries(n.meta).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-white/10 text-[11px] text-white/80 border border-white/10">
                    {k}: {String(v)}
                  </span>
                    ))}
                  </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {n?.priority === "high" && <span className="inline-block w-2 h-2 rounded-full bg-error" title="High priority" />}
              <button
                  type="button"
                  title={read ? "Mark as unread" : "Mark as read"}
                  onClick={(e) => { e.stopPropagation(); onToggle(); }}
                  className="p-1 rounded text-white/80 hover:text-white hover:bg-white/10"
              >
                <Icon name={read ? "Undo2" : "Check"} size={16} color="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

/**
 * Week Badge component showing current academic week
 */
function WeekBadge({ weekInfo }) {
  if (!weekInfo) return null;
  
  const { week, semester, isExamPeriod } = weekInfo;
  
  // Vacation period
  if (semester === 'vacation') {
    return (
      <div className="week-badge week-badge--vacation hidden sm:flex" title="Summer vacation">
        <Icon name="Sun" size={14} color="currentColor" />
        <span>Vacation</span>
      </div>
    );
  }
  
  // Exam period
  if (isExamPeriod) {
    return (
      <div className="week-badge week-badge--exam hidden sm:flex" title="Examination period">
        <Icon name="FileText" size={14} color="currentColor" />
        <span>Exam Period</span>
      </div>
    );
  }
  
  // Regular teaching week
  const semesterLabel = semester === 'winter' ? 'WS' : 'SS';
  
  return (
    <div 
      className="week-badge hidden sm:flex" 
      title={`${semester === 'winter' ? 'Winter' : 'Summer'} semester, week ${week} of 13`}
    >
      <Icon name="Calendar" size={14} color="currentColor" />
      <span>
        Week <span className="week-badge__num">{week}</span>
      </span>
      <span className="text-[10px] opacity-60">({semesterLabel})</span>
    </div>
  );
}