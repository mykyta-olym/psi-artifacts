// src/components/ui/StatusBadge.jsx
import React from 'react';

const map = {
    active:      { label: 'Active',      cls: 'bg-success text-success-foreground' },
    'on-leave':  { label: 'On leave',    cls: 'bg-warning text-warning-foreground' },
    inactive:    { label: 'Inactive',    cls: 'bg-muted text-muted-foreground' },
    substitute:  { label: 'Substitute',  cls: 'bg-primary text-primary-foreground' },
};

const StatusBadge = ({ status='inactive' }) => {
    const cfg = map[status] || map.inactive;
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
    );
};

export default StatusBadge;