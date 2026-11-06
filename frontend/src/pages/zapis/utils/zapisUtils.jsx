// src/pages/zapis/utils/zapisUtils.jsx

export const norm = (s = '') => String(s).trim().toLowerCase();
export const to2 = (n) => String(n).padStart(2, '0');
export const dtISO = (d) => `${d.getFullYear()}-${to2(d.getMonth() + 1)}-${to2(d.getDate())} ${to2(d.getHours())}:${to2(d.getMinutes())}`;
export const H = (s) => { let h = 2166136261 >>> 0; const x = String(s || ''); for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const mapSlotToTimes = (slot = '09:00-10:00') => { const [s, e] = String(slot).split('-'); return { start: s?.trim() || '09:00', end: e?.trim() || '10:00' }; };
export const creditsOf = (c) => Number(c?.credits ?? 6);
export const asString = (v) => (typeof v === 'string' ? v : (v && typeof v === 'object' && 'value' in v ? String(v.value) : String(v ?? '')));

export const downloadBlob = (blob, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};

export const printNow = (id) => {
    const n = document.getElementById(id);
    if (!n) return;
    const w = window.open('', '_blank', 'width=1200,height=900');
    w.document.write(`
    <html lang="en"><head><title>Print</title>
      <meta charSet="utf-8"/>
      <style>
        *{box-sizing:border-box} body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;color:#0f172a}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #e5e7eb;padding:8px 10px;font-size:12px;text-align:left;vertical-align:top}
        thead th{background:#f1f5f9;font-weight:700;position:sticky;top:0}
      </style>
    </head><body>${n.innerHTML}</body></html>
  `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
};

import { getAvailableSemesterOptions } from '../../../utils/semesterUtils';

// Generate term options dynamically based on current and next semester
export const TERM_OPTIONS = getAvailableSemesterOptions();