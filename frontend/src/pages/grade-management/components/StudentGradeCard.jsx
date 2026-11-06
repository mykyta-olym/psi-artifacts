// src/pages/grade-management/components/StudentGradeCard.jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const StudentGradeCard = ({
                            student,
                            assignments = [],
                            grades = {},
                            expanded,
                            onExpandedChange
                          }) => {
  const isControlled = typeof expanded === 'boolean';
  const [localExpanded, setLocalExpanded] = useState(false);
  const isOpen = isControlled ? expanded : localExpanded;
  const toggle = () => {
    if (isControlled) onExpandedChange?.(!expanded);
    else setLocalExpanded((v) => !v);
  };

  const navigate = useNavigate();

  const NoScrollbarStyle = () => (
      <style>{`
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      .no-scrollbar::-webkit-scrollbar { width:0; height:0; display:none; }
    `}</style>
  );

  const getLetterGrade = (p) => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');
  const getGradeColor = (g) =>
      g === 'A' ? 'text-success' :
          g === 'B' ? 'text-accent' :
              g === 'C' ? 'text-warning' :
                  g === 'D' ? 'text-orange-600' :
                      g === 'F' ? 'text-error' : 'text-muted-foreground';

  const getTrendIcon = (t) =>
      t === 'up' ? { name: 'TrendingUp', color: 'text-success' } :
          t === 'down' ? { name: 'TrendingDown', color: 'text-error' } :
              { name: 'Minus', color: 'text-muted-foreground' };

  const calcStats = useMemo(() => {
    const arr = assignments
        .map((a) => {
          const g = grades?.[`${student?.id}-${a?.id}`];
          return g ? (g.points / a.totalPoints) * 100 : null;
        })
        .filter((v) => v !== null);

    if (!arr.length) return { average: 0, letterGrade: 'N/A', completed: 0, total: assignments.length, trend: 'neutral' };

    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    const recent = arr.slice(-3), older = arr.slice(0, -3);
    const rAvg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : avg;
    const oAvg = older.length ? older.reduce((s, v) => s + v, 0) / older.length : avg;

    let trend = 'neutral';
    if (rAvg > oAvg + 2) trend = 'up';
    else if (rAvg < oAvg - 2) trend = 'down';

    return { average: Math.round(avg), letterGrade: getLetterGrade(avg), completed: arr.length, total: assignments.length, trend };
  }, [assignments, grades, student?.id]);

  const trendIcon = getTrendIcon(calcStats.trend);

  const getAssignmentGrade = (assignmentId) => {
    const g = grades?.[`${student?.id}-${assignmentId}`];
    const a = assignments?.find((x) => x?.id === assignmentId);
    if (!g || !a) return null;
    const pct = Math.round((g.points / a.totalPoints) * 100);
    return { points: g.points, total: a.totalPoints, percentage: pct, letterGrade: getLetterGrade(pct) };
  };

  const missingAssignments = useMemo(
      () => assignments.filter((a) => !grades?.[`${student?.id}-${a?.id}`]),
      [assignments, grades, student?.id]
  );

  const goContact = () => {
    const name = (student?.name || '').trim();
    const params = new URLSearchParams();
    if (student?.id) params.set('student', String(student.id));
    if (name) { params.set('q', name); params.set('search', name); }
    params.set('intent', 'contact'); params.set('focus', 'search');
    try {
      if (name) sessionStorage.setItem('sm:lastSearch', name);
      if (student?.id) sessionStorage.setItem('sm:lastStudent', String(student.id));
      sessionStorage.setItem('sm:lastIntent', 'contact');
    } catch {}
    navigate({ pathname: '/student-management', search: `?${params.toString()}` }, { state: { prefillSearch: name, intent: 'contact', selectedStudentId: student?.id } });
  };

  return (
      <section className="w-full">
        <NoScrollbarStyle />
        <div className="w-full glass-card rounded-lg border border-border overflow-hidden shadow-card hover:shadow-card transition-shadow duration-200">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Icon name="User" size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-foreground truncate">{student?.name}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{student?.studentId}</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`text-xl sm:text-2xl font-bold ${getGradeColor(calcStats.letterGrade)}`}>{calcStats.letterGrade}</span>
                    <Icon name={trendIcon.name} size={16} className={trendIcon.color} />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{calcStats.average}%</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    iconName={isOpen ? 'ChevronUp' : 'ChevronDown'}
                    onClick={toggle}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                />
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3 bg-muted/30">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-card p-2 border border-border">
                <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
                <p className="text-sm sm:text-base font-medium text-foreground">{calcStats.completed}/{calcStats.total}</p>
              </div>
              <div className="rounded-md bg-card p-2 border border-border">
                <p className="text-xs sm:text-sm text-muted-foreground">Missing</p>
                <p className={`text-sm sm:text-base font-medium ${missingAssignments.length > 0 ? 'text-error' : 'text-success'}`}>{missingAssignments.length}</p>
              </div>
              <div className="rounded-md bg-card p-2 border border-border col-span-2 sm:col-span-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Trend</p>
                <div className="flex items-center justify-center">
                  <Icon name={trendIcon.name} size={16} className={trendIcon.color} />
                </div>
              </div>
            </div>
          </div>

          {isOpen && (
              <div className="border-t border-border">
                <div className="px-4 sm:px-5 py-4">
                  <h5 className="font-medium text-foreground mb-3">Assignment Grades</h5>
                  <div className="space-y-2 overflow-visible no-scrollbar">
                    {assignments.map((a) => {
                      const grade = getAssignmentGrade(a.id);
                      const isMissing = !grade;
                      return (
                          <div
                              key={a.id}
                              className={`flex items-center justify-between gap-3 p-2 rounded-md border ${isMissing ? 'bg-error/10 border-error/30' : 'bg-muted/30 border-border'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{a.category} • {a.totalPoints} pts</p>
                            </div>
                            <div className="text-right shrink-0">
                              {isMissing ? (
                                  <span className="text-sm font-medium text-error">Missing</span>
                              ) : (
                                  <div>
                                    <span className={`text-sm font-medium ${getGradeColor(grade.letterGrade)}`}>{grade.letterGrade}</span>
                                    <p className="text-xs text-muted-foreground">{grade.points}/{grade.total}</p>
                                  </div>
                              )}
                            </div>
                          </div>
                      );
                    })}
                  </div>
                </div>

                {missingAssignments.length > 0 && (
                    <div className="px-4 sm:px-5 py-3 bg-error/10 border-t border-border">
                      <div className="flex items-start gap-3">
                        <Icon name="AlertTriangle" size={16} className="text-error mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-error">
                            {missingAssignments.length} Missing Assignment{missingAssignments.length > 1 ? 's' : ''}
                          </p>
                          <div className="mt-1 space-y-1">
                            {missingAssignments.slice(0, 3).map((a) => (
                                <p key={a.id} className="text-xs text-error/80 truncate">
                                  • {a.name} (Due: {a?.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'})
                                </p>
                            ))}
                            {missingAssignments.length > 3 && (
                                <p className="text-xs text-error/80">• And {missingAssignments.length - 3} more...</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                )}

                <div className="px-4 sm:px-5 py-3 border-t border-border bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" iconName="MessageSquare" onClick={goContact}>Contact Student</Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        iconName="ExternalLink"
                        onClick={() => navigate(`/student-management?student=${student?.id}`)}
                    >
                      View Profile
                    </Button>
                  </div>
                </div>
              </div>
          )}
        </div>
      </section>
  );
};

export default StudentGradeCard;