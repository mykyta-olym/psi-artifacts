// src/pages/student-studies/components/CoursesView.jsx
import React, { useMemo, useState } from 'react';
import SectionHeader from './SectionHeader';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Badge from './Badge';
import ProgressBar from './ProgressBar';

export default function CoursesView({ studies, onOpen }) {
    const [search, setSearch] = useState('');
    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return studies.courses;
        return studies.courses.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }, [search, studies.courses]);

    return (
        <div className="space-y-6">
            <SectionHeader
                icon="BookOpen"
                title="My Courses"
                subtitle="Progress, attendance, and grades per course"
                right={
                    <div className="flex items-center gap-2 w-full xl:w-auto z-stack of-visible">
                        <Input placeholder="Search courses..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full sm:w-64" />
                        <Button variant="outline" iconName="Filter">Filters</Button>
                    </div>
                }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCourses.map((c) => (
                    <div key={c.id} className="bg-card glass-card rounded-lg border border-border p-4 hover-lift">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs text-muted-foreground">{c.code} • {c.credits} ECTS</div>
                                <div className="font-semibold text-foreground truncate">{c.name}</div>
                            </div>
                            <Badge className="bg-primary/10 border-primary/30">Grade {c.gradeLetter} • {c.gradePct}%</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <span className="inline-flex items-center justify-center rounded-full border px-2 py-1">ECTS: {c.credits}</span>
                            <span className="inline-flex items-center justify-center rounded-full border px-2 py-1">Completion: {c.completion}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Progress</span><span className="font-medium">{c.progress}%</span></div>
                            <ProgressBar value={c.progress} />
                            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Attendance</span><span className="font-medium">{c.attendance}%</span></div>
                            <ProgressBar value={c.attendance} />
                        </div>
                        <div className="mt-4 flex items-center justify-end">
                            <Button size="sm" iconName="ExternalLink" onClick={() => onOpen(c.id)}>Open</Button>
                        </div>
                    </div>
                ))}
                {!filteredCourses.length && (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No courses match your search</div>
                )}
            </div>
        </div>
    );
}