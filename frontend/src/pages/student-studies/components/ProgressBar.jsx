// src/pages/student-studies/components/ProgressBar.jsx
import React from 'react';

export default function ProgressBar({ value }) {
    return (
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, Math.round(value)))}%` }} />
        </div>
    );
}