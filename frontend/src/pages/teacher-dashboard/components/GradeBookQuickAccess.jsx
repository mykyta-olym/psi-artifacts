// src/components/.../GradeBookQuickAccess.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const normalizeName = (s = '') => s.replace(/\s+/g, ' ').trim();

const resolveCourseFromSubject = (subject, courseList = []) => {
    const s = normalizeName(subject);
    if (!s) return null;

    let found = courseList.find((c) => c.nameEn === s || c.nameSk === s);
    if (found) return found;

    const base = s.replace(/\s*\([^)]*\)\s*$/, '');
    found = courseList.find(
        (c) =>
            normalizeName(c.nameEn).startsWith(base) ||
            normalizeName(c.nameSk).startsWith(base)
    );
    if (found) return found;

    const m = s.match(/\(([^)]+)\)\s*$/);
    const abbr = m ? m[1] : '';
    if (abbr) {
        found = courseList.find(
            (c) =>
                c.nameEn.includes(`(${abbr})`) ||
                c.nameSk.includes(`(${abbr})`)
        );
    }
    return found || null;
};

const metaForCourseCode = (code, timetableEntries = [], facultyList = []) => {
    const slots = timetableEntries.filter((t) => t.courseCode === code);
    const groupKeys = Array.from(
        new Set(
            slots.flatMap((t) => (Array.isArray(t.classGroupKeys) ? t.classGroupKeys : []))
        )
    );
    const rooms = Array.from(new Set(slots.map((t) => t.room).filter(Boolean)));
    const teachers = Array.from(
        new Set(
            slots
                .map((t) => {
                    const email = String(t.teacherEmail || '').toLowerCase();
                    if (!email) return null;
                    const teacher = facultyList.find((f) => String(f.email || '').toLowerCase() === email);
                    return teacher ? (teacher.fullName || teacher.displayName || teacher.name || teacher.email) : t.teacher;
                })
                .filter(Boolean)
        )
    );
    return { groupKeys, rooms, teachers };
};

const GradeBookQuickAccess = ({ gradeBookData, coursesList = [], timetableEntries = [], facultyList = [] }) => {
    const navigate = useNavigate();

    const totalAssignments = Number.isFinite(gradeBookData?.totalAssignments) && gradeBookData.totalAssignments > 0 ? gradeBookData.totalAssignments : 0;
    const pendingGrades     = Number.isFinite(gradeBookData?.pendingGrades) && gradeBookData.pendingGrades > 0 ? gradeBookData.pendingGrades : 0;
    const averageGrade      = Number.isFinite(gradeBookData?.averageGrade) && gradeBookData.averageGrade > 0 ? gradeBookData.averageGrade : 0;

    const distribution = useMemo(() => gradeBookData?.gradeDistribution || [], [gradeBookData]);
    const assignments  = useMemo(() => gradeBookData?.recentAssignments || [], [gradeBookData]);

    const handleViewGradeBook = () => navigate('/grade-management');

    const handleQuickGradeEntry = (assignment) => {
        if (!assignment) return;
        
        const params = new URLSearchParams();

        const course = resolveCourseFromSubject(assignment?.subject, coursesList);
        if (course) {
            params.set('course', course.code);
            params.set('subject', `${course.nameEn} (${course.code})`);

            const meta = metaForCourseCode(course.code, timetableEntries, facultyList);
            if (meta.groupKeys.length === 1) params.set('class', meta.groupKeys[0]);
        } else if (assignment?.classId) {
            params.set('classId', assignment.classId);
        } else if (assignment?.courseCode) {
            params.set('course', assignment.courseCode);
        }

        if (!params.has('subject') && assignment?.subject)
            params.set('subject', normalizeName(assignment.subject));

        if (assignment?.sectionKey) params.set('class', assignment.sectionKey);
        if (assignment?.group) params.set('class', assignment.group);

        params.set('action', 'entry');

        navigate(`/grade-management?${params.toString()}`);
    };

    const barColor = (pct) => (pct >= 80 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-error');

    return (
        <section className="bg-card rounded-lg border border-border p-6" aria-labelledby="gradebook-title">
            <div className="flex items-center justify-between mb-4">
                <h3 id="gradebook-title" className="text-lg font-semibold text-foreground">Grade Book</h3>
                <Button variant="ghost" size="sm" iconName="BookOpen" onClick={handleViewGradeBook}>View All</Button>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className="text-center p-3 bg-muted rounded-md">
                    <div className="text-2xl font-bold text-foreground">{totalAssignments > 0 ? totalAssignments : '—'}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-md">
                    <div className="text-2xl font-bold text-warning">{pendingGrades > 0 ? pendingGrades : '—'}</div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-md">
                    <div className="text-2xl font-bold text-success">{averageGrade > 0 ? `${averageGrade}%` : '—'}</div>
                    <div className="text-xs text-muted-foreground">Average</div>
                </div>
            </div>

            <div className="space-y-3 mb-4" aria-labelledby="recent-assignments-title">
                <h4 id="recent-assignments-title" className="text-sm font-semibold text-foreground">Recent Assignments</h4>

                {assignments.map((a) => {
                    const course = resolveCourseFromSubject(a?.subject, coursesList);
                    const meta = course ? metaForCourseCode(course.code, timetableEntries, facultyList) : { groupKeys: [], rooms: [], teachers: [] };

                    return (
                        <div
                            key={a?.id}
                            className="flex flex-col gap-2 p-3 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-foreground truncate">{a?.title}</h5>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        {a?.subject} • Due: {a?.dueDate}
                                    </p>

                                    {meta.groupKeys.length > 0 && (
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5">
                        <Icon name="Layers" size={12} className="text-muted-foreground" />
                        Groups: {meta.groupKeys.join(', ')}
                      </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-center">
                                        <div className="text-sm font-medium text-foreground">
                                            {a?.gradedCount}/{a?.totalSubmissions}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">Graded</div>
                                    </div>

                                    {a?.gradedCount < a?.totalSubmissions && (
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            iconName="Edit"
                                            onClick={() => handleQuickGradeEntry(a)}
                                        >
                                            Grade
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {assignments.length === 0 && (
                    <div className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
                        No recent assignments.
                    </div>
                )}
            </div>

            <div className="space-y-3" aria-labelledby="grade-distribution-title">
                <h4 id="grade-distribution-title" className="text-sm font-semibold text-foreground">Grade Distribution</h4>
                {distribution.map((g) => (
                    <div key={g?.range} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{g?.range}</span>
                            <span className="text-muted-foreground">{g?.count} students</span>
                        </div>
                        <div
                            className="w-full bg-muted rounded-full h-2"
                            role="progressbar"
                            aria-valuenow={g?.percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className={`h-2 rounded-full ${barColor(g?.percentage)}`}
                                style={{ width: `${g?.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {gradeBookData?.missingAssignments > 0 && (
                <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-md">
                    <div className="flex items-center gap-2">
                        <Icon name="AlertTriangle" size={16} className="text-error" />
                        <span className="text-sm font-medium text-error">
              {gradeBookData?.missingAssignments} assignments need attention
            </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Some students have missing or late submissions
                    </p>
                </div>
            )}
        </section>
    );
};

export default GradeBookQuickAccess;