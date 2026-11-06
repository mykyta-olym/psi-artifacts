// src/pages/student-dashboard/components/DeadlinesPanel.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

export default function DeadlinesPanel({ deadlines, onOpenAll }) {
    const navigate = useNavigate();
    return (
        <section className="bg-card rounded-lg border border-border p-6" aria-labelledby="deadlines-title">
            <div className="flex items-center justify-between mb-4">
                <h3 id="deadlines-title" className="text-lg font-semibold text-foreground">Upcoming Deadlines</h3>
                {onOpenAll && (
                    <Button variant="ghost" size="sm" iconName="Timer" onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof onOpenAll === 'function') {
                            onOpenAll();
                        } else if (typeof onOpenAll === 'string') {
                            navigate(onOpenAll);
                        }
                    }}>View All</Button>
                )}
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto thin-scrollbar">
                {deadlines.map((d) => (
                    <div key={d.id} className="flex items-start gap-3 p-3 rounded-md bg-muted">
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0">
                            <Icon name="Clock" size={14} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                                <h4 className="text-sm font-medium text-foreground truncate">{d.title}</h4>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{d.dueStr}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{d.course}</p>
                            {d.href && (
                                <div className="mt-2">
                                    <Button variant="outline" size="xs" onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (d.href) navigate(d.href);
                                    }}>Open</Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {deadlines.length === 0 && (
                    <div className="text-center py-8">
                        <Icon name="Calendar" size={48} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No upcoming deadlines.</p>
                    </div>
                )}
            </div>
        </section>
    );
}