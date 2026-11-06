// src/pages/profile/components/OfficeHours.jsx
import React from 'react';
import Input from '../../../components/ui/Input';
import {
    DAYS_KEYS as dayOrder,
    DAY_LABELS as dayLabel,
    TEACHER_POLICY
} from '../../../constants/schedulePolicy';

/* ==== policy / helpers ==== */
const {
    MIN: TEACHER_MIN,
    MAX: TEACHER_MAX,
    MAX_DURATION_MIN: TEACHER_MAX_DURATION_MIN,
    MIN_STEP_MIN,
    ALLOW_WEEKENDS
} = TEACHER_POLICY;

const toMin = (hhmm) => {
    const [h = '0', m = '0'] = String(hhmm || '00:00').split(':');
    const H = Math.max(0, parseInt(h, 10) || 0);
    const M = Math.max(0, parseInt(m, 10) || 0);
    return H * 60 + M;
};
const toHHMM = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const clampForTeacher = (startStr, endStr) => {
    const minB = toMin(TEACHER_MIN);
    const maxB = toMin(TEACHER_MAX);
    let s = toMin(startStr);
    let e = toMin(endStr);

    // межі вікна
    s = Math.max(minB, Math.min(s, maxB - MIN_STEP_MIN));
    e = Math.max(minB + MIN_STEP_MIN, Math.min(e, maxB));

    // мін/макс тривалість
    if (e - s < MIN_STEP_MIN) e = Math.min(maxB, s + MIN_STEP_MIN);
    if (e - s > TEACHER_MAX_DURATION_MIN) e = s + TEACHER_MAX_DURATION_MIN;

    return [toHHMM(s), toHHMM(e)];
};

