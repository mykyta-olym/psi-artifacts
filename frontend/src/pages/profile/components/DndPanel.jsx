import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DndPanel = ({ dndActive, dndUntil, applyDndFor, applyDndUntilTomorrow, clearDnd }) => {
    return (
        <section className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Focus / Do Not Disturb</h3>
                <Icon name="BellOff" size={18} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => applyDndFor(30)}>30 min</Button>
                <Button variant="outline" onClick={() => applyDndFor(60)}>1 hour</Button>
                <Button variant="outline" onClick={() => applyDndFor(120)}>2 hours</Button>
                <Button variant="outline" onClick={applyDndUntilTomorrow}>Until 08:00</Button>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                    {dndActive ? `DND until ${new Date(dndUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'DND is off'}
                </div>
                {dndActive ? (
                    <Button size="sm" variant="ghost" onClick={clearDnd}>Turn off</Button>
                ) : null}
            </div>
        </section>
    );
};

export default DndPanel;