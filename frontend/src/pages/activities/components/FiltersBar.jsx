// src/pages/activities/components/FiltersBar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';

const todayISO = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};
const addDaysISO = (iso, delta) => {
    const [y, m, d] = (iso || todayISO()).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
};
const monthStartISO = (dateISO) => {
    const [y, m] = (dateISO || todayISO()).split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-01`;
};
const monthEndISO = (dateISO) => {
    const [y, m] = (dateISO || todayISO()).split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
};

const QuickChip = ({ active, onClick, children, icon }) => (
    <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border transition text-xs ${
            active
                ? 'border-primary/40 bg-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'border-border/60 bg-muted text-muted-foreground hover:text-foreground hover:border-border'
        }`}
        iconName={icon}
        iconPosition="left"
    >
        {children}
    </Button>
);

const FiltersBar = ({
                        types, sorts,
                        qDraft, setQDraft,
                        userSearchDraft, setUserSearchDraft,
                        type, setType,
                        sort, setSort,
                        dir, setDir,
                        from, setFrom,
                        to, setTo,
                        requiresAction, setRequiresAction,
                        hasActive, onClear,
                    }) => {
    const [err, setErr] = useState('');

    useEffect(() => {
        if (from && to && from > to) {
            setErr('“From” не може бути пізніше за “To”. Діапазон скориговано.');
            setTo(from);
        } else {
            setErr('');
        }
    }, [from, to, setTo]);

    const rangeId = useMemo(() => {
        if (!from && !to) return 'all';
        const t = todayISO();
        if (from === t && to === t) return 'today';
        if (from === addDaysISO(t, -6) && to === t) return '7d';
        if (from === addDaysISO(t, -29) && to === t) return '30d';
        if (from === monthStartISO(t) && to === monthEndISO(t)) return 'month';
        return '';
    }, [from, to]);

    const setRange = (key) => {
        const t = todayISO();
        switch (key) {
            case 'today': setFrom(t); setTo(t); break;
            case '7d': setFrom(addDaysISO(t, -6)); setTo(t); break;
            case '30d': setFrom(addDaysISO(t, -29)); setTo(t); break;
            case 'month': setFrom(monthStartISO(t)); setTo(monthEndISO(t)); break;
            case 'all':
            default: setFrom(''); setTo(''); break;
        }
    };

    const onChangeFrom = (v) => {
        if (to && v && v > to) setTo(v);
        setFrom(v);
    };
    const onChangeTo = (v) => {
        if (from && v && v < from) setFrom(v);
        setTo(v);
    };

    return (
        <section className="mt-6">
            <div className="space-y-4">
                <div className="grid grid-cols-1 xl:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] gap-3">
                    <div className="xl:pt-6">
                        <Input
                            type="search"
                            label="Search"
                            placeholder="Search title, description, student, subject…"
                            value={qDraft}
                            onChange={(e) => setQDraft(e.target.value)}
                            className="w-full"
                            leadingIcon="Search"
                        />
                    </div>
                    
                    <div className="xl:pt-6">
                        <Input
                            type="search"
                            label="Filter by User"
                            placeholder="Email address (student or teacher)…"
                            value={userSearchDraft}
                            onChange={(e) => setUserSearchDraft(e.target.value)}
                            className="w-full"
                            leadingIcon="User"
                        />
                    </div>

                    <div className="flex items-start xl:items-end gap-2 justify-stretch xl:justify-end flex-wrap">
                        <Select
                            value={type}
                            onChange={(v)=> setType(v)}
                            options={types}
                            className="min-w-[150px]"
                            label="Type"
                        />
                        <Select
                            value={sort}
                            onChange={setSort}
                            options={sorts}
                            className="min-w-[140px]"
                            label="Sort by"
                        />
                        <Select
                            value={dir}
                            onChange={setDir}
                            options={[{ value: 'asc', label: 'Asc' }, { value: 'desc', label: 'Desc' }]}
                            className="min-w-[110px]"
                            label="Order"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-end">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-3 gap-y-2 md:order-1 md:col-span-2 xl:col-span-1">
                        <div className="min-w-0">
                            <Input
                                type="date"
                                value={from || ''}
                                onChange={(e) => onChangeFrom(e.target.value)}
                                label="From"
                                max={to || undefined}
                                className="w-full min-w-0"
                            />
                        </div>
                        <div className="min-w-0">
                            <Input
                                type="date"
                                value={to || ''}
                                onChange={(e) => onChangeTo(e.target.value)}
                                label="To"
                                min={from || undefined}
                                className="w-full min-w-0"
                            />
                        </div>
                    </div>

                    <div className="-mx-1 overflow-x-auto md:overflow-visible md:order-2 md:col-span-2 xl:order-none xl:col-span-1">
                        <div className="px-1 inline-flex md:flex md:flex-wrap items-center gap-2">
                            <QuickChip icon="Calendar" active={rangeId==='today'} onClick={()=>setRange('today')}>Today</QuickChip>
                            <QuickChip active={rangeId==='7d'} onClick={()=>setRange('7d')}>Last 7d</QuickChip>
                            <QuickChip active={rangeId==='30d'} onClick={()=>setRange('30d')}>Last 30d</QuickChip>
                            <QuickChip active={rangeId==='month'} onClick={()=>setRange('month')}>This month</QuickChip>
                            <QuickChip icon="X" active={rangeId==='all'} onClick={()=>setRange('all')}>All time</QuickChip>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 justify-start xl:justify-end flex-wrap md:order-3 md:col-span-2 xl:order-none xl:col-span-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRequiresAction(!requiresAction)}
                            className={`h-10 items-center gap-2 px-3 border ${
                                requiresAction
                                    ? 'border-warning/50 bg-warning/15 text-warning shadow-[inset_0_0_0_1px_rgba(234,179,8,0.25)]'
                                    : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                            iconName="AlertTriangle"
                            iconPosition="left"
                            title="Show only items that require your action"
                        >
                            <span className="text-sm">Requires action</span>
                            {requiresAction && <span className="ml-1 status-indicator bg-warning" />}
                        </Button>

                        {hasActive && (
                            <Button
                                variant="ghost"
                                size="sm"
                                iconName="Eraser"
                                onClick={onClear}
                                className="h-10"
                                title="Clear all filters"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {!!err && (
                    <div className="text-xs text-warning -mt-2" role="status" aria-live="polite">
                        {err}
                    </div>
                )}
            </div>
        </section>
    );
};

export default FiltersBar;