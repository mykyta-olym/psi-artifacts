// src/pages/final-thesis/FinalThesisTeacherParts/ui.jsx
import React, { useEffect, useRef } from 'react';
import Textarea from '../../../components/ui/Textarea';
import { cx } from '../utils/utils';

export const Pill = ({ children, intent='primary' }) => {
    const map = {
        primary: 'bg-primary/10 border-primary/30 text-primary-100',
        green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100',
        amber: 'bg-amber-500/10 border-amber-500/30 text-amber-100',
        red: 'bg-red-500/10 border-red-500/30 text-red-100',
        gray: 'bg-muted border-border text-muted-foreground'
    };
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[intent] || map.primary}`}>{children}</span>;
};

export const Metric = ({ label, value, sub }) => (
    <div className="bg-card glass-card rounded-lg border border-border p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </div>
);

export const TextArea = ({ id, label, value, onChange, placeholder, maxLength, rows = 4, disabled, className = '', invalid = false, helper }) => {
    const ref = useRef(null);
    const v = String(value || '');
    useEffect(() => {
        if (!ref.current) return;
        ref.current.style.height = 'auto';
        ref.current.style.height = Math.min(ref.current.scrollHeight, 480) + 'px';
    }, [v]);
    const count = typeof maxLength === 'number' ? `${v.length}/${maxLength}` : null;
    return (
        <div className={cx('w-full', className)}>
            {label ? <label htmlFor={id} className="field-label">{label}</label> : null}
            <div className="relative">
                <Textarea
                    id={id}
                    ref={ref}
                    minRows={rows}
                    maxLength={maxLength}
                    value={v}
                    onChange={(e) => {
                        if (typeof maxLength === 'number' && e.target.value.length > maxLength) return;
                        onChange?.(e);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    textareaClassName={cx('pr-14', invalid && 'ring-1 ring-error/40')}
                />
                {count && <span className={cx('absolute bottom-2 right-2 text-[11px]', invalid ? 'helper-error' : 'text-muted-foreground')}>{count}</span>}
            </div>
            {helper ? <div className={cx('mt-1 helper', invalid && 'helper-error')}>{helper}</div> : null}
        </div>
    );
};

export const ChipsPreview = ({ items }) => (
    <div className="mt-1 flex flex-wrap gap-1">
        {(items || []).filter(Boolean).map((k, i) => (
            <span key={`${k}-${i}`} className="px-2 py-0.5 rounded-full text-[11px] border border-border text-muted-foreground bg-muted">{k}</span>
        ))}
    </div>
);