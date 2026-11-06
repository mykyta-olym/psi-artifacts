import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';
import Pagination from '../../../components/ui/Pagination';
import { createPortal } from 'react-dom';
import { useToasts } from '../../../components/ui/Toasts';
import { createLogger } from '../../../utils/logger';
const logger = createLogger('GradeBookGrid');

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const GradeBookGrid = ({
                         students = [],
                         assignments = [],
                         grades = {},
                         onGradeUpdate,
                         onSaveGrades,
                         userRole = 'teacher',
                         selectedClass = null,
                         currentUserId = null,
                         currentUserEmail = '',
                         classOwnerEmail = '',
                       }) => {
  const canEdit = useMemo(() => {
    if (userRole !== 'teacher') return false;
    const ownerEmail = (selectedClass?.ownerEmail || classOwnerEmail || '').toLowerCase();
    const meEmail = (currentUserEmail || '').toLowerCase();
    const ownerId = selectedClass?.ownerId || null;
    if (ownerEmail && meEmail) return ownerEmail === meEmail;
    if (ownerId && currentUserId) return ownerId === currentUserId;
    return !ownerId && !ownerEmail;
  }, [userRole, selectedClass?.ownerId, selectedClass?.ownerEmail, currentUserId, currentUserEmail, classOwnerEmail]);

  // Default to points/total display per requirement
  const [viewMode, setViewMode] = useState('points');
  const [hoverAssignmentId, setHoverAssignmentId] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [recentlyUpdated, setRecentlyUpdated] = useState({});
  const highlightTimers = useRef({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [incStep, setIncStep] = useState(1);
  const [bulkMode, setBulkMode] = useState('add');
  const [bulkValue, setBulkValue] = useState('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const cellStacksRef = useRef({});
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const initialSnapshotRef = useRef({});
  const pendingChangesRef = useRef(new Map());
  const historyAnchorRef = useRef(null);
  const [historyPosition, setHistoryPosition] = useState({ top: 0, left: 0, width: 360, maxHeight: 320 });
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

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [mPage, setMPage] = useState(1);
  const M_PER_PAGE = 6;
  useEffect(() => {
    setMPage(1);
  }, [students, assignments, sort.dir, sort.key]);

  const sortedStudents = useMemo(() => {
    const list = [...students];
    list.sort((a, b) => {
      const av = (a[sort.key] || '').toString().toLowerCase();
      const bv = (b[sort.key] || '').toString().toLowerCase();
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [students, sort]);

  const mTotalPages = Math.max(1, Math.ceil(sortedStudents.length / M_PER_PAGE));
  useEffect(() => {
    setMPage((p) => Math.min(Math.max(1, p), mTotalPages));
  }, [mTotalPages]);

  const mStart = (mPage - 1) * M_PER_PAGE;
  const mEnd = mStart + M_PER_PAGE;
  const mobileSlice = useMemo(() => sortedStudents.slice(mStart, mEnd), [sortedStudents, mStart, mEnd]);

  const viewModeOptions = [
    { value: 'points', label: 'Points' },
    { value: 'percentage', label: 'Percentage' },
    { value: 'letter', label: 'Letter Grade' },
  ];

  const getLetterGrade = (p) => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
  const clampPoints = (points, total) => Math.max(0, Math.min(total, points));
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const buildSnapshot = (source) => {
    const snap = {};
    Object.entries(source || {}).forEach(([key, value]) => {
      const pts = value?.points;
      if (Number.isFinite(pts)) snap[key] = Math.round(Number(pts));
    });
    return snap;
  };

  useEffect(() => {
    if (!hasPendingChanges) {
      initialSnapshotRef.current = buildSnapshot(grades);
      pendingChangesRef.current = new Map();
    }
  }, [grades, hasPendingChanges]);

  const updatePendingState = (key, nextPoints) => {
    const normalized = Math.round(Number(nextPoints ?? 0));
    if (!Number.isFinite(normalized)) return;
    const baseline = initialSnapshotRef.current[key];
    const pendingMap = pendingChangesRef.current;

    if (baseline === undefined) {
      if (normalized === 0) pendingMap.delete(key);
      else pendingMap.set(key, normalized);
    } else if (baseline === normalized) {
      pendingMap.delete(key);
    } else {
      pendingMap.set(key, normalized);
    }
    setHasPendingChanges(pendingMap.size > 0);
  };

  const safeRangeValue = (mode, value) => {
    if (mode === 'scale') {
      const num = parseFloat(value);
      if (!Number.isFinite(num)) return 100;
      return Math.round(clamp(num, 0.5, 1.5) * 100);
    }
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(clamp(num, -50, 50));
  };

  const rangeToValue = (mode, raw) => {
    const num = Number(raw);
    if (mode === 'scale') {
      return (clamp(num, 50, 150) / 100).toFixed(2);
    }
    return String(Math.round(clamp(num, -50, 50)));
  };

  const rangeMinLabel = (mode) => (mode === 'scale' ? '0.5×' : '-50 pts');
  const rangeMaxLabel = (mode) => (mode === 'scale' ? '1.5×' : '+50 pts');

  const calcDisplayGrade = (studentId, assignmentId) => {
    const g = grades?.[`${studentId}-${assignmentId}`];
    const a = assignments?.find((x) => x?.id === assignmentId);
    if (!g || !a) return null;
    if (viewMode === 'points') return `${g.points} / ${a.totalPoints}`;
    if (viewMode === 'letter') return getLetterGrade((g.points / a.totalPoints) * 100);
    return `${Math.round((g.points / a.totalPoints) * 100)}%`;
  };

  const calcStudentAverage = (studentId) => {
    const arr = assignments
        .map((a) => {
          const g = grades?.[`${studentId}-${a.id}`];
          return g ? (g.points / a.totalPoints) * 100 : null;
        })
        .filter((v) => v !== null);
    if (!arr.length) return 'N/A';
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    return `${Math.round(avg)}%`;
  };

  const markUpdated = (k) => {
    setRecentlyUpdated((prev) => ({ ...prev, [k]: true }));
    if (highlightTimers.current[k]) clearTimeout(highlightTimers.current[k]);
    highlightTimers.current[k] = setTimeout(() => {
      setRecentlyUpdated((prev) => {
        const { [k]: _gone, ...rest } = prev || {};
        return rest;
      });
    }, 1200);
  };

  const setCell = (sid, a, points) => {
    const clamped = clampPoints(points, a.totalPoints);
    const pct = (clamped / a.totalPoints) * 100;
    onGradeUpdate?.(sid, a.id, {
      points: clamped,
      percentage: pct,
      letterGrade: getLetterGrade(pct),
      lastUpdated: new Date().toISOString(),
    });
    const k = `${sid}-${a.id}`;
    markUpdated(k);
    updatePendingState(k, clamped);
  };

  const toggleSort = () => setSort((s) => ({ key: 'name', dir: s.dir === 'asc' ? 'desc' : 'asc' }));

  const pageIds = useMemo(() => (isMobile ? mobileSlice : sortedStudents).map((s) => s.id).filter(Boolean), [isMobile, mobileSlice, sortedStudents]);
  const allOnPageSelected = useMemo(() => pageIds.length > 0 && pageIds.every((id) => selectedRows.includes(id)), [pageIds, selectedRows]);
  const someOnPageSelected = useMemo(() => pageIds.some((id) => selectedRows.includes(id)), [pageIds, selectedRows]);

  const setRowChecked = (id, checked) => {
    setSelectedRows((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleAll = () => {
    setSelectedRows((prev) => {
      if (pageIds.length === 0) return [];
      const everyChecked = pageIds.every((id) => prev.includes(id));
      if (everyChecked) return prev.filter((id) => !pageIds.includes(id));
      const merged = new Set([...prev, ...pageIds]);
      return Array.from(merged);
    });
  };

  useEffect(() => {
    setSelectedRows([]);
  }, [students]);

  const minTotal = useMemo(() => (assignments.length ? Math.min(...assignments.map((a) => a.totalPoints)) : 0), [assignments]);
  const maxTotal = useMemo(() => (assignments.length ? Math.max(...assignments.map((a) => a.totalPoints)) : 0), [assignments]);

  const bulkHint = useMemo(() => {
    if (!bulkValue) return '';
    const v = parseFloat(bulkValue);
    if (Number.isNaN(v)) return 'Enter a numeric value.';
    if (bulkMode === 'scale') {
      if (v <= 0) return 'Factor should be > 0. Example: 1.05 = +5%';
      if (v > 2) return 'Unusually high factor — values will be clamped.';
      return 'Will multiply current points; results are clamped per assignment.';
    }
    if (bulkMode === 'set') {
      if (v < 0) return 'Points cannot be negative.';
      if (assignments.length === 0) return '';
      if (v > maxTotal) return `Value > some totals (max visible total = ${maxTotal}). Clamping will apply.`;
      return `OK. Visible assignment totals range: ${minTotal}–${maxTotal}.`;
    }
    if (bulkMode === 'add') {
      if (assignments.length === 0) return '';
      if (v < -maxTotal) return 'Too negative. Many grades would clamp to 0.';
      if (v > maxTotal) return 'Large add — many grades may clamp to totals.';
      return 'Adds value to each grade; clamped 0..total.';
    }
    return '';
  }, [bulkMode, bulkValue, assignments, minTotal, maxTotal]);

  const bulkHintColor = useMemo(() => {
    if (!bulkValue) return 'text-muted-foreground';
    const v = parseFloat(bulkValue);
    if (Number.isNaN(v)) return 'text-error';
    if (bulkMode === 'scale' && (v <= 0 || v > 2)) return 'text-warning';
    if (bulkMode === 'set' && (v < 0 || v > maxTotal)) return 'text-warning';
    if (bulkMode === 'add' && (v < -maxTotal || v > maxTotal)) return 'text-warning';
    return 'text-muted-foreground';
  }, [bulkMode, bulkValue, maxTotal]);

  const applyBulk = async () => {
    if (!canEdit || isApplyingBulk) return;
    const value = parseFloat(bulkValue);
    if (Number.isNaN(value)) return;
    setIsApplyingBulk(true);
    const targetStudents = selectedRows.length ? sortedStudents.filter((s) => selectedRows.includes(s.id)) : sortedStudents;
    const entries = [];
    for (const s of targetStudents) {
      for (const a of assignments) {
        const key = `${s.id}-${a.id}`;
        const prev = grades?.[key] || { points: 0, percentage: 0, letterGrade: 'F' };
        const curPoints = prev.points ?? 0;
        let nextPoints = curPoints;
        if (bulkMode === 'add') nextPoints = curPoints + value;
        if (bulkMode === 'set') nextPoints = value;
        if (bulkMode === 'scale') nextPoints = curPoints * value;
        const clamped = clampPoints(nextPoints, a.totalPoints);
        entries.push({ sid: s.id, aid: a.id, prev, next: { points: clamped } });
      }
    }
    for (const e of entries) {
      const a = assignments.find((x) => x.id === e.aid);
      if (!a) continue;
      setCell(e.sid, a, e.next.points);
    }
    setHistory((prev) =>
        [
          {
            id: uid(),
            ts: Date.now(),
            kind: 'bulk',
            label: `Bulk: ${bulkMode} ${value} (${assignments.length} assignments • ${targetStudents.length} students)`,
            meta: { mode: bulkMode, value },
            entries,
          },
          ...prev,
        ].slice(0, 50)
    );
    setIsApplyingBulk(false);
    setBulkOpen(false);
    setBulkValue('');
  };

  const adjustCell = (student, a, delta) => {
    if (!canEdit) return;
    const key = `${student.id}-${a.id}`;
    const prev = grades?.[key] || { points: 0, percentage: 0, letterGrade: 'F' };
    const cur = prev.points ?? 0;
    const step = Math.max(1, Number.isFinite(+incStep) ? Math.floor(+incStep) : 1);
    if ((delta < 0 && cur <= 0) || (delta > 0 && cur >= a.totalPoints)) return;
    const next = clampPoints(cur + delta * step, a.totalPoints);
    if (next === cur) return;
    setCell(student.id, a, next);
    const sign = delta > 0 ? 'plus' : 'minus';
    const stackKey = `${student.id}-${a.id}-${sign}`;
    const existing = cellStacksRef.current[stackKey]?.id;
    setHistory((prev) => {
      if (!existing || !prev.some((x) => x.id === existing)) {
        const newId = uid();
        cellStacksRef.current[stackKey] = { id: newId };
        const entry = { sid: student.id, aid: a.id, start: cur, steps: [next], total: a.totalPoints };
        const item = {
          id: newId,
          ts: Date.now(),
          kind: 'cell',
          meta: { sign: delta > 0 ? '+' : '−', count: 1, sid: student.id, aid: a.id, studentName: student.name, assignmentName: a.name },
          entries: [entry],
        };
        return [item, ...prev].slice(0, 50);
      }
      return prev.map((h) => {
        if (h.id !== existing) return h;
        const e = h.entries[0];
        const newSteps = [...(e.steps || []), next];
        return { ...h, ts: Date.now(), meta: { ...h.meta, count: (h.meta?.count || 1) + 1 }, entries: [{ ...e, steps: newSteps }] };
      });
    });
  };

  const revertAction = (actionId) => {
    const action = history.find((h) => h.id === actionId);
    if (!action) return;
    if (action.kind === 'cell') {
      const e = action.entries[0];
      const a = assignments.find((x) => x.id === e.aid);
      if (!a) return;
      const signKey = action.meta?.sign === '+' ? 'plus' : 'minus';
      const stackKey = `${e.sid}-${e.aid}-${signKey}`;
      if (e.steps && e.steps.length > 1) {
        const newLen = e.steps.length - 1;
        const newPoints = e.steps[newLen - 1];
        setCell(e.sid, a, newPoints);
        setHistory((prev) =>
            prev.map((it) => {
              if (it.id !== actionId) return it;
              const ne = { ...e, steps: e.steps.slice(0, newLen) };
              return { ...it, ts: Date.now(), meta: { ...it.meta, count: Math.max(1, (it.meta?.count || newLen + 1) - 1) }, entries: [ne] };
            })
        );
      } else if (e.steps && e.steps.length === 1) {
        const backPoints = clampPoints(e.start ?? 0, a.totalPoints);
        setCell(e.sid, a, backPoints);
        setHistory((prev) => prev.filter((it) => it.id !== actionId));
        if (cellStacksRef.current[stackKey]?.id === actionId) delete cellStacksRef.current[stackKey];
      }
      return;
    }
    for (const item of action.entries) {
      const a = assignments.find((x) => x.id === item.aid);
      if (!a) continue;
      const backPoints = clampPoints(item.prev?.points ?? 0, a.totalPoints);
      setCell(item.sid, a, backPoints);
    }
    setHistory((prev) => prev.filter((it) => it.id !== actionId));
  };

  const clearHistory = () => {
    setHistory([]);
    cellStacksRef.current = {};
  };

  const cellPaint = (studentId, assignmentId) => {
    const key = `${studentId}-${assignmentId}`;
    const g = grades?.[key];
    let cls = 'relative px-2 py-2 text-sm text-center border border-border whitespace-nowrap transition-colors duration-200 ';
    if (recentlyUpdated[key]) cls += 'bg-primary/15 ';
    if (!g) return cls + 'bg-muted/40 text-muted-foreground';
    const a = assignments.find((x) => x.id === assignmentId);
    const pct = (g.points / a.totalPoints) * 100;
    if (pct >= 90) return cls + 'bg-success/10 text-success';
    if (pct >= 80) return cls + 'bg-accent/10 text-accent';
    if (pct >= 70) return cls + 'bg-warning/10 text-warning';
    if (pct >= 60) return cls + 'bg-orange-100 text-orange-700';
    return cls + 'bg-error/10 text-error';
  };

  const BulkBadge = () => (
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-secondary/15 text-secondary">Visible assignments: {assignments.length}</span>
        {selectedRows.length > 0 && <span className="px-2 py-1 rounded-full bg-primary/15 text-primary">Selected students: {selectedRows.length}</span>}
        {!canEdit && <span className="px-2 py-1 rounded-full bg-error/10 text-error">Read-only (not class owner)</span>}
      </div>
  );

  const MobileSheet = ({ open, onClose, children, title }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <div className="glass-pop w-full sm:w-[480px] max-h-[75vh] overflow-auto rounded-t-xl sm:rounded-xl p-3 relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-foreground">{title}</div>
              <button type="button" className="p-1 rounded hover:bg-muted" onClick={onClose} aria-label="Close">
                <Icon name="X" size={14} />
              </button>
            </div>
            {children}
          </div>
        </div>
    );
  };

  const BulkForm = (
      <>
        <div className="mb-4">
          <label className="text-xs text-muted-foreground block mb-2 uppercase tracking-wide">Increment step for +/-</label>
          <div className="flex items-center gap-3">
            <Input
                type="number"
                min="1"
                step="1"
                value={incStep}
                onChange={(e)=>setIncStep(parseInt(e.target.value||'1',10)||1)}
                className="w-24"
                inputClassName="input-no-spinner text-center font-semibold tracking-wide"
            />
            <span className="text-xs text-muted-foreground flex-1">Each click on +/− updates points by this amount.</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
              type="button"
              onClick={() => setBulkMode('add')}
              className={`px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
                  bulkMode === 'add'
                      ? 'bg-primary text-primary-foreground border-primary shadow-card'
                      : 'bg-background/40 text-foreground border-border hover:bg-muted/60'
              }`}
          >
            Add
          </button>
          <button
              type="button"
              onClick={() => setBulkMode('set')}
              className={`px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
                  bulkMode === 'set'
                      ? 'bg-primary text-primary-foreground border-primary shadow-card'
                      : 'bg-background/40 text-foreground border-border hover:bg-muted/60'
              }`}
          >
            Set
          </button>
          <button
              type="button"
              onClick={() => setBulkMode('scale')}
              className={`px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
                  bulkMode === 'scale'
                      ? 'bg-primary text-primary-foreground border-primary shadow-card'
                      : 'bg-background/40 text-foreground border-border hover:bg-muted/60'
              }`}
          >
            Scale
          </button>
        </div>
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground block uppercase tracking-wide">
            {bulkMode === 'add' && 'Add N points to each visible assignment'}
            {bulkMode === 'set' && 'Set exact points for each visible assignment'}
            {bulkMode === 'scale' && 'Multiply current points by factor (e.g., 1.05 = +5%)'}
          </label>
          <div className="flex flex-col gap-3">
            <Input
                type="number"
                placeholder={bulkMode === 'scale' ? '1.05' : '5'}
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                min={bulkMode === 'scale' ? '0' : '0'}
                step={bulkMode === 'scale' ? '0.01' : '0.1'}
                inputClassName="input-no-spinner text-center font-semibold tracking-wide"
            />
            <div className="w-full">
              <input
                  type="range"
                  min={bulkMode === 'scale' ? 50 : -50}
                  max={bulkMode === 'scale' ? 150 : 50}
                  step={bulkMode === 'scale' ? 1 : 1}
                  value={safeRangeValue(bulkMode, bulkValue)}
                  onChange={(e) => setBulkValue(rangeToValue(bulkMode, e.target.value))}
                  className="scheme-slider w-full"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>{rangeMinLabel(bulkMode)}</span>
                <span>{rangeMaxLabel(bulkMode)}</span>
              </div>
            </div>
          </div>
          {assignments.length > 0 && <div className={`text-xs ${bulkHintColor}`}>{bulkHint}</div>}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Targets: {assignments.length} assignments • {selectedRows.length || students.length} students</span>
          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => {
                  setBulkValue('');
                  setBulkMode('add');
                }}
                className="px-2 py-1 rounded border border-border hover:bg-muted"
            >
              Reset
            </button>
            <button
                type="button"
                onClick={applyBulk}
                disabled={isApplyingBulk || !bulkValue || Number.isNaN(parseFloat(bulkValue))}
                className={`px-2 py-1 rounded ${isApplyingBulk || !bulkValue ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
            >
              {isApplyingBulk ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">• Applies only to assignments visible under current filters.<br />• Values are clamped to each assignment’s total points.</div>
      </>
  );

  const HistoryList = (
      <>
        {history.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No history yet. Apply bulk changes or use +/- to see entries here.</div>
        ) : (
            <ul className="space-y-2">
              {history.map((h) => {
                const isCell = h.kind === 'cell';
                const title = isCell
                    ? `${h.meta?.sign || '+'}1 on “${h.meta?.assignmentName || ''}” for ${h.meta?.studentName || ''} ×${h.meta?.count || (h.entries?.[0]?.steps?.length || 1)}`
                    : h.label;
                const sub = `${new Date(h.ts).toLocaleString()} • ${h.kind}${h.meta?.mode ? `: ${h.meta.mode}` : ''} • ${
                    isCell ? `${h.entries?.[0]?.steps?.length || 1} step(s)` : `${h.entries?.length || 0} cell(s)`
                }`;
                return (
                    <li key={h.id} className="border border-border rounded-md p-2 bg-card/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-foreground">{title}</div>
                          <div className="text-[11px] text-muted-foreground">{sub}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => revertAction(h.id)}
                            className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
                            title={isCell ? 'Step back one click' : 'Revert this action'}
                        >
                          Revert
                        </button>
                      </div>
                    </li>
                );
              })}
            </ul>
        )}
      </>
  );

  const handleSaveGrades = async () => {
    if (!onSaveGrades || !hasPendingChanges || isSavingGrades) return;
    try {
      setIsSavingGrades(true);
      const maybe = onSaveGrades();
      if (maybe && typeof maybe.then === 'function') {
        await maybe;
      }
      pendingChangesRef.current = new Map();
      setHasPendingChanges(false);
      setTimeout(() => {
        guardedNotify('grades-save-success', 'success', 'Grades saved successfully', { title: 'Grades saved' });
      }, 100);
    } catch (error) {
      logger.error('[GradeBookGrid] Failed to save grades', error);
      setTimeout(() => {
        guardedNotify('grades-save-error', 'error', 'Failed to save grades', { title: 'Save failed' });
      }, 100);
    } finally {
      setIsSavingGrades(false);
    }
  };

  useLayoutEffect(() => {
    if (!historyOpen || !historyAnchorRef.current) return;

    const computePosition = () => {
      const anchor = historyAnchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const preferredWidth = Math.min(416, window.innerWidth - 40);
      const left = Math.min(
          Math.max(20, rect.right - preferredWidth),
          window.innerWidth - preferredWidth - 20
      );
      const top = Math.min(rect.bottom + 8, window.innerHeight - 40);
      const maxHeight = Math.min(window.innerHeight - 80, Math.max(window.innerHeight * 0.6, 280));
      setHistoryPosition({ top, left, width: preferredWidth, maxHeight });
    };

    computePosition();
    window.addEventListener('resize', computePosition);
    window.addEventListener('scroll', computePosition, true);
    return () => {
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition, true);
    };
  }, [historyOpen]);

  const historyPortal = historyOpen
      ? createPortal(
          <div
              className="glass-pop border border-border rounded-md shadow-modal p-3 z-[2000] thin-scrollbar overflow-auto bg-card/95 backdrop-blur"
              style={{
                position: 'fixed',
                top: historyPosition.top,
                left: historyPosition.left,
                width: historyPosition.width,
                maxHeight: historyPosition.maxHeight,
              }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Change history</span>
                <span className="text-xs text-muted-foreground">{history.length} entries</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                    onClick={clearHistory}
                    disabled={!history.length}
                    title="Clear history (cannot be undone)"
                >
                  Clear
                </button>
                <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => setHistoryOpen(false)} aria-label="Close">
                  <Icon name="X" size={14} />
                </button>
              </div>
            </div>
            {HistoryList}
          </div>,
          document.body
      )
      : null;

  return (
      <div className="glass-card rounded-lg border border-border overflow-hidden relative shadow-card">
        <div className="p-4 border-b border-border bg-surface/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">Grade Book</h3>
              {selectedClass && <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">{selectedClass?.name}</span>}
              <BulkBadge />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select options={viewModeOptions} value={viewMode} onChange={(v) => setViewMode(typeof v === 'string' ? v : v?.value)} className="w-full sm:w-44" />
              <div className="relative hidden md:block">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    iconName="Sliders"
                    onClick={() => setBulkOpen((v) => !v)}
                    disabled={!canEdit || assignments.length === 0}
                    title={!canEdit ? 'Only the class owner can edit' : 'Bulk adjust (applies to visible assignments)'}
                >
                  Adjust points
                </Button>
                {bulkOpen && (
                    <div className="absolute right-0 mt-2 w-80 glass-pop border border-border rounded-md shadow-modal p-3 z-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-foreground">Bulk adjustments</div>
                        <button type="button" className="p-1 rounded hover:bg-muted/40 transition" onClick={() => setBulkOpen(false)} aria-label="Close">
                          <Icon name="X" size={14} />
                        </button>
                      </div>
                      {BulkForm}
                    </div>
                )}
              </div>
              <div className="md:hidden">
                <Button type="button" variant="outline" size="sm" iconName="Sliders" onClick={() => setBulkOpen(true)} disabled={!canEdit || assignments.length === 0}>
                  Adjust points
                </Button>
              </div>
              <div className="hidden md:block">
                <Button
                    type="button"
                    size="sm"
                    iconName="Save"
                    onClick={handleSaveGrades}
                    disabled={!hasPendingChanges || isSavingGrades}
                >
                  {isSavingGrades ? 'Saving…' : 'Save Grades'}
                </Button>
              </div>
              <div className="md:hidden">
                <Button
                    type="button"
                    size="sm"
                    iconName="Save"
                    onClick={handleSaveGrades}
                    disabled={!hasPendingChanges || isSavingGrades}
                    className="w-full"
                >
                  {isSavingGrades ? 'Saving…' : 'Save Grades'}
                </Button>
              </div>
              <div className="relative hidden md:block" ref={historyAnchorRef}>
                <Button type="button" variant="ghost" size="sm" iconName="History" onClick={() => setHistoryOpen((v) => !v)} title="Open change history">
                  History
                </Button>
              </div>
              <div className="md:hidden">
                <Button type="button" variant="ghost" size="sm" iconName="History" onClick={() => setHistoryOpen(true)}>
                  History
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isMobile && bulkOpen && (
            <MobileSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk adjustments">
              {BulkForm}
            </MobileSheet>
        )}

        {isMobile && historyOpen && (
            <MobileSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Change history">
              {HistoryList}
            </MobileSheet>
        )}

        {historyPortal}

        <div className="block lg:hidden p-3 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground flex items-center gap-2">
            <span data-stop-row="1" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                  onChange={() => toggleAll()}
              />
            </span>
              Select all
            </label>
            <button type="button" onClick={toggleSort} className="text-xs hover:text-foreground inline-flex items-center gap-1">
              Sort by name <Icon name={sort.dir === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={12} />
            </button>
          </div>

          <div className="grid gap-3" data-stagger="60">
            {(isMobile ? mobileSlice : sortedStudents).map((s, idx) => (
                <div key={s.id} className={`glass-card border border-border rounded-lg p-3 hover-lift ${idx % 2 ? 'bg-card/70' : 'bg-card/60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.studentId}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">{calcStudentAverage(s.id)}</span>
                      <span data-stop-row="1" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={selectedRows.includes(s.id)}
                        onChange={(e) => setRowChecked(s.id, !!e?.target?.checked)}
                        aria-label={`Select ${s.name}`}
                    />
                  </span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    {assignments.map((a) => {
                      const painted = cellPaint(s.id, a.id);
                      const grade = calcDisplayGrade(s.id, a.id) ?? '-';
                      return (
                          <div
                              key={a.id}
                              className={`rounded-md ${painted} flex items-center justify-between gap-2`}
                              onMouseEnter={() => setHoverAssignmentId(a.id)}
                              onMouseLeave={() => setHoverAssignmentId(null)}
                              title={canEdit ? 'Use +/- to adjust' : 'Read-only'}
                          >
                            <div className="flex-1 min-w-0 text-left">
                              <div className="truncate text-foreground">{a.name}</div>
                              <div className="text-[11px] text-muted-foreground">{a.totalPoints} pts • {new Date(a.dueDate).toLocaleDateString()}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm tabular-nums w-14 text-center">{grade}</span>
                              {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="w-7 h-7 rounded-full bg-background/80 border border-border hover:bg-muted flex items-center justify-center"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          adjustCell(s, a, -1);
                                        }}
                                        title="−1 point"
                                    >
                                      <Icon name="Minus" size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        className="w-7 h-7 rounded-full bg-background/80 border border-border hover:bg-muted flex items-center justify-center"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          adjustCell(s, a, +1);
                                        }}
                                        title="+1 point"
                                    >
                                      <Icon name="Plus" size={12} />
                                    </button>
                                  </div>
                              )}
                            </div>
                          </div>
                      );
                    })}
                  </div>
                </div>
            ))}
          </div>

          {isMobile && mTotalPages > 1 && (
              <div className="mt-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card glass-card rounded-xl border border-border p-3 sm:p-4">
                <div className="order-2 lg:order-1 text-sm text-muted-foreground">
                  Showing {Math.min(mStart + 1, sortedStudents.length)} to {Math.min(mEnd, sortedStudents.length)} of {sortedStudents.length} students
                </div>
                <div className="order-1 lg:order-2 w-full lg:w-auto">
                  <Pagination currentPage={mPage} totalPages={mTotalPages} onChange={setMPage} className="justify-between lg:justify-end" />
                </div>
              </div>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="overflow-auto thin-scrollbar">
            <table className="min-w-[980px] w-full border-separate border-spacing-0">
              <thead>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground border-b border-r border-border" style={{ width: 42 }}>
                  <span data-stop-row="1" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={() => toggleAll()}
                    />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground border-b border-r border-border" style={{ minWidth: 220 }}>
                  <button type="button" onClick={toggleSort} className="flex items-center gap-2 hover:text-primary" title="Sort by name">
                    <span className="text-foreground">Student</span>
                    <Icon name={sort.dir === 'asc' ? 'ArrowUp' : 'ArrowDown'} size={14} />
                  </button>
                </th>
                {assignments.map((a) => (
                    <th
                        key={a.id}
                        className={`px-3 py-3 text-xs font-semibold border-b border-r border-border text-center min-w-[120px] ${hoverAssignmentId === a.id ? 'text-foreground' : 'text-muted-foreground'} bg-muted/30`}
                        onMouseEnter={() => setHoverAssignmentId(a.id)}
                        onMouseLeave={() => setHoverAssignmentId(null)}
                        title={`${a.name} • ${a.totalPoints} pts • ${new Date(a.dueDate).toLocaleDateString()}`}
                    >
                      <div className="truncate text-foreground">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.totalPoints} pts • {new Date(a.dueDate).toLocaleDateString()}
                      </div>
                    </th>
                ))}
                <th className="px-3 py-3 text-xs font-semibold text-muted-foreground border-b border-l border-border min-w-[100px] text-center bg-muted/30">Average</th>
              </tr>
              </thead>
              <tbody>
              {sortedStudents.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 ? 'bg-card' : 'bg-muted/20'}>
                    <td className="px-3 py-2 border-b border-r border-border" style={{ width: 42 }}>
                    <span data-stop-row="1" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                          checked={selectedRows.includes(s.id)}
                          onChange={(e) => setRowChecked(s.id, !!e?.target?.checked)}
                          aria-label={`Select ${s.name}`}
                      />
                    </span>
                    </td>
                    <td className="px-4 py-3 border-b border-r border-border" style={{ minWidth: 220 }}>
                      <div className="font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.studentId}</div>
                    </td>
                    {assignments.map((a) => {
                      const hoverCol = hoverAssignmentId === a.id;
                      return (
                          <td
                              key={a.id}
                              className={`${cellPaint(s.id, a.id)} ${hoverCol ? 'ring-1 ring-primary/30' : ''}`}
                              title={canEdit ? 'Use +/- to adjust' : 'Read-only'}
                              style={{ position: 'relative' }}
                          >
                            <span className="select-none">{calcDisplayGrade(s.id, a.id) ?? '-'}</span>
                            {canEdit && (
                                <div className="absolute inset-0 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity duration-150 px-1">
                                  <button
                                      type="button"
                                      className="w-6 h-6 rounded-full bg-background/80 border border-border hover:bg-muted flex items-center justify-center"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        adjustCell(s, a, -1);
                                      }}
                                      title="−1 point"
                                  >
                                    <Icon name="Minus" size={12} />
                                  </button>
                                  <button
                                      type="button"
                                      className="w-6 h-6 rounded-full bg-background/80 border border-border hover:bg-muted flex items-center justify-center"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        adjustCell(s, a, +1);
                                      }}
                                      title="+1 point"
                                  >
                                    <Icon name="Plus" size={12} />
                                  </button>
                                </div>
                            )}
                          </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-medium border-b border-l border-border">{calcStudentAverage(s.id)}</td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-surface/30 border-t border-border text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>Students: {students.length} • Assignments: {assignments.length}</div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline">Tip: Use +/- in a cell. Use “Adjust points” for curved grading.</span>
            {!canEdit && <span className="text-error">Read-only: you are not the class owner.</span>}
          </div>
        </div>
      </div>
  );
};

export default GradeBookGrid;