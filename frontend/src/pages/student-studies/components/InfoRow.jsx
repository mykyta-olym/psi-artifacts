// src/pages/student-studies/components/InfoRow.jsx
import React from 'react';

export default function InfoRow({ label, value }) {
    return (
        <div className="flex items-center justify-between rounded border border-border px-3 py-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
    );
}