import React from 'react';
import Icon from '../../../components/AppIcon';

const EmptyState = ({ icon = 'Inbox', title = 'Nothing here', subtitle = '' }) => {
    return (
        <div className="py-12 text-center">
            <Icon name={icon} size={48} className="text-muted-foreground mx-auto mb-2" />
            <div className="text-foreground/90">{title}</div>
            {!!subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
        </div>
    );
};

export default EmptyState;