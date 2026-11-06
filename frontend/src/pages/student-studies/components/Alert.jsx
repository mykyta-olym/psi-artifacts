// src/pages/student-studies/components/Alert.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';

const variants = {
    success: { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success', icon: 'CheckCircle2' },
    warning: { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', icon: 'AlertTriangle' },
    error: { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive', icon: 'XCircle' },
    info: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', icon: 'Info' },
};

export default function Alert({ variant = 'info', title, children }) {
    const config = variants[variant] || variants.info;
    return (
        <div className={`rounded-lg border p-3 flex items-start gap-3 ${config.bg} ${config.border}`}>
            <div className={`shrink-0 ${config.text}`}>
                <Icon name={config.icon} size={18} />
            </div>
            <div className="min-w-0">
                {title && <div className={`text-sm font-medium ${config.text}`}>{title}</div>}
                {children && <div className="text-sm text-foreground/80 mt-0.5">{children}</div>}
            </div>
        </div>
    );
}