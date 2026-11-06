// src/pages/final-thesis/FinalThesisTeacherParts/utils.jsx
export const cx = (...a) => a.filter(Boolean).join(' ');
export const slug = (s)=>String(s||'').toLowerCase().trim();
export const fmt = (d)=> new Date(d).toLocaleDateString();
export const fmtDT = (d)=>{ const dt = new Date(d); return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`; };
export const nowIso = ()=> new Date().toISOString();

export const pageNums = (page, total)=> {
    const span = 5, half = Math.floor(span/2);
    let start = Math.max(1, page - half);
    let end = Math.min(total, start + span - 1);
    if (end - start + 1 < span) start = Math.max(1, end - span + 1);
    return Array.from({length: end - start + 1}, (_,i)=>start + i);
};

export function asFilePreview(maisId, f) {
    const id = maisId('f', f.name + '|' + f.size + '|' + (f.lastModified || Math.random()));
    return { id, name: f.name, size: f.size, type: f.type, at: nowIso() };
}

export const validateFile = (f)=> {
    const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain','application/zip','image/png','image/jpeg'];
    const max = 20 * 1024 * 1024;
    if (f.size > max) return 'File too large (max 20 MB)';
    const okType = allowed.includes(f.type) || /\.docx?$|\.pdf$|\.txt$|\.zip$|\.png$|\.jpe?g$/i.test(f.name);
    if (!okType) return 'Unsupported file type';
    return null;
};