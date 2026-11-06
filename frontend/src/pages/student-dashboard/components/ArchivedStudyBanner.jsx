// src/pages/student-dashboard/components/ArchivedStudyBanner.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

export default function ArchivedStudyBanner({ onOpenSelection }) {
    return (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
            <div className="flex items-start gap-4 p-4 md:p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                    <Icon name="Archive" size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">This study is archived</div>
                    <p className="text-sm text-muted-foreground mt-1">There’s currently no up-to-date information to display.</p>
                    <div className="mt-3">
                        <Button size="sm" iconName="GraduationCap" onClick={onOpenSelection}>
                            Open Study Selection
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}