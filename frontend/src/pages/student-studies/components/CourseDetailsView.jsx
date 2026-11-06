// src/pages/student-studies/components/CourseDetailsView.jsx
import React from 'react';
import Button from '../../../components/ui/Button';
import AttendanceChart from '../../attendance-tracking/components/AttendanceChart';
import SectionHeader from './SectionHeader';
import InfoRow from './InfoRow';
import AssessmentTable from './AssessmentTable';
import GradeScaleTable from './GradeScaleTable';
import ThesisInfoCard from './ThesisInfoCard';
import { isThesisCourse } from '../utils/studentStudiesUtils';

export default function CourseDetailsView({ course, onBack, isArchived }) {
    if (!course) return null;
    const thesis = isThesisCourse(course);

    if (thesis) {
        return (
            <div className="space-y-6">
                <SectionHeader icon="BookOpen" title={course.name} subtitle={`${course.code} • ${course.credits} ECTS`} right={<Button variant="outline" iconName="ArrowLeft" onClick={onBack}>Back</Button>} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <InfoRow label="Course code" value={course.code} />
                        <InfoRow label="Credits" value={course.credits} />
                        <InfoRow label="Completion" value={course.completion} />
                        <InfoRow label="Lecturer" value={course.instructor} />
                    </div>
                </div>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <h3 className="font-semibold text-foreground mb-3">Overall grade</h3>
                    <div className="rounded-lg border border-border p-3 flex flex-wrap items-center gap-3">
                        <div className="text-xl font-semibold">
                            {course.overall?.letter || course.gradeLetter} ({course.overall?.pct ?? course.gradePct}%)
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {course.overall?.date || '—'} · {course.overall?.by || course.instructor}
                        </div>
                    </div>
                </div>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <h3 className="font-semibold text-foreground mb-3">Continuous assessment</h3>
                    <div className="text-sm mb-3">Passed in continuous assessment: <span className="font-medium">{course.continuous?.passedPct ?? '—'} %</span></div>
                    <AssessmentTable items={course.continuous?.items || []} />
                    <div className="text-xs text-muted-foreground mt-2">Maximum possible: {course.continuous?.maxPct ?? 100}% • Passing threshold: {course.continuous?.thresholdPct ?? 51}%</div>
                </div>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <h3 className="font-semibold text-foreground mb-3">Final assessment</h3>
                    <div className="text-sm mb-3">Passed in final assessment: <span className="font-medium">{course.final?.passedPct ?? '—'} %</span></div>
                    <AssessmentTable items={course.final?.items || []} showTerm />
                    <div className="text-xs text-muted-foreground mt-2">Maximum possible: {course.final?.maxPct ?? 100}% • Passing threshold: {course.final?.thresholdPct ?? 51}%</div>
                </div>

                {isArchived && course.thesisInfo && (
                    <div className="bg-card glass-card rounded-lg border border-border p-4">
                        <h3 className="font-semibold text-foreground mb-3">My Final Thesis</h3>
                        <ThesisInfoCard info={course.thesisInfo} />
                    </div>
                )}

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <h3 className="font-semibold text-foreground mb-3">Grade conversion table</h3>
                    <GradeScaleTable />
                </div>
            </div>
        );
    }

    const chartTitle = isArchived ? 'Year trend (all year)' : 'Weekly trend (12 weeks)';
    const chartData = (course.weeklyTrend || []).map((p) => ({ id: p.id, date: p.date, attendanceRate: p.attendanceRate }));

    return (
        <div className="space-y-6">
            <SectionHeader icon="BookOpen" title={course.name} subtitle={`${course.code} • ${course.credits} ECTS`} right={<Button variant="outline" iconName="ArrowLeft" onClick={onBack}>Back</Button>} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-3 lg:col-span-1">
                    <InfoRow label="Course code" value={course.code} />
                    <InfoRow label="Credits" value={course.credits} />
                    <InfoRow label="Completion" value={course.completion} />
                    <InfoRow label="Lecturer" value={course.instructor} />
                </div>

                <div className="lg:col-span-2 bg-card glass-card rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-foreground">{chartTitle}</h3>
                        <div className="text-xs text-muted-foreground">{isArchived ? 'Full study span' : 'Weeks 1–12'}</div>
                    </div>
                    <AttendanceChart data={chartData} chartType="line" title="" />
                </div>
            </div>

            <div className="bg-card glass-card rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground mb-2">Overall grade</h3>
                <div className="rounded-lg border border-border p-3 flex flex-wrap items-center gap-3">
                    <div className="text-xl font-semibold">
                        {(course.overall?.letter || course.gradeLetter) ?? '—'} ({(course.overall?.pct ?? course.gradePct) ?? '—'}%)
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {(course.overall?.date || '—')} · {(course.overall?.by || course.instructor || '—')}
                    </div>
                </div>
            </div>

            <div className="bg-card glass-card rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">Continuous assessment</h3>
                <div className="text-sm mb-3">
                    Passed in continuous assessment: <span className="font-medium">{course.continuous?.passedPct ?? '—'} %</span>
                </div>
                <AssessmentTable items={course.continuous?.items || []} />
                <div className="text-xs text-muted-foreground mt-2">
                    Maximum possible: {course.continuous?.maxPct ?? 40}% • Passing threshold: {course.continuous?.thresholdPct ?? 21}%
                </div>
            </div>

            <div className="bg-card glass-card rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">Final assessment</h3>
                <div className="text-sm mb-3">
                    Passed in final assessment: <span className="font-medium">{course.final?.passedPct ?? '—'} %</span>
                </div>
                <AssessmentTable items={course.final?.items || []} showTerm />
                <div className="text-xs text-muted-foreground mt-2">
                    Maximum possible: {course.final?.maxPct ?? 60}% • Passing threshold: {course.final?.thresholdPct ?? 31}%
                </div>
            </div>

            <div className="bg-card glass-card rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">Grade conversion table</h3>
                <GradeScaleTable />
            </div>
        </div>
    );
}