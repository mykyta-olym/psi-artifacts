// src/components/profile/TeachingSchedule.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { DAY_LABELS, DAYS_KEYS as Days } from '../../constants/schedulePolicy';
import { fetchTeacherTimetable } from '../../data/maisApiAdapter';

const TeachingSchedule = ({ email, refreshToken = 0 }) => {
    const [schedule, setSchedule] = useState(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        (async () => {
            console.log('[TeachingSchedule] Fetching timetable for email:', email);
            const items = await fetchTeacherTimetable(email);
            console.log('[TeachingSchedule] Received items:', items);
            if (!mounted) return;
            const byDay = new Map();
            for (const it of items) {
                if (!byDay.has(it.day)) byDay.set(it.day, []);
                byDay.get(it.day).push(it);
            }
            for (const arr of byDay.values()) arr.sort((a,b)=>String(a.start).localeCompare(String(b.start)));
            setSchedule(byDay);
            setLoading(false);
        })();
        return () => { mounted = false; };
    }, [email, refreshToken]);
    
    if (loading) return <div className="text-sm text-muted-foreground">Loading schedule...</div>;
    if (!email) return <div className="text-sm text-muted-foreground">No email provided to load schedule.</div>;
    if (!schedule || schedule.size === 0) return <div className="text-sm text-muted-foreground">No scheduled classes for this teacher.</div>;
    const DAYS_ORDER = Days.filter(k => k !== 'Sat' && k !== 'Sun').map(k => DAY_LABELS[k] || k);
    return (
        <div className="space-y-3">
            {DAYS_ORDER.filter(d=>schedule.has(d)).map(day=>{
                const items = schedule.get(day) || [];
                return (
                    <div key={day} className="rounded-lg border border-border overflow-hidden">
                        <div className="px-3 py-2 text-sm font-medium bg-muted/40 border-b border-border">{day}</div>
                        <div className="divide-y divide-border">
                            {items.map((it, idx) => {
                                const title = it.courseName || it.courseCode;
                                return (
                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 px-3 py-2 bg-card/50">
                                        <div className="md:col-span-2 font-medium truncate">{title}</div>
                                        <div className="md:col-span-1 text-sm text-muted-foreground font-mono">{it.start}–{it.end}</div>
                                        <div className="md:col-span-1 text-sm text-muted-foreground">{it.room || '—'}</div>
                                        <div className="md:col-span-1 text-sm text-muted-foreground">{it.group || '—'}</div>
                                        <div className="md:col-span-1 text-sm text-muted-foreground">{it.type || 'Lecture'}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TeachingSchedule;