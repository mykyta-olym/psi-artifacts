// src/pages/student-studies/components/Badge.jsx
import React from 'react';

export default function Badge({ children, className = '' }) {
    return <span className={`badge inline-flex items-center rounded-full border px-2 py-1 text-xs ${className}`}>{children}</span>;
}