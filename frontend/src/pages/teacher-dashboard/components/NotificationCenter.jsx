// src/pages/notifications/NotificationCenter.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { timeAgo } from '../../../utils/utils';

const tabs = [
  { id: 'all',            label: 'All',            icon: 'Bell' },
  { id: 'messages',       label: 'Messages',       icon: 'MessageSquare' },
  { id: 'announcements',  label: 'Announcements',  icon: 'Megaphone' },
  { id: 'alerts',         label: 'Alerts',         icon: 'AlertTriangle' }
];

const normalizeCategory = (n) => {
  const c = String(n?.category || n?.type || '').toLowerCase();
  if (['messages','announcements','alerts','attendance','grades'].includes(c)) return c;
  return 'alerts';
};

const NotificationCenter = () => {
  const { notifications, markRead, markUnread, clearAll } = useNotifications();
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  const unreadCount = useMemo(() => notifications.filter(n => n?.unread).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter(n => normalizeCategory(n) === activeTab);
  }, [notifications, activeTab]);

  const filteredUnreadCount = useMemo(
      () => filteredNotifications.filter(n => n?.unread).length,
      [filteredNotifications]
  );

  const getNotificationIcon = (n) => {
    const type = normalizeCategory(n);
    switch (type) {
      case 'messages':      return 'MessageSquare';
      case 'announcements': return 'Megaphone';
      case 'alerts':        return 'AlertTriangle';
      case 'attendance':    return 'CheckSquare';
      case 'grades':        return 'BookOpen';
      default:              return 'Bell';
    }
  };

  const getNotificationColor = (n) => {
    const priority = n?.priority;
    if (priority === 'high')   return 'text-error';
    if (priority === 'medium') return 'text-warning';
    const type = normalizeCategory(n);
    switch (type) {
      case 'messages':      return 'text-primary';
      case 'announcements': return 'text-accent';
      case 'alerts':        return 'text-error';
      default:              return 'text-muted-foreground';
    }
  };

  const goByType = (n) => {
    if (n?.href) return navigate(n.href);
    const type = normalizeCategory(n);
    switch (type) {
      case 'messages':   return navigate('/chat');
      case 'attendance': return navigate('/attendance-tracking');
      case 'grades':     return navigate('/grade-management');
      default:           return;
    }
  };

  const handleNotificationClick = (n) => {
    markRead?.(n.id);
    goByType(n);
  };

  const handleMarkAllFilteredRead = () => {
    filteredNotifications.filter(n => n.unread).forEach(n => markRead?.(n.id));
  };

  return (
      <section className="bg-card rounded-lg border border-border p-6" aria-labelledby="notifications-title">
        <div className="flex items-center justify-between mb-4">
          <h3 id="notifications-title" className="text-lg font-semibold text-foreground">Notifications</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" aria-live="polite">{unreadCount} unread</span>
          </div>
        </div>

        <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1 overflow-x-auto" role="tablist" aria-label="Notification categories">
          {tabs.map(tab => (
              <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none justify-center ${
                      activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Icon name={tab.icon} size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
          ))}
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto" role="list" aria-label="Notifications">
          {filteredNotifications.map((n) => (
              <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-muted ${n?.unread ? 'bg-primary/5 border border-primary/10' : ''}`}
                  role="listitem"
              >
                <div className="flex-shrink-0 mt-1">
                  <Icon name={getNotificationIcon(n)} size={16} className={getNotificationColor(n)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-sm font-medium ${n?.unread ? 'text-foreground' : 'text-muted-foreground'} truncate`}>{n.title}</h4>
                    <div className="flex items-center gap-2">
                      {n?.priority === 'high' && <div className="status-indicator bg-error" title="High priority" />}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(n.time || n.timestamp)}
                  </span>
                    </div>
                  </div>
                  {!!n.message && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.message}</p>}
                  {!!n.actionRequired && (
                      <div className="mt-2">
                        <Button variant="outline" size="xs" onClick={(e) => { e.stopPropagation(); handleNotificationClick(n); }}>
                          {n?.actionText || 'Take Action'}
                        </Button>
                      </div>
                  )}
                </div>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); n.unread ? markRead?.(n.id) : markUnread?.(n.id); }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                    title={n.unread ? 'Mark as read' : 'Mark as unread'}
                    aria-label={n.unread ? 'Mark as read' : 'Mark as unread'}
                >
                  <Icon name={n.unread ? 'Check' : 'Undo2'} size={16} />
                </button>
              </div>
          ))}

          {filteredNotifications.length === 0 && (
              <div className="text-center py-8">
                <Icon name="Bell" size={48} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No notifications</p>
              </div>
          )}
        </div>

        {(filteredUnreadCount > 0 || filteredNotifications.length > 0) && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
              {filteredUnreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="flex-1" onClick={handleMarkAllFilteredRead}>
                    Mark all as read
                  </Button>
              )}
              {filteredNotifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="flex-1" onClick={clearAll}>
                    Clear all
                  </Button>
              )}
            </div>
        )}
      </section>
  );
};

export default NotificationCenter;