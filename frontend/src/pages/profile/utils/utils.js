// src/pages/profile/utils/utils.jsx

export const STORAGE_KEY = 'mais.profile.v1';
export const PRIVACY_KEY = 'mais.profile.privacy';
export const AVATAR_KEY = 'mais.profile.avatar';
export const THEME_KEY = 'mais.theme.pref';
export const DND_KEY = 'mais.dnd.until';
export const DEVICES_KEY = 'mais.devices';

export const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const dayLabel = { Mon:'Mon', Tue:'Tue', Wed:'Wed', Thu:'Thu', Fri:'Fri', Sat:'Sat', Sun:'Sun' };
export function labelForDay(k) { return dayLabel[k] ?? String(k || ''); }

const normalize = (s='')=>String(s||'').trim();

// Empty defaults - all data should come from backend
const DEFAULT_OFFICE_HOURS = {
    Mon: { enabled: false, start: '', end: '' },
    Tue: { enabled: false, start: '', end: '' },
    Wed: { enabled: false, start: '', end: '' },
    Thu: { enabled: false, start: '', end: '' },
    Fri: { enabled: false, start: '', end: '' },
    Sat: { enabled: false, start: '', end: '' },
    Sun: { enabled: false, start: '', end: '' }
};

const DEFAULT_WORKING_HOURS = {
    Mon: { enabled: false, start: '', end: '' },
    Tue: { enabled: false, start: '', end: '' },
    Wed: { enabled: false, start: '', end: '' },
    Thu: { enabled: false, start: '', end: '' },
    Fri: { enabled: false, start: '', end: '' },
    Sat: { enabled: false, start: '', end: '' },
    Sun: { enabled: false, start: '', end: '' }
};

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const cloneDeepProfile = (source = {}) => ({
    ...source,
    officeHours: { ...(source.officeHours || DEFAULT_OFFICE_HOURS) },
    workingHours: { ...(source.workingHours || DEFAULT_WORKING_HOURS) },
    preferences: { ...(source.preferences || { showEmailOnProfile: true, showPhoneOnProfile: false }) },
    certifications: Array.isArray(source.certifications) ? [...source.certifications] : [],
    subjects: Array.isArray(source.subjects) ? [...source.subjects] : [],
    departments: Array.isArray(source.departments) ? [...source.departments] : (source.department ? [source.department] : []),
});

function buildDefaultProfile() {
    return {
        role: 'student',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        location: '',
        about: '',
        departments: [],
        employeeId: '',
        subjects: [],
        yearsExperience: 0,
        officeHours: DEFAULT_OFFICE_HOURS,
        workingHours: DEFAULT_WORKING_HOURS,
        certifications: [],
        preferences: {
            showEmailOnProfile: true,
            showPhoneOnProfile: false,
        },
    };
}

export const DEFAULT_PROFILE = cloneDeepProfile(buildDefaultProfile());

const buildBlankProfile = (email = '', role = 'student') => {
    const labelFromEmail = () => {
        const beforeAt = String(email || '').split('@')[0] || '';
        const cleaned = beforeAt.replace(/[._-]+/g, ' ').trim();
        return cleaned
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    };
    const baseName = labelFromEmail();
    return cloneDeepProfile({
        role,
        firstName: '',
        lastName: '',
        fullName: baseName,
        name: baseName,
        email,
        phone: '',
        location: '',
        about: '',
        departments: [],
        employeeId: '',
        subjects: [],
        yearsExperience: 0,
        officeHours: DEFAULT_OFFICE_HOURS,
        workingHours: DEFAULT_WORKING_HOURS,
        certifications: [],
        preferences: { showEmailOnProfile: true, showPhoneOnProfile: false },
    });
};

const enrichProfile = (profile) => {
    const certifications = (profile.certifications || []).map((c) => ({ ...c, state: certState(c) }));
    const phoneMasked = obfuscate(profile.phone);
    return { ...profile, certifications, phoneMasked };
};

