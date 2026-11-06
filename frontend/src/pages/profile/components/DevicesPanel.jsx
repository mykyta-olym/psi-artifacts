import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const DevicesPanel = ({ devices, timeAgo, signOutAllDevices, signOutDevice }) => {
    return (
        <section className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Devices & Sessions</h3>
                {devices.length > 0 && (
                    <Button size="sm" variant="ghost" iconName="LogOut" onClick={signOutAllDevices}>
                        Sign out all
                    </Button>
                )}
            </div>
            {devices.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active sessions.</div>
            ) : (
                <ul className="space-y-2">
                    {devices.map(d => (
                        <li key={d.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                                    <Icon name={d.icon} size={16} className="text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium">{d.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {d.location} • Last active {timeAgo(d.lastActive)}
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" iconName="X" onClick={() => signOutDevice(d.id)} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default DevicesPanel;