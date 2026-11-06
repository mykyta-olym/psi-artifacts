// src/pages/student-dashboard/components/WelcomeHeader.jsx
import React from 'react';
import Button from '../../../components/ui/Button';

export default function WelcomeHeader({ fullName, subtitle, currentTime, onViewSchedule }) {
    return (
        <section className="mb-6" aria-labelledby="welcome-title">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 id="welcome-title" className="text-2xl font-bold text-foreground mb-1 truncate">
                            Welcome back, {fullName}
                        </h1>
                    </div>
                    <p className="text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                            {currentTime?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {currentTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <Button variant="outline" iconName="Calendar" onClick={onViewSchedule}>
                        View Schedule
                    </Button>
                </div>
            </div>
        </section>
    );
}