// src/pages/final-thesis/components/SearchSection.jsx
import React, { useMemo } from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Pill from './Pill';
import { useAuth } from '../../../contexts/AuthContext';

export default function SearchSection({
    filters,
    setFilters,
    page,
    setPage,
    perPage,
    setPerPage,
    totalPages,
    data,
    isBookmarked,
    onToggleBookmark,
    onRequestTopic,
    filterOptions = {},
    onResetFilters = () => {}
}) {
    const { user } = useAuth() || {};
    const set = (k, v) => setFilters((prev) => ({ ...prev, [k]: v }));
    const pageNumbers = useMemo(() => {
        const span = 5;
        const half = Math.floor(span / 2);
        let start = Math.max(1, page - half);
        let end = Math.min(totalPages, start + span - 1);
        if (end - start + 1 < span) start = Math.max(1, end - span + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [page, totalPages]);

    const { years = [], faculties = [], departments = [], programs = [] } = filterOptions || {};
    const yearOptions = useMemo(
        () => [{ value: '', label: 'All years' }, ...years.map((y) => ({ value: y, label: y }))],
        [years]
    );
    const facultyOptions = useMemo(
        () => [{ value: 'all', label: 'All faculties' }, ...faculties.map((f) => ({ value: f, label: f }))],
        [faculties]
    );
    const departmentOptions = useMemo(
        () => [{ value: 'all', label: 'All departments' }, ...departments.map((d) => ({ value: d, label: d }))],
        [departments]
    );
    const normalizedPrograms = programs.map((p) => (typeof p === 'string' ? { value: p, label: p } : p));
    const programOptions = useMemo(
        () => [{ value: 'all', label: 'All programs' }, ...normalizedPrograms],
        [normalizedPrograms]
    );

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="space-y-3 xl:sticky xl:top-20 self-start">
                <div className="bg-card glass-card rounded-lg border border-border p-3 z-stack of-visible">
                    <div className="grid grid-cols-1 gap-3">
                        <Input label="Search" placeholder="Title, keywords, teacher…" value={filters.q} onChange={(e) => set('q', e.target.value)} />
                        <Select
                            label="Faculty"
                            options={facultyOptions}
                            value={filters.faculty || 'all'}
                            onChange={(v) => set('faculty', typeof v === 'string' ? v : v?.value)}
                        />
                        <Select
                            label="Department"
                            options={departmentOptions}
                            value={filters.department || 'all'}
                            onChange={(v) => set('department', typeof v === 'string' ? v : v?.value)}
                        />
                        <Select
                            label="State"
                            options={[{ value: 'all', label: 'All' }, { value: 'unassigned', label: 'Unassigned' }, { value: 'assigned', label: 'Assigned' }]}
                            value={filters.state}
                            onChange={(v) => set('state', typeof v === 'string' ? v : v?.value)}
                        />
                        <Select
                            label="Sort by"
                            options={[
                                { value: 'newest', label: 'Newest' },
                                { value: 'oldest', label: 'Oldest' },
                                { value: 'title', label: 'Title' },
                                { value: 'supervisor', label: 'Supervisor' }
                            ]}
                            value={filters.sort}
                            onChange={(v) => set('sort', typeof v === 'string' ? v : v?.value)}
                        />
                        <div className="flex items-center justify-between gap-2">
                            <Button type="button" variant="outline" iconName="RefreshCw" onClick={onResetFilters}>Reset</Button>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Per page</span>
                                <Select
                                    value={String(perPage)}
                                    options={[{ value: '6', label: '6' }, { value: '8', label: '8' }, { value: '12', label: '12' }, { value: '16', label: '16' }]}
                                    onChange={(v) => setPerPage(parseInt(typeof v === 'string' ? v : v?.value, 10) || 8)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="xl:col-span-2 space-y-4">
                {!data.length ? (
                    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No assignments match your filters.</div>
                ) : (
                    data.map((a) => (
                        <article key={String(a.id)} className="bg-card glass-card rounded-lg border border-border p-4 hover-lift">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-semibold text-foreground">{a.title}</h3>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <Pill>{a.type}</Pill>
                                        <span>{a.programLabel}</span>
                                        <span>{a.academicYear}</span>
                                        <span>Supervisor: {a.supervisor?.name}</span>
                                        {a.faculty && <span>• {a.faculty}</span>}
                                        {a.department && <span>• {a.department}</span>}
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <Pill intent={a.state === 'unassigned' ? 'green' : 'amber'}>{a.state.toUpperCase()}</Pill>
                                </div>
                            </div>
                            <p className="text-sm mt-3">{a.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {(a.keywords || []).map((k, i) => <Pill key={String(i)} intent="gray">{k}</Pill>)}
                            </div>
                            <div className="mt-4 btn-group">
                                <Button type="button" size="sm" iconName="Clipboard" onClick={() => onRequestTopic(a)} disabled={a.state !== 'unassigned'}>
                                    {a.state === 'unassigned' ? 'Request this topic' : 'Already assigned'}
                                </Button>
                                <Button type="button" size="sm" variant={isBookmarked(a.id) ? 'default' : 'outline'} iconName={isBookmarked(a.id) ? 'BookmarkCheck' : 'Bookmark'} onClick={() => onToggleBookmark(a.id)}>
                                    {isBookmarked(a.id) ? 'Bookmarked' : 'Bookmark'}
                                </Button>
                            </div>
                        </article>
                    ))
                )}

                {totalPages > 1 && (
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card rounded-lg border border-border p-3 sm:p-4">
                        <div className="order-2 lg:order-1 text-sm text-muted-foreground min-w-0">
                            Page {page} / {totalPages}
                        </div>
                        <div className="order-1 lg:order-2 w-full lg:w-auto flex items-center justify-between lg:justify-end gap-2 min-w-0">
                            <Button type="button" variant="outline" size="sm" iconName="ChevronsLeft" onClick={() => setPage(1)} disabled={page === 1} className="shrink-0">First</Button>
                            <Button type="button" variant="outline" size="sm" iconName="ChevronLeft" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="shrink-0">Prev</Button>
                            <div className="hidden lg:flex items-center gap-1 max-w-[420px] overflow-x-auto thin-scrollbar">
                                {pageNumbers.map((n) => (
                                    <Button key={String(n)} type="button" variant={page === n ? 'default' : 'outline'} size="sm" onClick={() => setPage(n)} className="w-9 shrink-0">{n}</Button>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" iconName="ChevronRight" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="shrink-0">Next</Button>
                            <Button type="button" variant="outline" size="sm" iconName="ChevronsRight" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="shrink-0">Last</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}