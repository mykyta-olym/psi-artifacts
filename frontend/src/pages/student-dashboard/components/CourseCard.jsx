// src/pages/student-dashboard/components/CourseCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { resolveTukeMaterialsUrl } from '../utils/studentDashboardUtils';

export default function CourseCard({ course }) {
    const navigate = useNavigate();

    // Determine completion type label
    const completionLabel = (() => {
        const ct = String(course.completion || course.completionSk || '').toLowerCase().trim();
        if (ct === 'cr' || ct === 'credit' || ct === 'zapocet' || ct === 'z' || ct === 'kz') {
            return 'Credit';
        }
        if (ct === 'crex' || ct === 'creditexam' || ct.includes('exam') || ct.includes('skúška') || ct.includes('skuska') || ct.includes('zs')) {
            return 'Credit + Exam';
        }
        return ct || null;
    })();

    return (
        <article className="w-full max-w-full bg-card rounded-lg border border-border p-4 md:p-5 overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
            <header className="flex items-start justify-between gap-3 mb-3 md:mb-4 min-w-0">
                <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate" title={course.name}>
                        {course.name}
                    </h3>
                    <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                        {course.code} • {course.credits} ECTS
                        {completionLabel && <span className="ml-2 text-primary/80">• {completionLabel}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Icon name="Trophy" size={16} className="text-muted-foreground" />
                    <span className="text-sm md:text-base font-medium text-foreground tabular-nums">{course.currentGrade}%</span>
                    {course.letter && (
                        <span className="inline-flex items-center rounded-full border border-border px-2 py-[2px] text-xs font-medium">
                          {course.letter}
                        </span>
                    )}
                </div>
            </header>

            <div className="space-y-2 mb-3 md:mb-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-foreground tabular-nums">{course.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2" role="progressbar" aria-valuenow={course.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${course.progress}%` }} />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 md:gap-3">
                <Button
                    variant="default"
                    size="sm"
                    iconName="BookOpen"
                    onClick={() => {
                        const url = resolveTukeMaterialsUrl(course.code, course.name);
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="w-full sm:flex-1 md:w-auto"
                >
                    Materials
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    iconName="ClipboardList"
                    onClick={() => navigate(`/student-studies?view=courses&open=${encodeURIComponent(course.code)}`)}
                    className="w-full sm:flex-1 md:w-auto"
                >
                    Grades
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    iconName="CalendarDays"
                    onClick={() => navigate(`/class-schedule-management?course=${encodeURIComponent(course.code)}`)}
                    className="w-full sm:flex-1 md:w-auto"
                >
                    Schedule
                </Button>
            </div>
        </article>
    );
}