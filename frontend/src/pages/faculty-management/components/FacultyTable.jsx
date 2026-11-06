// src/pages/faculty-management/components/FacultyTable.jsx
import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Avatar from '../../../components/ui/Avatar';
import { Checkbox } from '../../../components/ui/Checkbox';

const cls = (...a) => a.filter(Boolean).join(' ');

const fmtAgo = (iso) => {
    if (!iso) return '—';
    const t = +new Date(iso);
    if (!Number.isFinite(t)) return '—';
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

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

const Rating = ({ value = 0 }) => {
    const v = Math.max(0, Math.min(5, Number(value) || 0));
    const rounded = Math.round(v);
    return (
        <div className="flex items-center gap-1">
            <div className="inline-flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={i} name={i < rounded ? 'Star' : 'StarOff'} size={14} className={i < rounded ? 'text-yellow-500' : 'text-muted-foreground'} />
                ))}
            </div>
            <span className="text-xs text-muted-foreground">({v.toFixed(1)})</span>
        </div>
    );
};

const SubjectChips = ({ list = [] }) => {
    if (!list.length) return <span className="text-muted-foreground">—</span>;
    return (
        <div className="flex flex-wrap gap-1.5 max-w-full">
            {list.slice(0, 4).map((s) => (
                <span key={s} className="px-1.5 py-0.5 rounded-md bg-muted text-xs border border-border truncate max-w-[160px]" title={s}>
          {s}
        </span>
            ))}
            {list.length > 4 && <span className="px-1.5 py-0.5 rounded-md bg-muted text-xs border border-border">+{list.length - 4}</span>}
        </div>
    );
};

const MobileCard = ({ t, checked, onToggle, onOpenProfile, onMessage, onDelete, isYou, canMessage = true, canDelete = false }) => (
    <div
        className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => onOpenProfile?.(t)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenProfile?.(t);
            }
        }}
    >
        <div className="flex items-start gap-3">
      <span data-stop-row="1" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={checked} onChange={(e) => onToggle?.(!!e?.target?.checked)} aria-label="Select row" />
      </span>
            <Avatar name={t.name || ''} email={t.email || ''} src={t.avatarUrl || null} size={44} rounded className="ring-1 ring-border flex-shrink-0" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{t.name || '—'}</span>
                    {isYou && <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] border border-primary/30">you</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{t.email}</div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-0.5">
                <div className="text-muted-foreground">ID</div>
                <div className="font-mono">{t.employeeId || '—'}</div>
            </div>
            <div className="space-y-0.5">
                <div className="text-muted-foreground">Dept.</div>
                <div className="truncate">{t.department || '—'}</div>
            </div>
            <div className="space-y-0.5">
                <div className="text-muted-foreground">Load</div>
                <div>{t.classesCount ?? '—'}</div>
            </div>
            <div className="space-y-0.5">
                <div className="text-muted-foreground">Experience</div>
                <div>{Number.isFinite(+t.yearsExperience) ? `${t.yearsExperience} yrs` : '—'}</div>
            </div>
            <div className="col-span-2 space-y-1">
                <div className="text-muted-foreground">Subjects</div>
                <SubjectChips list={t.subjects || []} />
            </div>
            <div className="space-y-0.5">
                <div className="text-muted-foreground">Rating</div>
                <Rating value={t.rating} />
            </div>
            <div className="space-y-0.5">
                <div className="text-muted-foreground">Last Active</div>
                <span title={new Date(t.lastActivity || 0).toLocaleString()}>{fmtAgo(t.lastActivity)}</span>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
            <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile?.(t);
                }}
                iconName="User"
                className="w-full"
            >
                Profile
            </Button>
            {canMessage && (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMessage?.(t);
                    }}
                    iconName="MessageSquare"
                    className="w-full"
                >
                    Message
                </Button>
            )}
            {canDelete && (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this teacher? This cannot be undone.')) onDelete?.(t);
                    }}
                    iconName="Trash2"
                    className="w-full"
                >
                    Delete
                </Button>
            )}
        </div>
    </div>
);

