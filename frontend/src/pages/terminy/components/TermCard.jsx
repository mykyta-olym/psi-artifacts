// src/pages/terminy/components/TermCard.jsx
import React, { useRef } from 'react';
import Button from '../../../components/ui/Button';
import { useToasts } from '../../../components/ui/Toasts';
import { to2, dtISO, downloadBlob, fmtLeft } from '../utils/terminyUtils';

const TermCard = ({ term, onToggle, disabled, policy }) => {
    const { notify } = useToasts();
    const toastLock = useRef(0);
    const d = term.date;
    const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = `${to2(d.getHours())}:${to2(d.getMinutes())}–${to2(term.endDate.getHours())}:${to2(term.endDate.getMinutes())}`;
    const left = Math.max(0, term.capacity - term.registered - (term.meRegistered ? 1 : 0));
    const past = term.date.getTime() < Date.now();
    const capPct = Math.round(((term.registered + (term.meRegistered ? 1 : 0)) / term.capacity) * 100);
    const badgeTone = past
        ? 'bg-muted text-muted-foreground'
        : capPct >= 90
            ? 'bg-red-500/20 text-red-200 border-red-500/40'
            : capPct >= 70
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                : 'bg-green-500/20 text-green-200 border-green-500/40';

    const canJoin = !!policy?.canJoin;
    const canLeave = !!policy?.canLeave;
    const joinReason = policy?.joinReason || '';
    const leaveReason = policy?.leaveReason || '';
    const withdrawClosesIn = policy?.withdrawClosesIn;
    const joinClosesIn = policy?.joinClosesIn;

    return (
        <article className="group h-full min-h-[260px] flex flex-col bg-card rounded-xl border border-border p-4 md:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/30">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-foreground truncate">{term.courseName}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">{term.courseCode} • {term.credits} ECTS</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs transform transition-transform duration-200 group-hover:scale-105 ${badgeTone}`}>{capPct}%</span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm flex-1">
                <div className="rounded border border-border p-3 transition-colors duration-200 group-hover:border-primary/20">
                    <div className="text-muted-foreground">Date & Time</div>
                    <div className="font-medium">{day} • {time}</div>
                </div>
                <div className="rounded border border-border p-3 transition-colors duration-200 group-hover:border-primary/20">
                    <div className="text-muted-foreground">Room</div>
                    <div className="font-medium">{term.building} • {term.room}</div>
                </div>
                <div className="rounded border border-border p-3 transition-colors duration-200 group-hover:border-primary/20">
                    <div className="text-muted-foreground">Examiner</div>
                    <div className="font-medium">{term.examiner}</div>
                </div>
                <div className="rounded border border-border p-3 transition-colors duration-200 group-hover:border-primary/20">
                    <div className="text-muted-foreground">Capacity</div>
                    <div className="font-medium">{term.registered + (term.meRegistered ? 1 : 0)} / {term.capacity} {left > 0 ? `• Free ${left}` : '• Full'}</div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    iconName="CalendarPlus"
                    className="transition-all duration-200 hover:-translate-y-0.5"
                    onClick={() => {
                        const ics = [
                            'BEGIN:VCALENDAR',
                            'VERSION:2.0',
                            'PRODID:-//TUKE MAIS 2.0//ExamTerms//EN',
                            'CALSCALE:GREGORIAN',
                            'METHOD:PUBLISH',
                            'BEGIN:VEVENT',
                            `UID:${term.id}@mais`,
                            `DTSTAMP:${dtISO(new Date())}Z`,
                            `DTSTART:${dtISO(term.date)}Z`,
                            `DTEND:${dtISO(term.endDate)}Z`,
                            `SUMMARY:${term.courseName} — Exam Term`,
                            `LOCATION:${term.building} ${term.room}`,
                            `DESCRIPTION:Examiner: ${term.examiner}\\nCode: ${term.courseCode}`,
                            'END:VEVENT',
                            'END:VCALENDAR'
                        ].join('\r\n');
                        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                        downloadBlob(blob, `${term.courseCode}_${term.id}.ics`);
                        const now = Date.now();
                        if (now - toastLock.current > 2400) {
                            toastLock.current = now;
                            notify('success', 'iCal file exported', { title: 'Calendar' });
                        }
                    }}
                >
                    iCal
                </Button>

                {!term.meRegistered && (
                    <Button
                        size="sm"
                        iconName="PlusCircle"
                        disabled={!canJoin || disabled}
                        className="transition-all duration-200 hover:-translate-y-0.5"
                        onClick={() => onToggle(term, true)}
                        title={joinReason || 'Register'}
                    >
                        Register{joinClosesIn != null ? ` • closes in ${fmtLeft(joinClosesIn)}` : ''}
                    </Button>
                )}

                {term.meRegistered && (
                    <Button
                        size="sm"
                        variant="destructive"
                        iconName="XCircle"
                        disabled={!canLeave || disabled}
                        className="transition-all duration-200 hover:-translate-y-0.5"
                        onClick={() => onToggle(term, false)}
                        title={leaveReason || 'Unregister'}
                    >
                        Unregister{withdrawClosesIn != null ? ` • closes in ${fmtLeft(withdrawClosesIn)}` : ''}
                    </Button>
                )}
            </div>

            {policy?.info && <div className="mt-2 text-xs text-muted-foreground">{policy.info}</div>}
        </article>
    );
};

export default TermCard;