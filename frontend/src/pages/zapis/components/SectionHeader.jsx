// src/pages/zapis/components/SectionHeader.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';

const SectionHeader = ({ icon, title, subtitle, right }) => {
    return (
        <div className="glass-card rounded-xl p-4 sm:p-5 mb-4 border border-border">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Icon name={icon} size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
                        {!!subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                    </div>
                </div>
                <div className="w-full xl:w-auto">{right}</div>
            </div>
        </div>
    );
};

export default SectionHeader;