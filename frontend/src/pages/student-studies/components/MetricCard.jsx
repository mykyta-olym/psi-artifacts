// src/pages/student-studies/components/MetricCard.jsx
import React from 'react';

export default function MetricCard({ label, value, sub }) {
    return (
        <div className="bg-card glass-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
        </div>
    );
}