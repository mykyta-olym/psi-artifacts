// src/pages/teacher-dashboard/components/ActivitiesTable.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import RowActionsDropdown from './RowActionsDropdown';
import { Checkbox } from '../../../components/ui/Checkbox';
import { stripCourseText, isPureCourseCode } from '../../../utils/utils';

const ActivitiesTable = ({
                             gridCols,
                             groups,
                             pageItems,
                             allSelectedOnPage,
                             toggleSelectAll,
                             selectedIds,
                             setSelectedIds,
                             priorityBadge,
                             iconByType,
                             colorByType,
                             timeAgo,
                             openActivity,
                             markResolved,
                             markUnresolved,
                             deleteItems,
                             exportCSV,
                             setPriority,
                             pinnedIds,
                             togglePin,
                             fallbackTeacher,
                             fallbackRoom,
                         }) => {
    const hasRows = pageItems && pageItems.length > 0;

    const pinnedSet = useMemo(() => {
        if (pinnedIds instanceof Set) return pinnedIds;
        if (Array.isArray(pinnedIds)) return new Set(pinnedIds);
        return new Set();
    }, [pinnedIds]);

    const isPinned = (id) => pinnedSet.has(id);

    const topSentinelRef = useRef(null);
    const [stuck, setStuck] = useState(false);
    useEffect(() => {
        if (!topSentinelRef.current) return;
        const ob = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: [1] });
        ob.observe(topSentinelRef.current);
        return () => ob.disconnect();
    }, []);

    const someOnPageSelected = useMemo(
        () => pageItems.some((i) => selectedIds.includes(i.id)),
        [pageItems, selectedIds]
    );

    const chipsLine = (a, subjectDisplay, classIdDisplay) => {
        const authorDisplay = a.authorName || a?.meta?.author || a.studentName || '';
        const showFallbackTeacher = !!fallbackTeacher && !authorDisplay;
        return (
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
        );
    };

    const computeDisplay = (a) => {
        const titleDisplay = stripCourseText(a.title || '');
        const subjectDisplay = stripCourseText(a.subject || '');
        const descrDisplay = stripCourseText(a.description || '');
        const classIdDisplay = isPureCourseCode(a.classId) ? '' : a.classId || '';
        const pr = priorityBadge(a.priority);
        return { titleDisplay, subjectDisplay, descrDisplay, classIdDisplay, pr };
    };

    return (
        <>
            <div ref={topSentinelRef} className="h-1 -mt-1 pointer-events-none" />
            <div
                className={`hidden xl:grid items-center px-3 sm:px-4 py-2 border-b text-xs text-muted-foreground sticky top-0 z-20 ${
                    stuck ? 'shadow-sm bg-card/90 supports-[backdrop-filter]:bg-card/70 backdrop-blur border-border' : 'bg-card border-border'
                }`}
                style={{ gridTemplateColumns: gridCols }}
            >
                <div className="pt-0.5">
          <span data-stop-row="1">
            <Checkbox
                checked={hasRows && allSelectedOnPage}
                indeterminate={hasRows && !allSelectedOnPage && someOnPageSelected}
                aria-checked={
                    hasRows
                        ? allSelectedOnPage
                            ? 'true'
                            : someOnPageSelected
                                ? 'mixed'
                                : 'false'
                        : 'false'
                }
                onChange={(e) => toggleSelectAll(!!e?.target?.checked)}
                disabled={!hasRows}
                title={hasRows ? 'Select all on this page' : 'No rows on this page'}
            />
          </span>
                </div>
                <div className="uppercase tracking-wide">Activity</div>
                <div className="uppercase tracking-wide">Type</div>
                <div className="text-center uppercase tracking-wide">Pinned</div>
                <div className="text-right uppercase tracking-wide">Priority</div>
                <div className="text-right uppercase tracking-wide">When</div>
                <div className="text-right pr-1 uppercase tracking-wide">Actions</div>
            </div>

            <div className="divide-y divide-border">
                {groups.map(([label, items]) => (
                    <div key={label}>
                        <div className="px-3 sm:px-4 py-2 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground border-t border-border sticky top-10 xl:top-[42px] z-10">
                            {label}
                        </div>

                        {items.map((a) => {
                            const { titleDisplay, subjectDisplay, descrDisplay, classIdDisplay, pr } = computeDisplay(a);
                            const selected = selectedIds.includes(a.id);
                            const pinned = isPinned(a.id);

                            return (
                                <React.Fragment key={a.id}>
                                    <div
                                        className={`px-2 xl:px-4 py-3 hover:bg-muted/30 transition-colors duration-200 ${
                                            a.requiresAction ? 'bg-warning/5' : ''
                                        } hidden xl:grid`}
                                        style={{ gridTemplateColumns: gridCols }}
                                    >
                                        <div className="pt-1">
                      <span data-stop-row="1">
                        <Checkbox
                            checked={selected}
                            onChange={(e) => {
                                if (e?.target?.checked) setSelectedIds((prev) => [...prev, a.id]);
                                else setSelectedIds((prev) => prev.filter((id) => id !== a.id));
                            }}
                            aria-label="Select activity"
                        />
                      </span>
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                    <Icon name={iconByType(a.type)} size={16} className={colorByType(a.type)} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-foreground font-medium truncate max-w-full">{titleDisplay}</h3>
                                                    {!!descrDisplay && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{descrDisplay}</p>}
                                                    {chipsLine(a, subjectDisplay, classIdDisplay)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">{a.type}</span>
                                        </div>

                                        <div className="flex items-center justify-center">
                                            <Button size="xs" variant="ghost" iconName={pinned ? 'Star' : 'StarOff'} onClick={() => togglePin(a.id)} title={pinned ? 'Unpin' : 'Pin'} />
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <span className={`text-[11px] px-2 py-0.5 rounded ${pr.cls}`}>{pr.text}</span>
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(a.timestamp)}</span>
                                        </div>

                                        <div className="flex items-center justify-end gap-1 flex-wrap max-w-full">
                                            <Button size="xs" variant="outline" iconName="ExternalLink" onClick={() => openActivity(a)}>
                                                Open
                                            </Button>
                                            {a.requiresAction ? (
                                                <Button size="xs" variant="default" iconName="CheckCheck" onClick={() => markResolved([a.id])}>
                                                    Resolve
                                                </Button>
                                            ) : (
                                                <Button size="xs" variant="outline" iconName="AlertTriangle" onClick={() => markUnresolved([a.id])}>
                                                    Mark action
                                                </Button>
                                            )}
                                            <Button size="xs" variant="ghost" iconName="Trash2" onClick={() => deleteItems([a.id])} />
                                            <RowActionsDropdown
                                                activity={a}
                                                onOpen={() => openActivity(a)}
                                                onResolve={() => markResolved([a.id])}
                                                onMarkAction={() => markUnresolved([a.id])}
                                                onDelete={() => deleteItems([a.id])}
                                                onExport={() => exportCSV([a.id])}
                                                onSetPriority={(lvl) => setPriority(a.id, lvl)}
                                                isPinned={pinned}
                                                onTogglePin={() => togglePin(a.id)}
                                            />
                                        </div>
                                    </div>

                                    <div className="xl:hidden px-4 py-3 border-t border-border relative" key={`${a.id}-m`}>
                                        <div className="absolute top-3 right-3">
                                            <RowActionsDropdown
                                                activity={a}
                                                onOpen={() => openActivity(a)}
                                                onResolve={() => markResolved([a.id])}
                                                onMarkAction={() => markUnresolved([a.id])}
                                                onDelete={() => deleteItems([a.id])}
                                                onExport={() => exportCSV([a.id])}
                                                onSetPriority={(lvl) => setPriority(a.id, lvl)}
                                                isPinned={pinned}
                                                onTogglePin={() => togglePin(a.id)}
                                            />
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                <Icon name={iconByType(a.type)} size={16} className={colorByType(a.type)} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap pr-10">
                                                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">{a.type}</span>
                                                    {a.requiresAction && (
                                                        <span className="text-[11px] px-2 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning inline-flex items-center gap-1">
                              <Icon name="AlertTriangle" size={12} /> Action needed
                            </span>
                                                    )}
                                                    <span className={`text-[11px] px-2 py-0.5 rounded ${pr.cls}`}>{pr.text}</span>
                                                    {pinned && (
                                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary inline-flex items-center gap-1">
                              <Icon name="Star" size={12} /> Pinned
                            </span>
                                                    )}
                                                </div>

                                                <h3 className="text-foreground font-medium mt-1 break-words">{titleDisplay}</h3>
                                                {!!descrDisplay && <p className="text-sm text-muted-foreground mt-1">{descrDisplay}</p>}

                                                {chipsLine(a, subjectDisplay, classIdDisplay)}

                                                <div className="mt-2 text-xs text-muted-foreground">{timeAgo(a.timestamp)}</div>

                                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                                    <Button size="xs" variant="ghost" iconName={pinned ? 'Star' : 'StarOff'} onClick={() => togglePin(a.id)} />
                                                    <Button size="xs" variant="outline" iconName="ExternalLink" onClick={() => openActivity(a)}>
                                                        Open
                                                    </Button>
                                                    {a.requiresAction ? (
                                                        <Button size="xs" variant="default" iconName="CheckCheck" onClick={() => markResolved([a.id])}>
                                                            Resolve
                                                        </Button>
                                                    ) : (
                                                        <Button size="xs" variant="outline" iconName="AlertTriangle" onClick={() => markUnresolved([a.id])}>
                                                            Mark action
                                                        </Button>
                                                    )}
                                                    <Button size="xs" variant="ghost" iconName="Trash2" onClick={() => deleteItems([a.id])} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                ))}
            </div>
        </>
    );
};

export default ActivitiesTable;