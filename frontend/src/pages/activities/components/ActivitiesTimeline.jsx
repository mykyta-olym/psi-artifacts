import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { stripCourseText, isPureCourseCode } from '../../../utils/utils';

const ActivitiesTimeline = ({
                                groups,
                                priorityBadge,
                                timeAgo,
                                openActivity,
                                markResolved,
                                markUnresolved,
                                fallbackTeacher,
                                fallbackRoom,
                            }) => {
    return (
        <div className="divide-y divide-border">
            {groups.map(([label, items]) => (
                <div key={label}>
                    <div className="px-4 py-2 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground border-t border-border">
                        {label}
                    </div>

                    {items.map((a) => {
                        const pr = priorityBadge(a.priority);
                        const titleDisplay = stripCourseText(a.title || '');
                        const subjectDisplay = stripCourseText(a.subject || '');
                        const descrDisplay = stripCourseText(a.description || '');
                        const classIdDisplay = isPureCourseCode(a.classId) ? '' : a.classId || '';
                        const authorDisplay = a.authorName || a?.meta?.author || a.studentName || '';
                        const showFallbackTeacher = !!fallbackTeacher && !authorDisplay;

                        return (
                            <div key={a.id} className="p-4 hover:bg-muted/30 transition-colors duration-200">
                                <div className="flex gap-3">
                                    <div className="relative flex flex-col items-center">
                                        <div className="w-[2px] bg-border absolute top-0 bottom-0 left-1/2 -translate-x-1/2" />
                                        <div className="relative z-10 w-3 h-3 rounded-full bg-primary ring-2 ring-primary/20" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {a.requiresAction && (
                                                        <span className="text-[11px] px-2 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning inline-flex items-center gap-1">
                              <Icon name="AlertTriangle" size={12} /> Action needed
                            </span>
                                                    )}
                                                    <span className={`text-[11px] px-2 py-0.5 rounded ${pr.cls}`}>{pr.text}</span>
                                                </div>
                                                <h3 className="text-foreground font-medium mt-1">{titleDisplay}</h3>
                                                {!!descrDisplay && <p className="text-sm text-muted-foreground mt-1">{descrDisplay}</p>}
                                                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    {!!authorDisplay && (
                                                        <span className="inline-flex items-center gap-1">
                              <Icon name="User" size={12} /> {authorDisplay}
                            </span>
                                                    )}
                                                    {!!subjectDisplay && (
                                                        <span className="inline-flex items-center gap-1">
                              <Icon name="BookOpen" size={12} /> {subjectDisplay}
                            </span>
                                                    )}
                                                    {!!classIdDisplay && (
                                                        <span className="inline-flex items-center gap-1">
                              <Icon name="Hash" size={12} /> {classIdDisplay}
                            </span>
                                                    )}
                                                    {showFallbackTeacher && (
                                                        <span className="inline-flex items-center gap-1">
                              <Icon name="UserCheck" size={12} /> {fallbackTeacher}
                            </span>
                                                    )}
                                                    {!!fallbackRoom && (
                                                        <span className="inline-flex items-center gap-1">
                              <Icon name="Building2" size={12} /> Room: {fallbackRoom}
                            </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.timestamp)}</div>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <Button size="xs" variant="outline" iconName="ExternalLink" onClick={() => openActivity(a)}>Open</Button>
                                            {a.requiresAction ? (
                                                <Button size="xs" variant="default" iconName="CheckCheck" onClick={() => markResolved([a.id])}>Resolve</Button>
                                            ) : (
                                                <Button size="xs" variant="outline" iconName="AlertTriangle" onClick={() => markUnresolved([a.id])}>Mark action</Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default ActivitiesTimeline;