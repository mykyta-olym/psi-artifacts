// src/pages/print-reports/components/SectionCard.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';

const SectionCard = ({
    title,
    description,
    action,
    iconName = 'FileText',
    children,
    contentClassName = 'space-y-4'
}) => {
    return (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-3 mb-3 justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Icon name={iconName} size={18} className="text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    </div>
                    {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                </div>
                {action && <div className="flex-none">{action}</div>}
            </div>
            <div className={contentClassName}>{children}</div>
        </section>
    );
};

export default SectionCard;