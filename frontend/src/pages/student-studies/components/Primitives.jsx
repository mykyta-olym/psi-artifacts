// src/pages/student-studies/components/Primitives.jsx
import React from 'react';

export function UL({ children, className = '' }) {
    return <ul className={`styled-ul list-disc list-outside pl-4 space-y-1 text-sm text-muted-foreground marker:text-[var(--color-primary-300)] ${className}`}>{children}</ul>;
}

export function ScrollX({ children, className = '' }) {
    return <div className={`overflow-x-auto thin-scrollbar ${className}`}>{children}</div>;
}

export function ScrollY({ children, className = '' }) {
    return <div className={`overflow-y-auto thin-scrollbar ${className}`}>{children}</div>;
}