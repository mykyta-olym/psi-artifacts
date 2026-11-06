// src/pages/terminy/utils/terminyUtils.jsx

export const CURRENT_YEAR = '2025/2026';
export const CURRENT_YEAR_SLUG = CURRENT_YEAR.replace('/', '-');
export const KEY_CURR_WS = `1-year-${CURRENT_YEAR_SLUG}-WS`;
export const KEY_CURR_SS = `1-year-${CURRENT_YEAR_SLUG}-SS`;

export const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const norm = (s = '') => s.toString().trim().toLowerCase();

export const H = (s) => {
    let h = 2166136261 >>> 0;
    const x = String(s || '');
    for (let i = 0; i < x.length; i++) {
        h ^= x.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

export const to2 = (n) => String(n).padStart(2, '0');

export const dtISO = (d) => `${d.getFullYear()}${to2(d.getMonth() + 1)}${to2(d.getDate())}T${to2(d.getHours())}${to2(d.getMinutes())}00`;

export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export const asString = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' && 'value' in v ? String(v.value) : String(v ?? ''));

export const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

export const groupBy = (list, by) => list.reduce((acc, x) => {
    const k = by(x);
    if (!acc[k]) acc[k] = [];
    acc[k].push(x);
    return acc;
}, {});

export const fmtLeft = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(t / 86400);
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};