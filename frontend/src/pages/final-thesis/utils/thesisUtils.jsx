// src/pages/final-thesis/utils/thesisUtils.jsx

export const fmt = (d) => new Date(d).toLocaleDateString();
export const nowIso = () => new Date().toISOString();

const H = (s) => { let h = 2166136261 >>> 0; const x = String(s || ''); for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function asFilePreview(f) {
    const id = `file-${H(`${f.name}|${f.size}|${f.lastModified || Math.random()}`)}`;
    return { id, name: f.name, size: f.size, type: f.type, at: nowIso() };
}

export function validateFile(f) {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain', 'application/zip', 'image/png', 'image/jpeg'];
    const max = 20 * 1024 * 1024;
    if (f.size > max) return 'File too large (max 20 MB)';
    if (!allowed.includes(f.type) && !f.name.match(/\.(doc|docx|pdf|txt|zip|png|jpg|jpeg)$/i)) return 'Unsupported file type';
    return null;
}