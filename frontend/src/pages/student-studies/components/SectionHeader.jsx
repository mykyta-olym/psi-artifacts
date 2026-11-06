// src/pages/student-studies/components/SectionHeader.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';

export default function SectionHeader({ icon, title, subtitle, right }) {
    return (
        <div className="bg-card glass-card rounded-lg border border-border p-4 sm:p-5">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0"><Icon name={icon} size={18} className="text-primary" /></div>
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-foreground truncate">{title}</h2>
                        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
                    </div>
                </div>
                {right || null}
            </div>
        </div>
    );
}