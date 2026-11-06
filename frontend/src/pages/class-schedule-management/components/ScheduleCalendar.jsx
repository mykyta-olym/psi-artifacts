// src/pages/components/ScheduleCalendar.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useToasts } from '../../../components/ui/Toasts';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

const asStr = (v) => String(v ?? '');

const TW_PALETTES = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-green-100 border-green-300 text-green-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-orange-100 border-orange-300 text-orange-800',
  'bg-red-100 border-red-300 text-red-800',
  'bg-pink-100 border-pink-300 text-pink-800',
  'bg-yellow-100 border-yellow-300 text-yellow-800',
  'bg-indigo-100 border-indigo-300 text-indigo-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-lime-100 border-lime-300 text-lime-800',
  'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
];
const CANVAS_PALETTES = [
  { fill: '#DBEAFE', stroke: '#93C5FD', text: '#1E40AF' },
  { fill: '#DCFCE7', stroke: '#86EFAC', text: '#14532D' },
  { fill: '#E9D5FF', stroke: '#C4B5FD', text: '#581C87' },
  { fill: '#FFEDD5', stroke: '#FDBA74', text: '#7C2D12' },
  { fill: '#FEE2E2', stroke: '#FCA5A5', text: '#7F1D1D' },
  { fill: '#FCE7F3', stroke: '#F9A8D4', text: '#831843' },
  { fill: '#FEF9C3', stroke: '#FDE68A', text: '#854D0E' },
  { fill: '#E0E7FF', stroke: '#A5B4FC', text: '#3730A3' },
  { fill: '#CCFBF1', stroke: '#5EEAD4', text: '#134E4A' },
  { fill: '#CFFAFE', stroke: '#67E8F9', text: '#164E63' },
  { fill: '#ECFCCB', stroke: '#BEF264', text: '#3F6212' },
  { fill: '#FAE8FF', stroke: '#E879F9', text: '#701A75' },
];
const CANVAS_DEFAULT = { fill: '#F3F4F6', stroke: '#D1D5DB', text: '#111827' };

const TW_ACCENTS = [
  'bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500',
  'bg-red-500','bg-pink-500','bg-yellow-500','bg-indigo-500',
  'bg-teal-500','bg-cyan-500','bg-lime-500','bg-fuchsia-500',
];

const hash = (s) => {
  let h = 2166136261 >>> 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const pickIndex = (seed) => hash(seed) % TW_PALETTES.length;

const buildSubjectPalettes = (courseList = []) => {
  const map = new Map();
  (courseList || []).forEach((c) => {
    const codeSeed = c?.code || c?.id || c?.nameEn || c?.nameSk || '';
    const idx = pickIndex(codeSeed);
    const palette = { tw: TW_PALETTES[idx], canvas: CANVAS_PALETTES[idx] || CANVAS_DEFAULT };
    [c?.nameEn, c?.nameSk].filter(Boolean).forEach((name) => {
      if (!map.has(name)) map.set(name, palette);
    });
  });
  return map;
};
const fallbackPalette = (subject) => {
  const idx = pickIndex(subject || 'default');
  return { tw: TW_PALETTES[idx], canvas: CANVAS_PALETTES[idx] || CANVAS_DEFAULT };
};

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
const fmt12h = (t) => {
  const [h] = String(t).split(':');
  const hour = parseInt(h,10);
  if (hour === 12) return '12:00 PM';
  if (hour > 12) return `${hour-12}:00 PM`;
  return `${hour}:00 AM`;
};
const ymd = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const dtWithTime = (base, hhmm) => { const [hh,mm] = String(hhmm).split(':').map(n=>parseInt(n,10)); const d = new Date(base); d.setHours(hh,mm,0,0); return d; };

const useDeviceFlags = () => {
  const [isTouch, setIsTouch] = useState(false);
  const [isSmall, setIsSmall] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  useEffect(() => {
    const check = () => {
      const touch = 'ontouchstart' in window || (navigator?.maxTouchPoints || 0) > 0;
      setIsTouch(touch);
      setIsSmall(window.innerWidth < 1024);
    };
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => setAnimationsEnabled(!(m && m.matches));
    onMotion();
    m?.addEventListener?.('change', onMotion);
    check();
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      m?.removeEventListener?.('change', onMotion);
    };
  }, []);
  return { isTouch, isSmall, animationsEnabled };
};

const sanitizeAbbrevText = (s) =>
    String(s || '').replace(/\s*\([^)]*\)/g, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();

