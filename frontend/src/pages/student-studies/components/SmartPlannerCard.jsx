// src/pages/student-studies/components/SmartPlannerCard.jsx
import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ProgressBar from './ProgressBar';

export default function SmartPlannerCard({ courses, totalCredits, earnedCredits, onOpen }) {
    const remaining = Math.max(0, totalCredits - earnedCredits);
    const ranked = useMemo(() => {
        return [...courses]
            .map((c) => {
                const risk = Math.round(0.6 * (100 - c.progress) + 0.4 * (100 - c.attendance));
                const roi = Math.round(((c.credits * (100 - c.progress)) / 100) * 100) / 100;
                return { id: c.id, code: c.code, name: c.name, risk, roi, progress: c.progress, attendance: c.attendance };
            })
            .sort((a, b) => b.risk - a.risk)
            .slice(0, 3);
    }, [courses]);

    return (
        <div className="bg-card glass-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="Target" size={16} className="text-primary" />
                    <h3 className="font-semibold text-foreground">Smart ECTS Planner & Risk Radar</h3>
                </div>
                <div className="text-sm text-muted-foreground">ECTS {earnedCredits}/{totalCredits}</div>
            </div>
            <div className="text-sm text-muted-foreground mb-3">Remaining this semester: <span className="text-foreground font-medium">{remaining} ECTS</span></div>
            <div className="space-y-3">
                {ranked.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-3 hover-lift">
                        <div className="min-w-0">
                            <div className="font-medium truncate">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.code} • Risk {r.risk}% • ROI {r.roi}</div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">Progress</div>
                        <ProgressBar value={r.progress} />
                        <div className="mt-1 text-xs text-muted-foreground">Attendance</div>
                        <ProgressBar value={r.attendance} />
                        <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="outline" iconName="ArrowRight" onClick={() => onOpen && onOpen(r.id)}>Go to course</Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}