// src/pages/teacher-dashboard/components/RecentActivityPanel.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useNotifications } from '../../../contexts/NotificationsContext';
import { useAuth } from '../../../contexts/AuthContext';

const FILTERS = [
  { id: 'all', label: 'All', icon: 'Activity' },
  { id: 'announcement', label: 'Announcements', icon: 'Megaphone' },
  { id: 'submissions', label: 'Submissions', icon: 'FileText' },
  { id: 'communications', label: 'Messages', icon: 'MessageSquare' },
  { id: 'attendance', label: 'Attendance', icon: 'CheckSquare' }
];

const RecentActivityPanel = ({ activities: activitiesProp = [] }) => {
  const { activityFeed, activitiesLoading, refreshActivities } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  // Use activityFeed from context as primary source, fall back to props if context is empty
  // Don't merge both - that causes duplicates!
  const data = useMemo(() => {
    const contextData = Array.isArray(activityFeed) ? activityFeed : [];
    const propData = Array.isArray(activitiesProp) ? activitiesProp : [];
    
    // If we have data from context, use it (it's the API data)
    // Only use props as fallback if context is empty
    const source = contextData.length > 0 ? contextData : propData;
    
    // Deduplicate by id just in case
    const byId = new Map();
    source.forEach(item => {
      if (!item) return;
      const key = item.id || `${item.type || 'act'}_${item.title || ''}_${item.timestamp || ''}`;
      if (!byId.has(key)) {
        byId.set(key, item);
      }
    });
    
    return Array.from(byId.values()).sort((a, b) => 
      (+new Date(b.timestamp || 0)) - (+new Date(a.timestamp || 0))
    );
  }, [activityFeed, activitiesProp]);

  const filteredActivities = useMemo(
      () => {
        const filtered = data.filter(a => (activeFilter === 'all' ? true : a?.type === activeFilter));
        return filtered.slice(0, 10);
      },
      [data, activeFilter]
  );

  const getIcon = (type) => {
    switch (type) {
      case 'submissions': return 'FileText';
      case 'communications': return 'MessageSquare';
      case 'attendance': return 'CheckSquare';
      case 'grades': return 'BookOpen';
      case 'announcement': return 'Megaphone';
      case 'system': return 'LogIn';
      default: return 'Activity';
    }
  };

  const color = (type) => {
    switch (type) {
      case 'submissions': return 'text-primary';
      case 'communications': return 'text-accent';
      case 'attendance': return 'text-success';
      case 'grades': return 'text-warning';
      case 'announcement': return 'text-secondary';
      case 'system': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const handleActivityClick = (activity) => {
    switch (activity?.type) {
      case 'submissions': return navigate(`/grade-management?assignment=${activity?.assignmentId}`);
      case 'communications': return navigate('/chat');
      case 'attendance': return navigate('/attendance-tracking');
      default: return;
    }
  };

  const formatTimeAgo = (ts) => {
    const now = Date.now();
    const at = +new Date(ts);
    const m = Math.floor((now - at) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const goAll = () => {
    const params = new URLSearchParams();
    if (activeFilter !== 'all') params.set('type', activeFilter);
    params.set('sort', 'time');
    params.set('dir', 'desc');
    navigate(`/activities?${params.toString()}`);
  };

  return (
      <section className="bg-card rounded-lg border border-border p-6" aria-labelledby="recent-activity-title">
        <div className="flex items-center justify-between mb-4">
          <h3 id="recent-activity-title" className="text-lg font-semibold text-foreground">Recent Activity</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            iconName="RefreshCw" 
            onClick={async () => {
              if (refreshActivities) await refreshActivities();
            }}
            loading={activitiesLoading}
            disabled={activitiesLoading}
          >
            Refresh
          </Button>
        </div>

        <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1 overflow-x-auto thin-scrollbar" role="tablist" aria-label="Activity filters">
          {FILTERS.map(f => (
              <button
                  key={f.id}
                  role="tab"
                  aria-selected={activeFilter === f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeFilter === f.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name={f.icon} size={14} />
                <span>{f.label}</span>
              </button>
          ))}
        </div>

        {/* scroll area with custom glass scrollbar */}
        <div className="space-y-3 max-h-80 overflow-y-auto overscroll-contain thin-scrollbar pr-1" role="list" aria-label="Recent activity">
          {filteredActivities.map((a) => (
              <div
                  key={a?.id}
                  onClick={() => handleActivityClick(a)}
                  className="flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors hover:bg-muted"
                  role="listitem"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Icon name={getIcon(a?.type)} size={14} className={color(a?.type)} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-foreground truncate">{a?.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a?.description}</p>
                      {a?.studentName && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <Icon name="User" size={10} color="white" />
                            </div>
                            <span className="text-xs text-muted-foreground">{a?.studentName}</span>
                          </div>
                      )}
                      {(a?.authorName || a?.authorRole) && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center">
                              <Icon name="UserCircle" size={10} />
                            </div>
                            <span className="text-xs text-muted-foreground">{[a?.authorName, a?.authorRole].filter(Boolean).join(' • ')}</span>
                          </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end ml-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTimeAgo(a?.timestamp)}</span>
                      {a?.requiresAction && <div className="mt-1 status-indicator bg-warning" title="Needs action" />}
                    </div>
                  </div>
                </div>
              </div>
          ))}
          {filteredActivities.length === 0 && (
              <div className="text-center py-8">
                <Icon name="Activity" size={48} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full" onClick={goAll}>
            View All Activities
          </Button>
        </div>
      </section>
  );
};

export default RecentActivityPanel;