// DEPRECATED: These functions return static/empty data and should be replaced with API calls
// Use fetchStudentByEmail() or fetchFacultyByEmail() from maisApiAdapter instead
export function loadProfile(activeEmail) {
    console.warn('[DEPRECATED] loadProfile returns empty data. Use fetchStudentByEmail/fetchFacultyByEmail from API instead.');
    const targetEmail = normalizeEmail(activeEmail);
    const base = buildBlankProfile(activeEmail || '', targetEmail ? 'student' : 'student');
    return enrichProfile(base);
}
export function loadPrivacy() { 
    console.warn('[DEPRECATED] loadPrivacy returns false. Use user preferences API instead.');
    return false; 
}
export function loadAvatar() { 
    console.warn('[DEPRECATED] loadAvatar returns null. Use profile.avatarUrl from API instead.');
    return null; 
}
export function loadTheme() { 
    console.warn('[DEPRECATED] loadTheme returns static value. Use user preferences API instead.');
    return 'system'; 
}
export function readDndUntil() { 
    console.warn('[DEPRECATED] readDndUntil returns null. Use user preferences API instead.');
    return null; 
}

export function splitCSV(s) {
    return String(s || '')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);
}
export function obfuscate(s) { if (!s) return ''; return s.split('').map((ch,i)=>(i%2?'•':ch)).join(''); }
export function timeAgo(d) {
    const ts = typeof d === 'number' ? d : +new Date(d);
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
}
export function nextWeekdayUTC(targetIdx) {
    const now = new Date();
    const nowIdx = (now.getUTCDay() + 6) % 7;
    let add = targetIdx - nowIdx;
    if (add < 0) add += 7;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + add);
    return d;
}
export function fmtICS(dateUTC, h=10, m=0) {
    const d = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate(), h, m, 0));
    const Y = d.getUTCFullYear();
    const MM = String(d.getUTCMonth()+1).padStart(2,'0');
    const DD = String(d.getUTCDate()).padStart(2,'0');
    const hh = String(d.getUTCHours()).padStart(2,'0');
    const mm = String(d.getUTCMinutes()).padStart(2,'0');
    const ss = '00';
    return `${Y}${MM}${DD}T${hh}${mm}${ss}Z`;
}

export function getSeedDevices() {
    // Return empty array - all device data should come from backend
    return [];
}

export async function loadDevices(userId) {
    if (!userId) return getSeedDevices();
    try {
        const response = await fetch(`/api/students/sessions/${encodeURIComponent(userId)}`);
        if (!response.ok) return getSeedDevices();
        const sessions = await response.json();
        
        // Transform backend sessions to frontend format
        return sessions.map(s => ({
            id: s.id,
            name: `${s.browser} • ${s.os}`,
            location: s.location || 'Unknown',
            lastActive: new Date(s.lastActivity).getTime(),
            icon: s.deviceType === 'Mobile' ? 'Smartphone' : s.deviceType === 'Tablet' ? 'Tablet' : 'Laptop'
        }));
    } catch (err) {
        console.error('Failed to load device sessions:', err);
        return getSeedDevices();
    }
}

export function saveDevices(list) {
    return list;
}
export function fmtDate(d){
    if(!d) return '—';
    const x = new Date(d);
    return isNaN(+x) ? '—' : x.toLocaleDateString();
}

export const daysLeft = (dateStr)=>{
    if(!dateStr) return null;
    const d=new Date(dateStr);
    if(isNaN(+d)) return null;
    return Math.ceil((d.getTime()-Date.now())/(24*60*60*1000));
};
export const certState = (cert)=>{
    const left = daysLeft(cert?.expiresOn);
    if(left!=null && left<0) return {label:'Expired', cls:'bg-destructive text-destructive-foreground'};
    if(left!=null && left<=30) return {label:'Expiring soon', cls:'bg-warning text-warning-foreground'};
    return {label:'Valid', cls:'bg-success text-success-foreground'};
};