const FacultyTable = ({
                          data = [],
                          selected = [],
                          onSelectAll,
                          onSelect,
                          sortField = 'name',
                          sortDir = 'asc',
                          onSort,
                          onOpenProfile,
                          onMessage,
                          onEditProfile,
                          onDelete,
                          canMessage = true,
                          canEdit = false,
                          canDelete = false
                      }) => {
    const visibleIds = useMemo(() => (data || []).map((t) => t?.id).filter(Boolean), [data]);
    const allOnPageSelected = useMemo(() => visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id)), [visibleIds, selected]);
    const someOnPageSelected = useMemo(() => visibleIds.some((id) => selected.includes(id)), [visibleIds, selected]);
    const noRows = data.length === 0;

    const isInteractive = (el) => el instanceof Element && !!el.closest('button,[role="button"],a,input,label,select,textarea,[contenteditable=""],[data-stop-row="1"],.btn,.btn-icon');

    const onRowClick = (e, t) => {
        if (!isInteractive(e.target)) onOpenProfile?.(t);
    };

    const onRowKey = (e, t) => {
        if (!isInteractive(e.target) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpenProfile?.(t);
        }
    };

    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="hidden 2xl:block">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="*:[padding:0.75rem] *:px-4 text-left">
                            <th className="w-14 align-middle">
                  <span data-stop-row="1">
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={(e) => onSelectAll?.(!!e?.target?.checked)}
                        disabled={noRows}
                        title={noRows ? 'No rows on this page' : allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[200px]">
                                <SortBtn id="name" label="Name" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle w-[110px]">
                                <SortBtn id="employeeId" label="ID" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle w-[95px]">
                                <SortBtn id="faculty" label="Faculty" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle min-w-[140px]">
                                <SortBtn id="department" label="Dept." {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle min-w-[180px]">Subjects</th>
                            <th className="align-middle text-right w-[70px]">
                                <SortBtn id="classesCount" label="Load" {...{ sortField, sortDir, onSort }} className="w-full justify-end" />
                            </th>
                            <th className="align-middle text-right w-[90px]">
                                <SortBtn id="yearsExperience" label="Exp." {...{ sortField, sortDir, onSort }} className="w-full justify-end" />
                            </th>
                            <th className="align-middle w-[110px]">
                                <SortBtn id="rating" label="Rating" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle w-[120px]">
                                <SortBtn id="lastActivity" label="Last Active" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle text-center w-40">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted-foreground">
                                    No faculty found.
                                </td>
                            </tr>
                        ) : (
                            data.map((t) => {
                                const isChecked = selected.includes(t.id);
                                const isYou = /Ing\.?\s*Marek\s*Horv[aá]th/i.test(String(t?.name || ''));
                                return (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.75rem] *:px-4"
                                        onClick={(e) => onRowClick(e, t)}
                                        onKeyDown={(e) => onRowKey(e, t)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1">
                          <Checkbox checked={isChecked} onChange={(e) => onSelect?.(t.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle">
                                            <CellName t={t} isYou={isYou} />
                                        </td>
                                        <td className="align-middle font-mono text-xs whitespace-nowrap">{t.employeeId || '—'}</td>
                                        <td className="align-middle">
                                            {t.faculty ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">{t.faculty}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">
                                            <div className="truncate text-sm" title={t.department}>{t.department || '—'}</div>
                                        </td>
                                        <td className="align-middle">
                                            <SubjectChips list={t.subjects || []} />
                                        </td>
                                        <td className="align-middle text-right">{t.classesCount ?? '—'}</td>
                                        <td className="align-middle text-right">{Number.isFinite(+t.yearsExperience) ? `${t.yearsExperience} yrs` : '—'}</td>
                                        <td className="align-middle">
                                            <Rating value={t.rating} />
                                        </td>
                                        <td className="align-middle whitespace-nowrap">
                                            <span title={new Date(t.lastActivity || 0).toLocaleString()}>{fmtAgo(t.lastActivity)}</span>
                                        </td>
                                        <td className="align-middle">
                                            <RowActions
                                                t={t}
                                                onOpenProfile={onOpenProfile}
                                                onMessage={onMessage}
                                                onEditProfile={onEditProfile}
                                                onDelete={onDelete}
                                                canMessage={canMessage}
                                                canEdit={canEdit}
                                                canDelete={canDelete}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="hidden xl:block 2xl:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="text-left *:[padding:0.7rem] *:px-3">
                            <th className="w-12 align-middle">
                  <span data-stop-row="1">
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={(e) => onSelectAll?.(!!e?.target?.checked)}
                        disabled={noRows}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[180px]">
                                <SortBtn id="name" label="Name" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle w-[100px]">
                                <SortBtn id="employeeId" label="ID" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle w-[85px]">
                                <SortBtn id="faculty" label="Faculty" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle min-w-[130px]">
                                <SortBtn id="department" label="Dept." {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle text-right w-[70px]">
                                <SortBtn id="classesCount" label="Load" {...{ sortField, sortDir, onSort }} className="w-full justify-end" />
                            </th>
                            <th className="align-middle text-right w-[90px]">
                                <SortBtn id="yearsExperience" label="Exp." {...{ sortField, sortDir, onSort }} className="w-full justify-end" />
                            </th>
                            <th className="align-middle w-[110px]">
                                <SortBtn id="lastActivity" label="Last" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle text-center w-32">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    No faculty found.
                                </td>
                            </tr>
                        ) : (
                            data.map((t) => {
                                const isChecked = selected.includes(t.id);
                                return (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.7rem] *:px-3"
                                        onClick={(e) => onRowClick(e, t)}
                                        onKeyDown={(e) => onRowKey(e, t)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1">
                          <Checkbox checked={isChecked} onChange={(e) => onSelect?.(t.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle">
                                            <CellName t={t} />
                                        </td>
                                        <td className="align-middle font-mono text-xs whitespace-nowrap">{t.employeeId || '—'}</td>
                                        <td className="align-middle">
                                            {t.faculty ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium">{t.faculty}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">
                                            <div className="truncate text-sm" title={t.department}>{t.department || '—'}</div>
                                        </td>
                                        <td className="align-middle text-right">{t.classesCount ?? '—'}</td>
                                        <td className="align-middle text-right">{Number.isFinite(+t.yearsExperience) ? `${t.yearsExperience} yrs` : '—'}</td>
                                        <td className="align-middle whitespace-nowrap">
                                            <span title={new Date(t.lastActivity || 0).toLocaleString()}>{fmtAgo(t.lastActivity)}</span>
                                        </td>
                                        <td className="align-middle">
                                            <RowActions
                                                t={t}
                                                onOpenProfile={onOpenProfile}
                                                onMessage={onMessage}
                                                onEditProfile={onEditProfile}
                                                onDelete={onDelete}
                                                canMessage={canMessage}
                                                canEdit={canEdit}
                                                canDelete={canDelete}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="hidden lg:block 2xl:hidden xl:hidden">
                <div className="overflow-x-auto"></div>
            </div>

            <div className="hidden lg:block xl:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed min-w-[860px]">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="text-left *:[padding:0.6rem] *:px-3">
                            <th className="w-12 align-middle">
                  <span data-stop-row="1">
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={(e) => onSelectAll?.(!!e?.target?.checked)}
                        disabled={noRows}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[180px]">
                                <SortBtn id="name" label="Name" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle min-w-[150px]">
                                <SortBtn id="department" label="Department" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle text-right w-[90px]">
                                <SortBtn id="classesCount" label="Load" {...{ sortField, sortDir, onSort }} className="w-full justify-end" />
                            </th>
                            <th className="align-middle text-center w-28">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    No faculty found.
                                </td>
                            </tr>
                        ) : (
                            data.map((t) => {
                                const isChecked = selected.includes(t.id);
                                return (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.6rem] *:px-3"
                                        onClick={(e) => onRowClick(e, t)}
                                        onKeyDown={(e) => onRowKey(e, t)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1">
                          <Checkbox checked={isChecked} onChange={(e) => onSelect?.(t.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle min-w-[180px]">
                                            <CellName t={t} />
                                        </td>
                                        <td className="align-middle">
                                            <div className="truncate">{t.department || '—'}</div>
                                        </td>
                                        <td className="align-middle text-right">{t.classesCount ?? '—'}</td>
                                        <td className="align-middle">
                                            <RowActions
                                                t={t}
                                                onOpenProfile={onOpenProfile}
                                                onMessage={onMessage}
                                                onEditProfile={onEditProfile}
                                                onDelete={onDelete}
                                                tight
                                                canMessage={canMessage}
                                                canEdit={canEdit}
                                                canDelete={canDelete}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="hidden md:block lg:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed min-w-[760px]">
                        <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                        <tr className="text-left *:[padding:0.55rem] *:px-2 md:text-sm text-xs">
                            <th className="w-10 md:w-12 align-middle">
                  <span data-stop-row="1">
                    <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={!allOnPageSelected && someOnPageSelected}
                        aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                        onChange={(e) => onSelectAll?.(!!e?.target?.checked)}
                        disabled={noRows}
                    />
                  </span>
                            </th>
                            <th className="align-middle min-w-[160px]">
                                <SortBtn id="name" label="Name" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle min-w-[140px]">
                                <SortBtn id="department" label="Department" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle w-[100px]">
                                <SortBtn id="lastActivity" label="Last" {...{ sortField, sortDir, onSort }} />
                            </th>
                            <th className="align-middle text-center w-[96px] md:w-28">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                        {noRows ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    No faculty found.
                                </td>
                            </tr>
                        ) : (
                            data.map((t) => {
                                const isChecked = selected.includes(t.id);
                                return (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-muted/30 transition-colors cursor-pointer *:[padding:0.55rem] *:px-2 md:text-sm text-xs"
                                        onClick={(e) => onRowClick(e, t)}
                                        onKeyDown={(e) => onRowKey(e, t)}
                                        tabIndex={0}
                                    >
                                        <td className="align-middle">
                        <span data-stop-row="1">
                          <Checkbox checked={isChecked} onChange={(e) => onSelect?.(t.id, !!e?.target?.checked)} aria-label="Select row" />
                        </span>
                                        </td>
                                        <td className="align-middle min-w-[160px]">
                                            <CellName t={t} />
                                        </td>
                                        <td className="align-middle">
                                            <div className="truncate">{t.department || '—'}</div>
                                        </td>
                                        <td className="align-middle whitespace-nowrap text-xs sm:text-sm text-muted-foreground max-w-[110px] overflow-hidden text-ellipsis pr-1">
                                            {fmtAgo(t.lastActivity)}
                                        </td>
                                        <td className="align-middle">
                                            <RowActions
                                                t={t}
                                                onOpenProfile={onOpenProfile}
                                                onMessage={onMessage}
                                                onEditProfile={onEditProfile}
                                                onDelete={onDelete}
                                                tight
                                                canMessage={canMessage}
                                                canEdit={canEdit}
                                                canDelete={canDelete}
                                            />
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
                    <div className="text-xs text-muted-foreground">Showing {data.length} {data.length === 1 ? 'result' : 'results'}</div>
                    <span className="inline-flex items-center gap-2 text-xs" data-stop-row="1">
            <Checkbox
                checked={allOnPageSelected}
                indeterminate={!allOnPageSelected && someOnPageSelected}
                aria-checked={allOnPageSelected ? 'true' : !allOnPageSelected && someOnPageSelected ? 'mixed' : 'false'}
                onChange={(e) => onSelectAll?.(!!e?.target?.checked)}
                disabled={noRows}
            />
            Select all
          </span>
                </div>

                {noRows && <div className="px-1 py-6 text-center text-muted-foreground">No faculty found.</div>}

                <div className="grid grid-cols-1 gap-3">
                    {data.map((t) => {
                        const isChecked = selected.includes(t.id);
                        const isYou = /Ing\.?\s*Marek\s*Horv[aá]th/i.test(String(t?.name || ''));
                        return (
                            <MobileCard
                                key={t.id}
                                t={t}
                                checked={isChecked}
                                onToggle={(v) => onSelect?.(t.id, v)}
                                onOpenProfile={onOpenProfile}
                                onMessage={onMessage}
                                onDelete={onDelete}
                                isYou={isYou}
                                canMessage={canMessage}
                                canDelete={canDelete}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="sticky bottom-0 h-0 pointer-events-none">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
        </div>
    );
};

export default FacultyTable;

function CellName({ t, isYou }) {
    return (
        <div className="flex items-center gap-3 min-w-0">
            <Avatar name={t.name || ''} email={t.email || ''} src={t.avatarUrl || null} size={40} rounded className="ring-1 ring-border flex-shrink-0" />
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    <span className="truncate">{t.name || '—'}</span>
                    {isYou && <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] border border-primary/30">you</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{t.email}</p>
            </div>
        </div>
    );
}

function RowActions({ t, onOpenProfile, onMessage, onDelete, tight = false, canMessage = true, canDelete = false }) {
    return (
        <div
            className={`flex items-center justify-center ${tight ? 'gap-1' : 'gap-1.5'} flex-wrap`}
            data-stop-row="1"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <Button size="icon" variant="ghost" className="w-8 h-8 sm:w-9 sm:h-9" onClick={() => onOpenProfile?.(t)} title="Profile" aria-label="Profile">
                <Icon name="User" size={14} />
            </Button>
            {canMessage && (
                <Button size="icon" variant="ghost" className="w-8 h-8 sm:w-9 sm:h-9" onClick={() => onMessage?.(t)} title="Message" aria-label="Message">
                    <Icon name="MessageSquare" size={14} />
                </Button>
            )}
            {canDelete && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="w-8 h-8 sm:w-9 sm:h-9"
                    onClick={() => {
                        if (window.confirm('Delete this teacher? This cannot be undone.')) onDelete?.(t);
                    }}
                    title="Delete"
                    aria-label="Delete"
                >
                    <Icon name="Trash2" size={14} />
                </Button>
            )}
        </div>
    );
}