/* ==== component ==== */
const OfficeHours = ({
                         isEditing,
                         officeHours,
                         onToggle,
                         onStartChange,
                         onEndChange,
                         role = 'teacher'
                     }) => {
    const isTeacher = role === 'teacher';
    const isWeekend = (d) => d === 'Sat' || d === 'Sun';
    const explain = isTeacher
        ? `Teachers: Mon–Fri, ${TEACHER_MIN}–${TEACHER_MAX}, ≤ ${TEACHER_MAX_DURATION_MIN / 60}h`
        : '';

    // мін. ширина картки: щоб у вузькому контейнері не ламався текст/інпути
    const cardGridClass =
        'grid gap-3 min-w-0 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]';

    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-6">
            {/* заголовок переноситься і не ламає лейаут */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
                <h2 className="text-lg font-semibold">Office Hours</h2>
                {isTeacher && (
                    <span className="text-[11px] px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
            {explain}
          </span>
                )}
            </div>

            {/* fluid grid — 1..N колонок залежно від доступної ширини (айпади виглядають коректно) */}
            <div className={cardGridClass}>
                {dayOrder.map((d, idx) => {
                    const oh = officeHours?.[d] || { enabled: false, start: '10:00', end: '11:00' };
                    const weekendBlocked = isTeacher && !ALLOW_WEEKENDS && isWeekend(d);

                    const toggle = () => {
                        if (!isEditing || weekendBlocked) return;
                        // коли вмикаємо — відразу підтягуємо час під policy, щоб інпут не показував "некоректні" значення
                        if (!oh.enabled && isTeacher) {
                            const [s, e] = clampForTeacher(oh.start, oh.end);
                            if (s !== oh.start) onStartChange(d, s);
                            if (e !== oh.end) onEndChange(d, e);
                        }
                        onToggle(d);
                    };

                    const applyStart = (v) => {
                        if (!isEditing || weekendBlocked || !oh.enabled) return;
                        let [s, e] = [v, oh.end];
                        if (isTeacher) [s, e] = clampForTeacher(v, oh.end);
                        if (e !== oh.end) onEndChange(d, e);
                        onStartChange(d, s);
                    };

                    const applyEnd = (v) => {
                        if (!isEditing || weekendBlocked || !oh.enabled) return;
                        let [s, e] = [oh.start, v];
                        if (isTeacher) [s, e] = clampForTeacher(oh.start, v);
                        if (s !== oh.start) onStartChange(d, s);
                        onEndChange(d, e);
                    };

                    const hints = [];
                    if (isTeacher && oh.enabled) {
                        const s = toMin(oh.start);
                        const e = toMin(oh.end);
                        const minB = toMin(TEACHER_MIN);
                        const maxB = toMin(TEACHER_MAX);
                        if (s < minB) hints.push(`Start < ${TEACHER_MIN}`);
                        if (e > maxB) hints.push(`End > ${TEACHER_MAX}`);
                        if (e - s < MIN_STEP_MIN) hints.push(`Duration < ${MIN_STEP_MIN}m`);
                        if (e - s > TEACHER_MAX_DURATION_MIN) hints.push(`Duration > ${TEACHER_MAX_DURATION_MIN}m`);
                    }

                    const disabled = !isEditing || weekendBlocked;
                    const onKeyToggle = (e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            toggle();
                        }
                    };

                    return (
                        <div
                            key={d}
                            className={`rounded-md border p-3 sm:p-4 transition-colors min-w-0 ${
                                oh.enabled && !weekendBlocked ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20'
                            }`}
                            data-day-index={idx}
                        >
                            {/* шапка картки */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">{dayLabel[d]}</span>
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    #{idx + 1}
                  </span>
                                    <span
                                        className={`text-[11px] px-1.5 py-0.5 rounded border ${
                                            oh.enabled && !weekendBlocked
                                                ? 'bg-success/10 text-success border-success/30'
                                                : weekendBlocked
                                                    ? 'bg-destructive/10 text-destructive border-destructive/30'
                                                    : 'bg-muted text-muted-foreground border-border'
                                        }`}
                                    >
                    {weekendBlocked ? 'Blocked' : oh.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                                </div>

                                {/* доступний перемикач (клавіатура/скрінрідери) */}
                                <button
                                    type="button"
                                    onClick={toggle}
                                    onKeyDown={onKeyToggle}
                                    disabled={disabled}
                                    aria-disabled={disabled ? 'true' : 'false'}
                                    aria-pressed={oh.enabled ? 'true' : 'false'}
                                    aria-label={`Toggle ${dayLabel[d]} office hours`}
                                    title={
                                        !isEditing
                                            ? 'Edit mode is off'
                                            : weekendBlocked
                                                ? 'Teachers cannot set office hours on weekends'
                                                : 'Toggle'
                                    }
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                                        oh.enabled && !weekendBlocked ? 'bg-primary' : 'bg-muted'
                                    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                  <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-background transition ${
                          oh.enabled && !weekendBlocked ? 'translate-x-5' : 'translate-x-1'
                      }`}
                  />
                                </button>
                            </div>

                            {/* поля часу — на дуже вузьких екранах стають у стовпчик */}
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                                <Input
                                    label="Start"
                                    type="time"
                                    className="w-full"
                                    value={oh.start}
                                    step={MIN_STEP_MIN * 60}
                                    min={isTeacher ? TEACHER_MIN : undefined}
                                    max={isTeacher ? TEACHER_MAX : undefined}
                                    onChange={(e) => applyStart(e.target.value)}
                                    disabled={!isEditing || !oh.enabled || weekendBlocked}
                                />
                                <Input
                                    label="End"
                                    type="time"
                                    className="w-full"
                                    value={oh.end}
                                    step={MIN_STEP_MIN * 60}
                                    min={isTeacher ? TEACHER_MIN : undefined}
                                    max={isTeacher ? TEACHER_MAX : undefined}
                                    onChange={(e) => applyEnd(e.target.value)}
                                    disabled={!isEditing || !oh.enabled || weekendBlocked}
                                />
                            </div>

                            {/* підказки/валідаційні бейджі — переносяться в кілька рядків */}
                            {isTeacher && (oh.enabled || weekendBlocked) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {!weekendBlocked && (
                                        <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      Window: {TEACHER_MIN}–{TEACHER_MAX}, ≤ {TEACHER_MAX_DURATION_MIN / 60}h
                    </span>
                                    )}
                                    {hints.map((h, i) => (
                                        <span
                                            key={i}
                                            className="text-[11px] px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20"
                                        >
                      {h}
                    </span>
                                    ))}
                                    {weekendBlocked && (
                                        <span className="text-[11px] px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                      Weekends are not allowed for teachers
                    </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default OfficeHours;