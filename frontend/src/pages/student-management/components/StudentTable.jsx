// src/pages/student-management/components/StudentTable.jsx
import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import Avatar from '../../../components/ui/Avatar';
import { groupLabel } from '../index';

const StudentTable = ({
                          students = [],
                          selectedStudents = [],
                          onSelectStudent,
                          onSelectAll,
                          onStudentClick,
                          onQuickAction,
                          onSort,
                          sortField = 'name',
                          sortDirection = 'asc',
                          canSeeRecords = true,
                          canDelete = false
                      }) => {
    const getStatusBadge = (status) => {
        // If backend doesn't provide status, show neutral placeholder instead of implying "Inactive"
        if (!status) return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-muted text-muted-foreground">—</span>;
        const map = {
            active: { cls: 'bg-success text-success-foreground', label: 'Active' },
            inactive: { cls: 'bg-muted text-muted-foreground', label: 'Inactive' },
            suspended: { cls: 'bg-warning text-warning-foreground', label: 'Suspended' },
            graduated: { cls: 'bg-primary text-primary-foreground', label: 'Graduated' }
        };
        const it = map[status] || { cls: 'bg-muted text-muted-foreground', label: String(status) };
        return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${it.cls}`}>{it.label}</span>;
    };

    const fmtDate = (d) => {
        if (!d) return '—';
        const x = new Date(d);
        if (Number.isNaN(+x)) return '—';
        return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const visibleIds = useMemo(() => (students || []).map((s) => s?.id).filter(Boolean), [students]);
    const allOnPageSelected = useMemo(() => visibleIds.length > 0 && visibleIds.every((id) => selectedStudents.includes(id)), [visibleIds, selectedStudents]);
    const someOnPageSelected = useMemo(() => visibleIds.some((id) => selectedStudents.includes(id)), [visibleIds, selectedStudents]);
    const noRows = !students || students.length === 0;

    const toggleSelectAllVisible = () => {
        const nextChecked = !allOnPageSelected;
        onSelectAll?.(nextChecked, visibleIds);
    };

    const isInteractive = (el) => {
        if (!el || !(el instanceof Element)) return false;
        return !!el.closest('button,[role="button"],a,input,label,select,textarea,[contenteditable=""],[data-stop-row="1"],.btn,.btn-icon');
    };
    const stop = (e) => e.stopPropagation();

    const onRowClick = (e, s) => {
        if (!isInteractive(e.target)) onStudentClick?.(s);
    };
    const onRowKey = (e, s) => {
        if (isInteractive(e.target)) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStudentClick?.(s);
        }
    };

    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* 2XL: Full table with all columns */}
            <div className="hidden 2xl:block">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="*:[padding:0.75rem] *:px-4 text-left">
                            <th className="w-14 align-middle">
                  <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={toggleSelectAllVisible}
                        disabled={noRows}
                        title={noRows ? 'No rows on this page' : allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[200px]">
                                <SortBtn id="name" label="Name" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[110px]">
                                <SortBtn id="studentId" label="ID" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[80px]">
                                <SortBtn id="section" label="Class" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[95px]">
                                <SortBtn id="faculty" label="Faculty" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle min-w-[140px]">
                                <SortBtn id="program" label="Program" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[90px]">Status</th>
                            <th className="align-middle min-w-[180px]">Parent Contact</th>
                            <th className="align-middle w-[120px]">
                                <SortBtn id="lastActivity" label="Last Activity" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle text-center w-40">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No students on this page.</td>
                            </tr>
                        ) : (
                            students.map((s) => {
                                const isSel = selectedStudents?.includes(s?.id);
                                return (
                                    <tr
                                        key={s?.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.75rem] *:px-4"
                                        onClick={(e) => onRowClick(e, s)}
                                        onKeyDown={(e) => onRowKey(e, s)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                          <Checkbox checked={isSel} onChange={(e) => onSelectStudent?.(s?.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle">
                                            <CellName name={s?.name} email={s?.email} baseName={s?.baseName} />
                                        </td>
                                        <td className="align-middle font-mono text-xs whitespace-nowrap">{s?.studentId || '—'}</td>
                                        <td className="align-middle whitespace-nowrap text-sm">{s?.section || (s?.sectionKey ? groupLabel(s.sectionKey) : '—')}</td>
                                        <td className="align-middle">
                                            {s?.faculty ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">{s.faculty}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">
                                            {s?.program ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-xs font-medium">{s.program}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">{getStatusBadge(s?.status)}</td>
                                        <td className="align-middle">
                                            <div className="min-w-0">
                                                <p className="text-sm text-foreground truncate">{s?.parentName || '—'}</p>
                                                <p className="text-xs text-muted-foreground truncate">{s?.parentPhone}</p>
                                            </div>
                                        </td>
                                        <td className="align-middle whitespace-nowrap">
                                            <span className="text-sm text-muted-foreground">{fmtDate(s?.lastActivity)}</span>
                                        </td>
                                        <td className="align-middle">
                                            <RowActions s={s} onQuickAction={onQuickAction} canSeeRecords={canSeeRecords} canDelete={canDelete} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* XL: Compact table without some columns */}
            <div className="hidden xl:block 2xl:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="text-left *:[padding:0.7rem] *:px-3">
                            <th className="w-12 align-middle">
                  <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={toggleSelectAllVisible}
                        disabled={noRows}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[180px]">
                                <SortBtn id="name" label="Name" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[100px]">
                                <SortBtn id="studentId" label="ID" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[75px]">
                                <SortBtn id="section" label="Class" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[85px]">
                                <SortBtn id="faculty" label="Faculty" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle min-w-[130px]">
                                <SortBtn id="program" label="Program" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[80px]">Status</th>
                            <th className="align-middle w-[110px]">
                                <SortBtn id="lastActivity" label="Last" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle text-center w-32">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">No students on this page.</td>
                            </tr>
                        ) : (
                            students.map((s) => {
                                const isSel = selectedStudents?.includes(s?.id);
                                return (
                                    <tr
                                        key={s?.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.7rem] *:px-3"
                                        onClick={(e) => onRowClick(e, s)}
                                        onKeyDown={(e) => onRowKey(e, s)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                          <Checkbox checked={isSel} onChange={(e) => onSelectStudent?.(s?.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle">
                                            <CellName name={s?.name} email={s?.email || s?.studentId} baseName={s?.baseName} />
                                        </td>
                                        <td className="align-middle font-mono text-xs whitespace-nowrap">{s?.studentId || '—'}</td>
                                        <td className="align-middle whitespace-nowrap text-sm">{s?.section || '—'}</td>
                                        <td className="align-middle">
                                            {s?.faculty ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">{s.faculty}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">
                                            {s?.program ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-xs font-medium truncate max-w-[120px]">{s.program}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">{getStatusBadge(s?.status)}</td>
                                        <td className="align-middle whitespace-nowrap text-sm text-muted-foreground">
                                            {s?.lastActivity ? fmtDate(s.lastActivity) : '—'}
                                        </td>
                                        <td className="align-middle">
                                            <RowActions s={s} onQuickAction={onQuickAction} canSeeRecords={canSeeRecords} canDelete={canDelete} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* LG: More compact table */}
            <div className="hidden lg:block xl:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed min-w-[860px]">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="text-left *:[padding:0.6rem] *:px-3">
                            <th className="w-12 align-middle">
                  <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={toggleSelectAllVisible}
                        disabled={noRows}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[180px]">
                                <SortBtn id="name" label="Name" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle min-w-[150px]">
                                <SortBtn id="program" label="Program" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[90px]">
                                <SortBtn id="section" label="Class" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle text-center w-28">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No students on this page.</td>
                            </tr>
                        ) : (
                            students.map((s) => {
                                const isSel = selectedStudents?.includes(s?.id);
                                return (
                                    <tr
                                        key={s?.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.6rem] *:px-3"
                                        onClick={(e) => onRowClick(e, s)}
                                        onKeyDown={(e) => onRowKey(e, s)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                          <Checkbox checked={isSel} onChange={(e) => onSelectStudent?.(s?.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle min-w-[180px]">
                                            <CellName name={s?.name} email={s?.email || s?.studentId} baseName={s?.baseName} />
                                        </td>
                                        <td className="align-middle">
                                            {s?.program ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 text-xs font-medium truncate max-w-[140px]">{s.program}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle whitespace-nowrap text-sm">{s?.section || '—'}</td>
                                        <td className="align-middle">
                                            <RowActions s={s} onQuickAction={onQuickAction} tight canSeeRecords={canSeeRecords} canDelete={canDelete} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MD: Tablet view */}
            <div className="hidden md:block lg:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed min-w-[760px]">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="text-left *:[padding:0.55rem] *:px-2 md:text-sm text-xs">
                            <th className="w-10 md:w-12 align-middle">
                  <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={toggleSelectAllVisible}
                        disabled={noRows}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[160px]">
                                <SortBtn id="name" label="Name" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle min-w-[140px]">
                                <SortBtn id="program" label="Program" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle w-[100px]">
                                <SortBtn id="lastActivity" label="Last" sortField={sortField} sortDir={sortDirection} onSort={onSort} />
                            </th>
                            <th className="align-middle text-center w-[96px] md:w-28">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No students on this page.</td>
                            </tr>
                        ) : (
                            students.map((s) => {
                                const isSel = selectedStudents?.includes(s?.id);
                                return (
                                    <tr
                                        key={s?.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.55rem] *:px-2 md:text-sm text-xs"
                                        onClick={(e) => onRowClick(e, s)}
                                        onKeyDown={(e) => onRowKey(e, s)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                          <Checkbox checked={isSel} onChange={(e) => onSelectStudent?.(s?.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle min-w-[160px]">
                                            <CellName name={s?.name} email={s?.email || s?.studentId} baseName={s?.baseName} />
                                        </td>
                                        <td className="align-middle">
                                            <div className="truncate">{s?.program || '—'}</div>
                                        </td>
                                        <td className="align-middle whitespace-nowrap text-xs sm:text-sm text-muted-foreground max-w-[110px] overflow-hidden text-ellipsis pr-1">
                                            {fmtDate(s?.lastActivity)}
                                        </td>
                                        <td className="align-middle">
                                            <RowActions s={s} onQuickAction={onQuickAction} tight canSeeRecords={canSeeRecords} canDelete={canDelete} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="md:hidden p-3 space-y-3">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2">
                    <div className="text-xs text-muted-foreground">Showing {students.length} {students.length === 1 ? 'student' : 'students'}</div>
                    <span className="inline-flex items-center gap-2 text-xs" data-stop-row="1">
            <Checkbox
                checked={allOnPageSelected}
                indeterminate={!allOnPageSelected && someOnPageSelected}
                aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                onChange={toggleSelectAllVisible}
                disabled={noRows}
            />
            Select all
          </span>
                </div>

                {noRows ? (
                    <div className="px-1 py-6 text-center text-muted-foreground">No students on this page.</div>
                ) : (
                    students.map((s) => (
                        <div
                            key={s?.id}
                            className="p-3 sm:p-4 hover:bg-muted/30 transition-colors cursor-pointer rounded-lg border border-border bg-card"
                            onClick={(e) => onRowClick(e, s)}
                            onKeyDown={(e) => onRowKey(e, s)}
                            tabIndex={0}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-start gap-2 min-w-0">
                  <span data-stop-row="1" onPointerDown={stop} onTouchStart={stop} onMouseDown={stop} onClick={stop}>
                    <Checkbox checked={selectedStudents?.includes(s?.id)} onChange={(e) => onSelectStudent?.(s?.id, !!e?.target?.checked)} aria-label="Select row" />
                  </span>
                                    <Avatar name={s?.baseName || s?.name || ''} email={s?.email || ''} size={44} className="flex-shrink-0 ring-1 ring-border" />
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-medium text-foreground truncate">{s?.name}</h3>
                                        <p className="text-[11px] text-muted-foreground truncate">{s?.email || s?.studentId}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {getStatusBadge(s?.status)}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs mb-2">
                                <div className="min-w-0">
                                    <span className="text-muted-foreground">Class:</span>
                                    <span className="ml-1 text-foreground">{s?.section}</span>
                                </div>
                                <div className="min-w-0 truncate">
                                    <span className="text-muted-foreground">Parent:</span>
                                    <span className="ml-1 text-foreground">{s?.parentName}</span>
                                </div>
                                <div className="min-w-0 truncate sm:col-span-2">
                                    <span className="text-muted-foreground">Phone:</span>
                                    <span className="ml-1 text-foreground">{s?.parentPhone || '—'}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">Last: {fmtDate(s?.lastActivity)}</span>
                                <RowActions s={s} onQuickAction={onQuickAction} tight canSeeRecords={canSeeRecords} canDelete={canDelete} />
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="sticky bottom-0 h-0 pointer-events-none">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
        </div>
    );
};

export default StudentTable;

const cls = (...a) => a.filter(Boolean).join(' ');

const SortBtn = ({ id, label, sortField, sortDir, onSort, className }) => {
    const active = sortField === id;
    const dir = active ? sortDir : 'asc';
    const next = active && dir === 'asc' ? 'desc' : 'asc';
    return (
        <button
            type="button"
            onClick={() => onSort?.(id, next)}
            className={cls(
                'inline-flex items-center gap-1.5 whitespace-nowrap',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                className
            )}
            title={`Sort by ${label}`}
        >
            <span className="font-medium">{label}</span>
            <Icon name={active && dir === 'desc' ? 'ChevronDown' : 'ChevronUp'} size={14} />
        </button>
    );
};

function IconBtn({ name, onClick, title }) {
    return (
        <Button variant="ghost" size="icon" onClick={onClick} className="w-8 h-8 sm:w-9 sm:h-9" title={title || name} aria-label={title || name}>
            <Icon name={name} size={14} />
        </Button>
    );
}

function CellName({ name, email, baseName }) {
    return (
        <div className="flex items-center gap-3 min-w-0">
            <Avatar name={baseName || name || ''} email={email || ''} size={40} className="ring-1 ring-border" />
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
        </div>
    );
}

function RowActions({ s, onQuickAction, tight = false, canSeeRecords = true, canDelete = false }) {
    return (
        <div
            className={`flex items-center justify-center ${tight ? 'gap-1' : 'gap-1.5'} flex-wrap`}
            data-stop-row="1"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <IconBtn name="Award" onClick={() => onQuickAction?.('graduation', s)} title="Graduation Status" />
            <IconBtn name="MessageCircle" onClick={() => onQuickAction?.('message', s)} title="Message" />
            {canSeeRecords && <IconBtn name="FileText" onClick={() => onQuickAction?.('records', s)} title="Records" />}
            {canDelete && <IconBtn name="Trash2" onClick={() => onQuickAction?.('delete', s)} title="Delete" />}
        </div>
    );
}