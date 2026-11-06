export const stripCourseText = (txt = '') => {
    let s = String(txt);
    // прибрав зайві екранування \(\) усередині char class
    s = s.replace(/\s*[([]\s*\d{5,}\s*[)\]]\s*/g, ' ');
    s = s.replace(/\b\d{5,}\b/g, ' ');
    s = s.replace(/\s*\n+\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    return s;
};

export const isPureCourseCode = (val) => /^\s*\d{5,}\s*$/.test(String(val || ''));

export const TYPES = [
    { value: 'all', label: 'All types' },
    { value: 'pinned', label: 'Pinned' },
    { value: 'submissions', label: 'Submissions' },
    { value: 'communications', label: 'Messages' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'grades', label: 'Grades' },
    { value: 'announcement', label: 'Announcements' },
    { value: 'schedule', label: 'Schedule' }
];

export const SORTS = [
    { value: 'time', label: 'Time' },
    { value: 'type', label: 'Type' },
    { value: 'priority', label: 'Priority' },
    { value: 'action', label: 'Requires Action' }
];

export const VIEW_KEY = 'mais.activities.view';
export const GRID_COLS = '48px 1fr 140px 84px 120px minmax(110px,140px) minmax(220px,1fr)';

export const iconByType = (t) => {
    switch (t) {
        case 'submissions': return 'FileText';
        case 'communications': return 'MessageSquare';
        case 'attendance': return 'CheckSquare';
        case 'grades': return 'BookOpen';
        case 'announcement': return 'Megaphone';
        case 'schedule': return 'Calendar';
        default: return 'Activity';
    }
};
export const colorByType = (t) => {
    switch (t) {
        case 'submissions': return 'text-primary';
        case 'communications': return 'text-accent';
        case 'attendance': return 'text-success';
        case 'grades': return 'text-warning';
        case 'announcement': return 'text-secondary';
        case 'schedule': return 'text-primary';
        default: return 'text-muted-foreground';
    }
};
export const priorityBadge = (p) => {
    switch (p) {
        case 'high': return { text: 'High', cls: 'bg-destructive/15 text-destructive border border-destructive/20' };
        case 'medium': return { text: 'Medium', cls: 'bg-warning/20 text-warning border border-warning/20' };
        default: return { text: 'Low', cls: 'bg-muted text-muted-foreground border border-border' };
    }
};

export const timeAgo = (tsLike) => {
    const ts = tsLike instanceof Date ? +tsLike : (typeof tsLike === 'string' ? Date.parse(tsLike) : +tsLike);
    if (!ts || Number.isNaN(ts)) return '';
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};
export const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
export const isYesterday = (d) => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return new Date(d).toDateString() === y.toDateString();
};