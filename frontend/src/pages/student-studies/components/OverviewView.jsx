// src/pages/student-studies/components/OverviewView.jsx
import React, { useRef } from 'react';
import { useToasts } from '../../../components/ui/Toasts';
import SectionHeader from './SectionHeader';
import MetricCard from './MetricCard';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import SmartPlannerCard from './SmartPlannerCard';
import AttendanceChart from '../../attendance-tracking/components/AttendanceChart';
import QuickActionPanel from '../../../components/ui/QuickActionPanel';

export default function OverviewView({ isArchived, studies, overviewTrend, yearLabel, scheduleToday, onOpen, facts }) {
    const { notify } = useToasts();
    const toastStamp = useRef(0);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
                <div className="z-stack of-visible">
                    <SectionHeader
                        icon="GraduationCap"
                        title="Studies"
                        subtitle="Academic overview, courses, scholarships, and financing"
                        right={
                            <div className="flex items-center gap-3 w-full xl:w-auto">
                                <Button onClick={() => {
                                    const now = Date.now();
                                    if (now - toastStamp.current > 2500) {
                                        toastStamp.current = now;
                                        notify('success', 'Transcript export started', { title: 'Download' });
                                    }
                                }} iconName="Download">Download Transcript</Button>
                            </div>
                        }
                    />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="GPA" value={studies.gpa.toFixed(2)} sub="Cumulative GPA" />
                    <MetricCard label="Credits Earned" value={`${studies.earnedCredits} / ${studies.totalCredits}`} sub="Completed this year" />
                    <MetricCard label="Average Attendance" value={`${studies.attendanceAvg}%`} sub="Across all courses" />
                    <MetricCard label="Courses" value={studies.courses.length} sub="Included in archive" />
                </div>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-foreground">Progress & Attendance</h3>
                        <div className="text-xs text-muted-foreground">Full study span</div>
                    </div>
                    <AttendanceChart data={overviewTrend.map(d => ({ id:d.id, date:d.date, attendanceRate:d.attendanceRate }))} chartType="line" title="" />
                </div>

                <div className="bg-card glass-card rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <Icon name="Layers" size={18} className="text-primary" />
                            <h3 className="font-semibold text-foreground">Study Information</h3>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground">
                            Program: <span className="text-foreground">{facts.program}</span> • Year: <span className="text-foreground">{facts.year}</span> • Semester: <span className="text-foreground">{facts.term}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Student Number</div>
                            <div className="text-lg font-semibold">{facts.studentNo}</div>
                            <div className="text-xs text-muted-foreground mt-1">Active record {yearLabel}</div>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Study Span</div>
                            <div className="text-lg font-semibold">{facts.started} → {facts.ends}</div>
                            <div className="text-xs text-muted-foreground mt-1">{facts.length} years total</div>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Weighted Averages</div>
                            <div className="text-lg font-semibold">{facts.weightedStudy} %</div>
                            <div className="text-xs text-muted-foreground mt-1">Closed periods: {facts.weightedClosed} %</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Credits (passed / required)</div>
                            <div className="text-lg font-semibold">{facts.creditsPassed}/{facts.creditsRequired}</div>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Credits P / PV / V</div>
                            <div className="text-lg font-semibold">{facts.p}/{facts.pv}/{facts.v}</div>
                        </div>
                        <div className="rounded-lg border border-border p-4">
                            <div className="text-sm text-muted-foreground">Recognized Credits</div>
                            <div className="text-lg font-semibold">{facts.recognized}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <QuickActionPanel userRole="student" onQuickAction={() => {}} />
                <SmartPlannerCard courses={studies.courses} totalCredits={studies.totalCredits} earnedCredits={studies.earnedCredits} onOpen={onOpen} />
            </div>
        </div>
    );
}