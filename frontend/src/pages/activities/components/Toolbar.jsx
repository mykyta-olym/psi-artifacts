import React from 'react';
import Button from '../../../components/ui/Button';

const Toolbar = ({ stats, mode, setMode, onExportAll }) => {
    const toggleClasses = (isActive) =>
        isActive
            ? 'bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5';

    return (
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Activities</h1>
                <p className="text-sm text-muted-foreground">
                    {stats.total} results • {stats.needAction} need action
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1 border border-border/60">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMode('list')}
                        className={`px-3 py-1.5 rounded-md transition-colors ${toggleClasses(mode === 'list')}`}
                        iconName="List"
                        iconPosition="left"
                    >
                        List
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMode('timeline')}
                        className={`px-3 py-1.5 rounded-md transition-colors ${toggleClasses(mode === 'timeline')}`}
                        iconName="Timer"
                        iconPosition="left"
                    >
                        Timeline
                    </Button>
                </div>

                <Button variant="outline" size="sm" iconName="Download" onClick={onExportAll}>Export CSV</Button>
            </div>
        </div>
    );
};

export default Toolbar;