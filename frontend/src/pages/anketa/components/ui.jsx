// src/pages/anketa/parts/ui.jsx
import React from 'react';
import { cx } from '../utils/utils';

export const Pill = ({ children, intent='primary' }) => {
    const map = {
        primary:'bg-primary/10 border-primary/30 text-primary-100',
        gray:'bg-muted border-border text-muted-foreground',
        green:'bg-emerald-500/10 border-emerald-500/30 text-emerald-100',
        amber:'bg-amber-500/10 border-amber-500/30 text-amber-100',
        red:'bg-red-500/10 border-red-500/30 text-red-100'
    };
    return <span className={cx('inline-flex items-center rounded-full border px-2 py-1 text-xs', map[intent]||map.primary)}>{children}</span>;
};

export const Metric = ({ label, value, sub }) => (
    <div className="bg-card glass-card rounded-lg border border-border p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </div>
);