// src/pages/final-thesis/components/Pill.jsx
import React from 'react';

export default function Pill({ children, intent = 'primary' }) {
    const map = {
        primary: 'bg-primary/10 border-primary/30 text-primary-100',
        green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100',
        amber: 'bg-amber-500/10 border-amber-500/30 text-amber-100',
        red: 'bg-red-500/10 border-red-500/30 text-red-100',
        gray: 'bg-muted border-border text-muted-foreground'
    };
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[intent] || map.primary}`}>
      {children}
    </span>
    );
}