const useDragAutoscroll = (containerRef, isDragging) => {
  const rafRef = useRef(null);
  const velRef = useRef({ vx: 0, vy: 0 });
  const tick = useCallback(() => {
    const el = containerRef.current;
    const { vx, vy } = velRef.current;
    if (!el || (!vx && !vy)) { rafRef.current = requestAnimationFrame(tick); return; }
    const maxX = el.scrollWidth - el.clientWidth;
    const maxY = el.scrollHeight - el.clientHeight;
    if (vx < 0 && el.scrollLeft > 0) el.scrollLeft += vx;
    else if (vx > 0 && el.scrollLeft < maxX) el.scrollLeft += vx;
    if (vy < 0 && el.scrollTop > 0) el.scrollTop += vy;
    else if (vy > 0 && el.scrollTop < maxY) el.scrollTop += vy;
    rafRef.current = requestAnimationFrame(tick);
  }, [containerRef]);
  useEffect(() => {
    if (!isDragging) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; velRef.current = { vx: 0, vy: 0 }; return;
    }
    const edge = 48;
    const maxV = 28;
    const onMove = (clientX, clientY) => {
      const el = containerRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      let vx = 0, vy = 0;
      const x = clientX - r.left; const y = clientY - r.top;
      if (x < edge) vx = -Math.ceil(((edge - x) / edge) * maxV);
      else if (x > r.width - edge) vx = Math.ceil(((x - (r.width - edge)) / edge) * maxV);
      if (y < edge) vy = -Math.ceil(((edge - y) / edge) * maxV);
      else if (y > r.height - edge) vy = Math.ceil(((y - (r.height - edge)) / edge) * maxV);
      velRef.current = { vx, vy };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    };
    const pm = (e) => onMove(e.clientX, e.clientY);
    window.addEventListener('pointermove', pm, { passive: true });
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', pm);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; velRef.current = { vx: 0, vy: 0 };
    };
  }, [isDragging, tick]);
};

const cellId = (day, time) => `${day}|||${time}`;
const parseCellId = (id) => {
  if (!id) return null;
  const [d, t] = String(id).split('|||');
  return d && t ? { day: d, time: t } : null;
};

