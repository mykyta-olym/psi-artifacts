// src/utils/ids.js

// ---------- hashing ----------
function fnv1a(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
}

// ---------- helpers ----------
function base36(n) {
    return Math.abs(n >>> 0).toString(36);
}
function csum97(n) {
    const v = Math.abs(n) % 97;
    return String(v).padStart(2, '0');
}
const toLetter = (n) => String.fromCharCode(97 + (Math.abs(n) % 26)); // a..z

// ---------- public ----------

// Залишаємо (використовується для генерацій)
export function studentCode({ email = '', fullName = '', year = '' } = {}) {
    const seed = `${email}|${fullName}|${year}`;
    const h1 = fnv1a(seed || 'student');
    const h2 = fnv1a(`${seed}::n`);
    const h3 = fnv1a(`${seed}::t`);

    const l1 = toLetter(h1);
    const l2 = toLetter(h1 >>> 5);
    const digits = String(h2 % 1000).padStart(3, '0');
    const l3 = toLetter(h3);
    const l4 = toLetter(h3 >>> 7);

    return `${l1}${l2}${digits}${l3}${l4}`;
}

// --- НОВЕ: ID працівника у форматі aa000bb ---
export const EMPLOYEE_ID_RE = /^[a-z]{2}\d{3}[a-z]{2}$/;

export function generateEmployeeId({ email = '', fullName = '', salt = '' } = {}) {
    // детерміновано на базі вхідних даних
    return studentCode({ email, fullName, year: salt }).toLowerCase();
}

export function isEmployeeId(v) {
    return EMPLOYEE_ID_RE.test(String(v || '').trim());
}

export function ensureEmployeeId({ email = '', fullName = '', preferred = '' } = {}) {
    const raw = String(preferred || '').trim().toLowerCase();
    if (isEmployeeId(raw)) return raw;
    return generateEmployeeId({ email, fullName });
}

// MAIS-style хеш (як було)
export function maisId(namespace, raw) {
    const h = fnv1a(`${namespace}::${raw}`);
    const stamp = Math.floor(1609459200 / (60 * 60)); // 2021-01-01 UTC by hours
    return `${String(namespace || '').toUpperCase()}-${base36(h).toUpperCase()}-${csum97(h ^ stamp)}`;
}