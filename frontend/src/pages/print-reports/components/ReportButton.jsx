// src/pages/print-reports/components/ReportButton.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';

const ReportButton = ({ icon, label, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="group relative isolate overflow-hidden inline-flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border text-sm transition-all duration-200 hover:bg-muted/70 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 pointer-events-none bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <Icon name={icon} size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            <span className="whitespace-nowrap transition-colors duration-200 group-hover:text-foreground">{label}</span>
        </button>
    );
};

export default ReportButton;