const ScheduleCalendar = ({
                            scheduleData,
                            selectedWeek,
                            onScheduleClick,
                            onTimeSlotClick,
                            viewMode = 'week',
                            userRole = 'teacher',
                            availableMode = false,
                            exportContext = { owner: 'All Teachers', viewMode: 'week' },
                            currentTeacherName = '',
                            currentTeacherEmail = '',
                            canManageAll = false,
                            onNotify,
                            weekDays = ['Monday','Tuesday','Wednesday','Thursday','Friday'],
                            timeSlots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'],
                            coursesList = [],
                          }) => {
  const SUBJECT_PALETTES = useMemo(() => buildSubjectPalettes(coursesList), [coursesList]);
  const paletteFor = useCallback((subject) => SUBJECT_PALETTES.get(subject) || fallbackPalette(subject), [SUBJECT_PALETTES]);
  const getTW = useCallback((subject) => paletteFor(subject).tw, [paletteFor]);
  const getCanvas = useCallback((subject) => paletteFor(subject).canvas, [paletteFor]);
  const getAccent = useCallback((subject) => {
    const idx = pickIndex(subject || 'default');
    return TW_ACCENTS[idx] || 'bg-primary';
  }, []);

  const ownerDisplay = useMemo(
      () => asStr((exportContext && exportContext.owner) || currentTeacherName || 'Schedule'),
      [exportContext, currentTeacherName]
  );

  const { isTouch, isSmall, animationsEnabled } = useDeviceFlags();

  const [isDragging, setIsDragging] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

  const scrollerRef = useRef(null);
  const rootRef = useRef(null);
  const topBarRef = useRef(null);
  const daysHeaderRef = useRef(null);
  const bottomBarRef = useRef(null);
  const [rowH, setRowH] = useState(null);

  const [hoverCell, setHoverCell] = useState(null);
  const [guard, setGuard] = useState(null);
  const guardTimer = useRef(null);
  const { notify } = useToasts();
  const toastLocks = useRef({});
  const guardedNotify = useCallback((key, type, message, opts = {}) => {
    if (key) {
      const now = Date.now();
      const lock = opts.lockMs ?? 2800;
      const prev = toastLocks.current[key] ?? 0;
      if (now - prev < lock) return;
      toastLocks.current[key] = now;
    }
    notify(type, message, opts);
  }, [notify]);
  const toastTitles = useRef({
    success: 'Schedule updated',
    error: 'Schedule warning',
    warning: 'Action blocked',
    info: 'Schedule info',
  });
  const [exportOpen, setExportOpen] = useState(false);

  const weekStart = useMemo(() => startOfWeek(selectedWeek || new Date()), [selectedWeek]);
  const dayIndex = useCallback((name) => weekDays.indexOf(name), [weekDays]);

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      return weekDays.filter(d => String(d).toLowerCase() === todayName.toLowerCase());
    }
    return weekDays;
  }, [viewMode, weekDays]);

  const getForSlot = useCallback((day, time) =>
          (scheduleData || []).find(i => i?.day === day && i?.time === time),
      [scheduleData]);

  const postNotify = useCallback((type, message) => {
    // Use guardedNotify if available
    if (guardedNotify) {
      const title = toastTitles.current[type] || toastTitles.current.info;
      guardedNotify(`schedule-calendar-${type}-${Date.now()}`, type, message, { title, lockMs: 2200 });
      return;
    }
    // Fallback to onNotify if guardedNotify is not available
    onNotify?.(type, message);
    if (guardTimer.current) clearTimeout(guardTimer.current);
    setGuard({ type, message });
    guardTimer.current = setTimeout(() => setGuard(null), 2000);
  }, [onNotify, guardedNotify]);

  const canDragItem = useCallback((item) => {
    // Locked items (students enrolled) cannot be dragged
    if (item && (item.locked || (item.enrollmentsCount || 0) > 0)) return false;
    if (canManageAll) return true;
    if (userRole !== 'teacher') return false;
    if (!currentTeacherEmail) return false;
    return (item?.teacherEmail || '').toLowerCase() === String(currentTeacherEmail).toLowerCase();
  }, [canManageAll, userRole, currentTeacherEmail]);

  const normalizeRoom = useCallback((r) => String(r || '').trim().toLowerCase(), []);
  const conflictIndex = useMemo(() => {
    const idx = new Map();
    (scheduleData || []).forEach(e => {
      const room = normalizeRoom(e.room);
      if (!room) return;
      const key = `${e.day}||${e.time}||${room}`;
      idx.set(key, (idx.get(key) || 0) + 1);
    });
    return idx;
  }, [scheduleData, normalizeRoom]);
  const hasConflict = useCallback((e) => {
    const room = normalizeRoom(e.room);
    if (!room) return false;
    return (conflictIndex.get(`${e.day}||${e.time}||${room}`) || 0) > 1;
  }, [conflictIndex, normalizeRoom]);

  const computeEvents = useCallback(() => {
    const set = new Set(visibleDays);
    return (scheduleData||[])
        .filter(e => set.has(e.day))
        .map(e => {
          const base = addDays(weekStart, dayIndex(e.day));
          return { ...e, hasConflict: hasConflict(e), baseDate: base, start: dtWithTime(base, e.time), end: dtWithTime(base, e.endTime || e.time) };
        })
        .sort((a,b)=>a.start-b.start);
  }, [visibleDays, scheduleData, weekStart, dayIndex, hasConflict]);

  const exportName = useCallback(() => {
    const first = addDays(weekStart, dayIndex(visibleDays[0]));
    const last = addDays(weekStart, dayIndex(visibleDays[visibleDays.length-1]));
    const owner = ownerDisplay.replace(/\s+/g,'-');
    return `schedule_${owner}_${ymd(first)}${visibleDays.length>1?`_to_${ymd(last)}`:''}`;
  }, [weekStart, visibleDays, dayIndex, ownerDisplay]);

  const download = useCallback((blob, filename) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=u; a.download=filename; a.click(); URL.revokeObjectURL(u); }, []);

  const exportCSV = useCallback(() => {
    const evts = computeEvents();
    const header = ['Date','Day','Start','End','Subject','Teacher','Grade','Room','ClassGroups','Conflict','Type','Notes'];
    const lines = [
      `# Owner: ${ownerDisplay}`,
      `# View: ${exportContext?.viewMode||''}`,
      `# Generated: ${new Date().toISOString()}`,
      header.join(',')
    ];
    evts.forEach(e=>{
      const groupsRaw = e.classGroupText || (e.classGroupLabels||[]).join(', ') || (e.classGroupKeys||[]).join(', ');
      const row = [
        ymd(e.baseDate), e.day, e.time, e.endTime||'',
        e.subject, e.teacher||'', e.grade||'', e.room||'',
        sanitizeAbbrevText(groupsRaw),
        e.hasConflict ? 'YES' : 'NO',
        e.kind || '',
        (e.notes||'').replace(/"/g,'""')
      ].map(v=>{
        const s = String(v ?? '');
        return (s.includes(',')||s.includes('"'))?`"${s}"`:s;
      }).join(',');
      lines.push(row);
    });
    download(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'}), `${exportName()}.csv`);
    setExportOpen(false);
  }, [computeEvents, ownerDisplay, exportContext, download, exportName]);

  const exportICS = useCallback(() => {
    const evts = computeEvents();
    const fmt = (d) => {
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
      const h=String(d.getHours()).padStart(2,'0'), mi=String(d.getMinutes()).padStart(2,'0');
      return `${y}${m}${dd}T${h}${mi}00`;
    };
    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SchoolSync Pro//Schedule Export//EN','CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${ownerDisplay}`
    ];
    evts.forEach(e=>{
      const uid = `${e.id || Math.random().toString(36).slice(2)}@schoolsync`;
      lines.push(
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${fmt(new Date())}`,
          `DTSTART:${fmt(e.start)}`,
          e.endTime?`DTEND:${fmt(e.end)}`:'',
          `SUMMARY:${e.subject}${e.grade?` — ${e.grade}`:''}${e.room?` — ${e.room}`:''}${e.kind?` [${e.kind}]`:''}`,
          e.room?`LOCATION:${e.room}`:'',
          e.teacher?`DESCRIPTION:Teacher: ${e.teacher}${e.notes?`\\nNotes: ${e.notes}`:''}`:(e.notes?`DESCRIPTION:${e.notes}`:''),
          'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    download(new Blob([lines.filter(Boolean).join('\n')],{type:'text/calendar;charset=utf-8;'}), `${exportName()}.ics`);
    setExportOpen(false);
  }, [computeEvents, ownerDisplay, download, exportName]);

  const exportPNG = useCallback(() => {
    const ellipsize = (ctx, text, maxWidth) => {
      if (!text) return '';
      if (ctx.measureText(text).width <= maxWidth) return text;
      let low = 0, high = text.length;
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const slice = text.slice(0, mid) + '…';
        if (ctx.measureText(slice).width <= maxWidth) low = mid;
        else high = mid - 1;
      }
      return text.slice(0, low) + '…';
    };

    const evts = computeEvents();
    const dayCount = visibleDays.length, rowCount = timeSlots.length;
    const cellW = 220, timeColW = 120, cellH = 96, headerH = 56, legendH = 56, titleH = 60;
    const width = timeColW + cellW*dayCount + 2;
    const height = titleH + headerH + rowCount*cellH + legendH + 2;
    const scale = window.devicePixelRatio>1 ? 2 : 1;

    const canvas = document.createElement('canvas');
    canvas.width = width*scale; canvas.height = height*scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);

    const first = addDays(weekStart, dayIndex(visibleDays[0]));
    const last  = addDays(weekStart, dayIndex(visibleDays[dayCount-1]));
    ctx.fillStyle = '#111827'; ctx.font = '600 18px Inter, system-ui, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(ownerDisplay, 16, 28);
    ctx.font = '400 12px Inter, system-ui, Segoe UI, Roboto, Arial'; ctx.fillStyle = '#6B7280';
    ctx.fillText(`${exportContext?.viewMode==='day'?'Day View':'Week View'} • ${first.toLocaleDateString()}${dayCount>1?' — '+last.toLocaleDateString():''}`, 16, 46);

    const headerY = titleH;
    ctx.fillStyle = '#F3F4F6'; ctx.fillRect(0, headerY, timeColW, headerH);
    ctx.strokeStyle = '#E5E7EB'; ctx.strokeRect(0, headerY, timeColW, headerH);
    ctx.fillStyle = '#6B7280'; ctx.font = '500 12px Inter, system-ui'; ctx.fillText('Time', 16, headerY+34);

    visibleDays.forEach((day, i)=>{
      const x = timeColW + i*cellW;
      ctx.fillStyle = '#F3F4F6'; ctx.fillRect(x, headerY, cellW, headerH);
      ctx.strokeStyle = '#E5E7EB'; ctx.strokeRect(x, headerY, cellW, headerH);
      const date = addDays(weekStart, dayIndex(day));
      ctx.fillStyle = '#111827'; ctx.font = '600 13px Inter, system-ui';
      const tw = ctx.measureText(day).width; ctx.fillText(day, x+(cellW-tw)/2, headerY+22);
      ctx.fillStyle = '#6B7280'; ctx.font = '400 11px Inter, system-ui';
      const sub = date.toLocaleDateString('en-US',{month:'short', day:'numeric'});
      const sw = ctx.measureText(sub).width; ctx.fillText(sub, x+(cellW-sw)/2, headerY+38);
    });

    const gridY = headerY + headerH;
    for (let r=0;r<rowCount;r++){
      const y = gridY + r*cellH;
      ctx.fillStyle = '#F9FAFB'; ctx.fillRect(0,y,timeColW,cellH);
      ctx.strokeStyle = '#E5E7EB'; ctx.strokeRect(0,y,timeColW,cellH);
      ctx.fillStyle = '#374151'; ctx.font = '500 12px Inter, system-ui';
      ctx.fillText(fmt12h(timeSlots[r]), 16, y + cellH/2 + 4);
      for (let c=0;c<dayCount;c++){
        const x = timeColW + c*cellW;
        ctx.strokeStyle = '#E5E7EB'; ctx.strokeRect(x,y,cellW,cellH);
      }
    }

    evts.forEach(e=>{
      const c = visibleDays.indexOf(e.day);
      const r = timeSlots.indexOf(e.time);
      if (c<0 || r<0) return;

      const x = timeColW + c*cellW + 6;
      const y = gridY + r*cellH + 6;
      const w = cellW - 12;
      const h = cellH - 12;

      const pal = getCanvas(e.subject);
      const ctx2 = ctx;
      ctx2.fillStyle = pal.fill; ctx2.strokeStyle = pal.stroke; ctx2.lineWidth = 2;
      const rad = 8;
      ctx2.beginPath();
      ctx2.moveTo(x+rad,y); ctx2.lineTo(x+w-rad,y); ctx2.quadraticCurveTo(x+w,y,x+w,y+rad);
      ctx2.lineTo(x+w,y+h-rad); ctx2.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);
      ctx2.lineTo(x+rad,y+h); ctx2.quadraticCurveTo(x,y+h,x,y+h-rad);
      ctx2.lineTo(x,y+rad); ctx2.quadraticCurveTo(x,y,x+rad,y); ctx2.closePath();
      ctx2.fill(); ctx2.stroke();

      const leftPad = 10;
      const rightPad = 40;
      const textMaxWidth = Math.max(30, w - leftPad - rightPad);

      ctx2.fillStyle = pal.text;
      ctx2.font = '700 12px Inter, system-ui';
      ctx2.textAlign = 'start'; ctx2.textBaseline = 'alphabetic';
      const subj = (e.subject || '').split(/\s+/).join(' ');
      const subLines = (()=> {
        const words = subj.split(/\s+/);
        const lines = []; let cur = '';
        for (let i=0;i<words.length;i++){
          const w2 = words[i];
          const test = cur ? cur + ' ' + w2 : w2;
          if (ctx2.measureText(test).width <= textMaxWidth) cur = test;
          else { if (cur) lines.push(cur); cur = w2; }
          if (lines.length === 1 && i < words.length - 1) {
            const rest = (cur ? cur + ' ' : '') + words.slice(i + 1).join(' ');
            if (ctx2.measureText(rest).width > textMaxWidth) { lines.push(ellipsize(ctx2, rest, textMaxWidth)); return lines; }
          }
        }
        if (cur) lines.push(cur);
        return lines.slice(0,2);
      })();
      subLines.forEach((ln, idx) => { ctx2.fillText(ln, x + leftPad, y + 16 + idx*14); });

      ctx2.font = '400 11px Inter, system-ui';
      ctx2.globalAlpha = .9;
      const roomY = y + 16 + (subLines.length ? subLines.length*14 + 4 : 14);
      const roomTxt = (e.room || '').trim();
      if (roomTxt) ctx2.fillText(roomTxt, x + leftPad, roomY);

      const teacherY = roomY + 14;
      const teacherTxt = e.teacher || '';
      if (teacherTxt) ctx2.fillText(teacherTxt, x + leftPad, teacherY);
      ctx2.globalAlpha = 1;

      const groupsRaw = e.classGroupText || (e.classGroupLabels||[]).join(', ') || (e.classGroupKeys||[]).join(', ');
      const groupsText = sanitizeAbbrevText(groupsRaw);
      if (groupsText) {
        ctx2.font = 'italic 400 11px Inter, system-ui';
        const words = groupsText.split(/\s+/);
        let cur = ''; let line = 0; let yy = teacherY + 14;
        for (let i = 0; i < words.length && line < 2; i++) {
          const w2 = words[i];
          const test = cur ? cur + ' ' + w2 : w2;
          if (ctx2.measureText(test).width <= textMaxWidth) cur = test;
          else { ctx2.fillText(cur, x+leftPad, yy); yy += 13; line++; cur = w2; }
        }
        if (line < 3 && cur) ctx2.fillText(cur, x+leftPad, teacherY + 14 + line*13);
      }

      const kindTxt = String(e.kind || '').toUpperCase();
      if (kindTxt) {
        ctx2.font = '700 10px Inter, system-ui';
        const bw = Math.max(18, ctx2.measureText(kindTxt).width + 10);
        const bx = x + w - bw - 8;
        const by = y + 6;
        ctx2.fillStyle = '#F3F4F6';
        ctx2.strokeStyle = '#D1D5DB';
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.roundRect ? ctx2.roundRect(bx, by, bw, 18, 6) : ctx2.rect(bx, by, bw, 18);
        ctx2.fill();
        ctx2.stroke();
        ctx2.fillStyle = '#111827';
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        ctx2.fillText(kindTxt, bx + bw/2, by + 9);
        ctx2.textAlign = 'start';
        ctx2.textBaseline = 'alphabetic';
      }

      if (e.hasConflict){
        const pad = 8; const rBadge = 7;
        const cx = x + w - pad - rBadge;
        const cy = y + pad + rBadge + (kindTxt ? 22 : 0);
        ctx2.fillStyle = '#F59E0B';
        ctx2.beginPath(); ctx2.arc(cx,cy,rBadge,0,Math.PI*2); ctx2.fill();
        ctx2.fillStyle = '#111827';
        ctx2.font = '700 10px Inter, system-ui';
        const prevAlign = ctx2.textAlign, prevBase = ctx2.textBaseline;
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillText('!', cx, cy);
        ctx2.textAlign = prevAlign; ctx2.textBaseline = prevBase;
      }
    });

    const legendY = height - 56 + 8;
    ctx.fillStyle = '#6B7280';
    ctx.font = '500 12px Inter, system-ui';
    ctx.fillText('Subjects:', 16, legendY + 14);

    const legendSubjectsCanvas = Array.from(new Set(evts.map(e => e.subject).filter(Boolean))).slice(0, 6);
    let lx = 90;
    legendSubjectsCanvas.forEach((name) => {
      const pal = getCanvas(name);
      const abbr = sanitizeAbbrevText(
          (name || '').split(/\s+/).map(w=>w[0]).join('').slice(0,6).toUpperCase() || name.slice(0,6).toUpperCase()
      );
      ctx.fillStyle = pal.fill; ctx.strokeStyle = pal.stroke; ctx.lineWidth = 2;
      ctx.fillRect(lx, legendY+4, 14, 14);
      ctx.strokeRect(lx, legendY+4, 14, 14);
      ctx.fillStyle = '#6B7280'; ctx.font = '400 11px Inter, system-ui';
      ctx.fillText(abbr, lx + 20, legendY + 16);
      const step = Math.max(80, ctx.measureText(abbr).width + 40);
      lx += step;
    });

    canvas.toBlob((b)=> b && download(b, `${exportName()}.png`), 'image/png');
    setExportOpen(false);
  }, [computeEvents, visibleDays, timeSlots, weekStart, dayIndex, ownerDisplay, exportContext, getCanvas, download, exportName]);

  const availableCount = useMemo(()=>{
    let cnt=0;
    visibleDays.forEach(d=>{
      timeSlots.forEach(t=>{ if (!getForSlot(d,t)) cnt++; });
    });
    return cnt;
  }, [visibleDays, scheduleData, timeSlots, getForSlot]);

  const StyleKeyframes = () => (
      <style>{`
      .cursor-nope { cursor: not-allowed !important; }
      .card-anim { transition: opacity .18s ease; }
      .card-hidden { opacity: 0 !important; visibility: hidden !important; }
      .cell-available { background: rgba(16,185,129,.06); }
      .cell-available:hover { background: rgba(16,185,129,.12); }
      .cell-available .plus-floater { opacity:.65; transform: scale(.96); transition: opacity .18s ease, transform .18s ease; }
      .cell-available:hover .plus-floater { opacity:1; transform: scale(1); }
      .touch-fix { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
      .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    `}</style>
  );

  useEffect(() => {
    return () => {
      if (guardTimer.current) clearTimeout(guardTimer.current);
    };
  }, []);

  useEffect(() => {
    const recalc = () => {
      const root = rootRef.current;
      const top = topBarRef.current;
      const days = daysHeaderRef.current;
      const bottom = bottomBarRef.current;
      if (!root || !top || !days || !bottom) return;
      const avail = root.clientHeight - top.offsetHeight - bottom.offsetHeight;
      const headerH = days.offsetHeight;
      const gridAvail = avail - headerH;
      const rows = timeSlots.length || 1;
      let h = Math.floor(gridAvail / rows);
      if (window.innerWidth >= 1024) h = Math.max(52, h);
      setRowH(h);
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [timeSlots.length, visibleDays.length, viewMode]);

  const renderGroups = useCallback((item) => {
    const raw = item?.classGroupText ||
        (item?.classGroupLabels || []).join(', ') ||
        (item?.classGroupKeys || []).join(', ');
    const text = sanitizeAbbrevText(raw);
    if (!text) return null;
    return (
        <div className="mt-1 text-[11px] italic leading-tight text-foreground/80 whitespace-normal break-words">
          {text}
        </div>
    );
  }, []);

  useDragAutoscroll(scrollerRef, isDragging);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: isTouch ? { delay: 220, tolerance: 12 } : { distance: 6 }
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const onDragStart = useCallback((event) => {
    const data = event.active?.data?.current || {};
    const item = data.item;
    if (!item || !canDragItem(item)) {
      setActiveItem(null);
      setIsDragging(false);
      return;
    }
    const rect = event.active?.rect?.current?.initial;
    setOverlaySize({
      width: rect?.width || 0,
      height: rect?.height || 0
    });
    setActiveItem(item);
    setDragFrom({ day: item.day, time: item.time });
    setIsDragging(true);
  }, [canDragItem]);

  const onDragMove = useCallback((event) => {
    const hit = parseCellId(event.over?.id);
    setDragTarget(prev => {
      const next = hit ? { day: hit.day, time: hit.time } : null;
      if ((prev?.day || '') === (next?.day || '') && (prev?.time || '') === (next?.time || '')) return prev;
      return next;
    });
  }, []);

  const onDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveItem(null);
    setDragFrom(null);
    setDragTarget(null);
    setOverlaySize({ width: 0, height: 0 });
  }, []);

  const onDragEnd = useCallback((event) => {
    const data = event.active?.data?.current || {};
    const item = data.item;
    const target = parseCellId(event.over?.id);
    setIsDragging(false);
    if (!item || !target) { onDragCancel(); return; }
    if (dragFrom && dragFrom.day === target.day && dragFrom.time === target.time) { onDragCancel(); return; }
    if (!canDragItem(item)) { postNotify('error', 'Forbidden move: not your class'); onDragCancel(); return; }
    if (getForSlot(target.day, target.time)) { postNotify('error', 'Slot occupied'); onDragCancel(); return; }
    const ok = onTimeSlotClick(target.day, target.time, item);
    if (!ok) { onDragCancel(); return; }
    setActiveItem(null);
    setDragFrom(null);
    setDragTarget(null);
    setOverlaySize({ width: 0, height: 0 });
  }, [dragFrom, canDragItem, getForSlot, postNotify, onTimeSlotClick, onDragCancel]);

  const CardBase = ({ item, conflict, className = '' }) => (
      <div className={`relative rounded-md border p-2 sm:p-2.5 bg-card text-foreground min-h-[88px] flex ${className}`}>
        <span aria-hidden className={`absolute left-1 top-1 bottom-1 w-1.5 rounded-full ${getAccent(item?.subject)}`} />
        <div className="pl-3.5 sm:pl-4 pr-12 sm:pr-12 pb-6 flex-1 flex flex-col">
          <div className="flex items-start gap-1.5">
            <div className="text-[12px] sm:text-xs font-semibold leading-4 whitespace-normal break-words">
              {item?.subject}
            </div>
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 whitespace-normal break-words">
            {item?.room || '—'}
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 whitespace-normal break-words">
            {item?.teacher || '—'}
          </div>
          {renderGroups(item)}
          <div className="mt-auto" />
        </div>

        {conflict && (
            <div className="absolute top-1.5 right-1.5 z-10">
              <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-warning text-[10px] sm:text-[11px] font-bold text-background shadow-sm">!</span>
            </div>
        )}

        {item?.kind ? (
            <div className="absolute bottom-1.5 right-1.5 z-10">
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-muted text-[10px] font-semibold text-foreground/90 uppercase border border-border">
            {String(item.kind).toUpperCase()}
          </span>
            </div>
        ) : null}
      </div>
  );

  const DraggableCard = memo(({ item }) => {
    const id = `itm|${item?.id ?? `${item.day}-${item.time}-${item.subject}`}`;
    const canDrag = canDragItem(item);
    const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
      id,
      data: { item },
      disabled: !canDrag
    });
    const conflict = hasConflict(item);
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`w-full ${userRole==='teacher' ? 'cursor-pointer' : 'cursor-default'} card-anim touch-fix ${(userRole==='teacher' && !canDrag) ? 'cursor-nope opacity-95' : ''} ${isDragging ? 'card-hidden' : ''} ${availableMode ? 'opacity-95' : ''} select-none`}
            style={{ touchAction: 'none' }}
            onClick={(e)=>{
              if (isDragging) return;
              e.stopPropagation();
              onScheduleClick(item);
            }}
        >
          <CardBase item={item} conflict={conflict} />
        </div>
    );
  });

  const DroppableCell = memo(({ day, time, children, className }) => {
    const { setNodeRef, isOver } = useDroppable({ id: cellId(day, time) });
    return (
        <div ref={setNodeRef} data-cell="1" data-day={day} data-time={time} className={`${className} relative`}>
          {isOver ? (
              <div className="absolute inset-1 rounded-md bg-primary/10 pointer-events-none" />
          ) : null}
          {children}
        </div>
    );
  });

  return (
      <div ref={rootRef} className="bg-card rounded-none sm:rounded-lg border border-border overflow-hidden relative h-[100dvh] md:h-[100svh] flex flex-col">
        <StyleKeyframes />
        <div ref={topBarRef} className="bg-muted/50 px-3 sm:px-4 py-3 sm:py-4 border-b border-border flex-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">
              {viewMode === 'day' ? 'Day Schedule' : 'Weekly Schedule'}
            </h3>
            <div className="flex items-center gap-2 relative">
              {availableMode && userRole === 'teacher' && (
                  <div className="px-2 py-1 rounded-md bg-success/10 text-success text-xs sm:text-sm border border-success/20">
                    <Icon name="Clock" size={14} className="mr-1 inline-block align-[-2px]" />
                    {availableCount} free {availableCount === 1 ? 'slot' : 'slots'}
                  </div>
              )}
              <div className="relative">
                <Button variant="outline" size="sm" onClick={()=>setExportOpen(v=>!v)}>
                  <Icon name="Download" size={16} className="mr-2" />
                  Export
                </Button>
                <AnimatePresence>
                  {exportOpen && (
                      <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.95 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className="absolute right-0 mt-2 w-44 sm:w-48 bg-popover border border-border rounded-md shadow-modal z-20 overflow-hidden"
                      >
                          <motion.button
                              whileHover={{ backgroundColor: 'rgba(148,163,184,0.18)' }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full text-left px-3 py-2 text-sm transition-colors"
                              onClick={exportCSV}
                          >
                            Export as CSV
                          </motion.button>
                          <motion.button
                              whileHover={{ backgroundColor: 'rgba(148,163,184,0.18)' }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full text-left px-3 py-2 text-sm transition-colors"
                              onClick={exportICS}
                          >
                            Export as ICS
                          </motion.button>
                          <motion.button
                              whileHover={{ backgroundColor: 'rgba(148,163,184,0.18)' }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full text-left px-3 py-2 text-sm transition-colors"
                              onClick={exportPNG}
                          >
                            Export as PNG
                          </motion.button>
                      </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {guard && !guardedNotify && (
            <div className="absolute top-2 right-2 z-20">
              <div className={`px-3 py-2 rounded-md shadow-sm border text-sm
            ${guard.type==='error' ? 'bg-error/10 text-error border-error/20' :
                  guard.type==='warning' ? 'bg-warning/10 text-warning border-warning/20' :
                      'bg-muted text-foreground border-border'}`}>
                {guard.message}
              </div>
            </div>
        )}

        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
        >
          <div
              ref={scrollerRef}
              className={`flex-1 overflow-x-auto overflow-y-auto
            pb-[env(safe-area-inset-bottom)]
            overscroll-contain
            [scrollbar-width:auto]
            [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2
            [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-resizer]:bg-transparent`}
          >
            <div className="min-w-[680px] sm:min-w-[820px] lg:min-w-[980px] xl:min-w-[1080px]">
              <div ref={daysHeaderRef} className={`grid ${viewMode==='day'?'grid-cols-2':'grid-cols-6'} border-b border-border bg-card`}>
                <div className="p-2 sm:p-3 bg-muted/30 border-r border-border">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Time</span>
                </div>
                {visibleDays.map((day0)=>{
                  const day = asStr(day0);
                  const date = addDays(weekStart, dayIndex(day));
                  const isCol = hoverCell?.day === day || dragTarget?.day === day;
                  return (
                      <div key={day} className={`p-2 sm:p-3 ${isCol && animationsEnabled ? 'bg-primary/10' : 'bg-muted/30'} border-r border-border last:border-r-0`}>
                        <div className="text-center">
                          <div className="text-sm sm:text-base font-medium text-foreground">{day}</div>
                          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            {date.toLocaleDateString('en-US',{month:'short', day:'numeric'})}
                          </div>
                        </div>
                      </div>
                  );
                })}
              </div>

              {timeSlots.map((time0)=>{
                const time = asStr(time0);
                return (
                    <div
                        key={time}
                        className={`grid ${viewMode==='day'?'grid-cols-2':'grid-cols-6'} border-b border-border last:border-b-0`}
                        style={!isSmall && rowH ? { minHeight: `${rowH}px` } : undefined}
                    >
                      <div className="p-2 sm:p-3 border-r border-border flex items-center bg-muted/20">
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground">{fmt12h(time)}</span>
                      </div>

                      {visibleDays.map((day0)=>{
                        const day = asStr(day0);
                        const item = getForSlot(day, time);
                        const empty = !item;
                        const isDropTarget = dragTarget && dragTarget.day === day && dragTarget.time === time;
                        const occupiedWhileDragging = isDragging && getForSlot(day, time);
                        const isAvailableCell = availableMode && empty;

                        const clickAdd = () => {
                          onTimeSlotClick(day, time);
                        };

                        const conflict = item ? hasConflict(item) : false;

                        return (
                            <DroppableCell
                                key={`${day}-${time}`}
                                day={day}
                                time={time}
                                className={`group ${isSmall ? 'min-h-[88px]' : 'min-h-0'} p-1.5 sm:p-2 border-r border-border last:border-r-0 relative`}
                            >
                              <div
                                  onMouseEnter={()=>!isTouch && setHoverCell({ day, time })}
                                  onMouseLeave={()=>{ if (!isTouch && hoverCell?.day===day && hoverCell?.time===time) setHoverCell(null); }}
                                  onClick={()=>{
                                    if (empty && userRole==='teacher') {
                                      if (!availableMode) { postNotify('warning', 'Enable “Available Slots” to add classes'); return; }
                                      clickAdd();
                                    }
                                  }}
                                  style={{ cursor: empty && userRole==='teacher' ? (availableMode ? 'pointer' : 'default') : 'auto' }}
                                  className="w-full h-full"
                              >
                                {isAvailableCell && userRole === 'teacher' && (
                                    <>
                                      <div className="absolute inset-1 rounded-md bg-success/5 pointer-events-none" />
                                      <div className="absolute left-2 top-2 plus-floater">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success/90">
                                  <Icon name="Plus" size={12} />
                                  Add class
                                </span>
                                      </div>
                                    </>
                                )}

                                {isDragging && isDropTarget && empty && activeItem && (
                                    <div className="absolute inset-1 rounded-md bg-primary/10 flex flex-col justify-center px-2">
                                      <div className="text-xs font-semibold whitespace-normal break-words">{activeItem.subject}</div>
                                      <div className="text-[11px] opacity-80 whitespace-normal break-words mt-1">{activeItem.teacher}</div>
                                      <div className="text-[10px] opacity-70 mt-1">{activeItem.room || ''}</div>
                                    </div>
                                )}

                                {isDragging && isDropTarget && occupiedWhileDragging && (
                                    <div className="absolute inset-0 bg-error/10 flex items-center justify-center">
                              <span className="text-error text-xs font-medium flex items-center">
                                <Icon name="Ban" size={14} /> Occupied
                              </span>
                                    </div>
                                )}

                                {item ? <DraggableCard item={item} /> : null}
                              </div>
                            </DroppableCell>
                        );
                      })}
                    </div>
                );
              })}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeItem ? (
                <div
                    className="pointer-events-none"
                    style={{
                      width: overlaySize.width || undefined,
                      height: overlaySize.height || undefined
                    }}
                >
                  <CardBase item={activeItem} conflict={hasConflict(activeItem)} className="shadow-xl" />
                </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div ref={bottomBarRef} className="px-3 sm:px-4 py-3 sm:py-4 bg-muted/30 border-t border-border flex-none">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Subjects:</span>
              <div className="flex items-center gap-3 flex-wrap">
                {Array.from(new Set((scheduleData||[]).filter(e=>visibleDays.includes(e.day)).map(e=>asStr(e.subject)))).slice(0,6).map((sub)=>{
                  const palTW = getTW(sub);
                  const ab = sanitizeAbbrevText((sub || '').split(/\s+/).map(w=>w[0]).join('').slice(0,6).toUpperCase() || sub.slice(0,6).toUpperCase());
                  return (
                      <div key={sub} className="flex items-center space-x-1">
                        <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded border-2 ${palTW}`} />
                        <span className="text-[11px] sm:text-xs text-muted-foreground">{ab}</span>
                      </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-4 text-[11px] sm:text-xs text-muted-foreground">
              {userRole === 'teacher' && (
                  <div className="flex items-center space-x-1">
                    <Icon name="Hand" size={12} className="text-primary" />
                    <span>Pick slot to add</span>
                  </div>
              )}
              <div className="flex items-center space-x-1">
                <Icon name="Clock" size={12} className="text-success" />
                <span>Free slot</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-warning text-[10px] font-bold text-background">!</span>
                <span>Conflict</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icon name="Users" size={12} />
                <span>Class groups</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default ScheduleCalendar;