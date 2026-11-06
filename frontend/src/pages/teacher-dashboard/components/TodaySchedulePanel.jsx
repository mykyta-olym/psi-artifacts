// src/pages/teacher-dashboard/components/TodaySchedulePanel.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const TodaySchedulePanel = ({ scheduleData = [] }) => {
  const navigate = useNavigate();

  const handleViewFullSchedule = () => {
    navigate('/class-schedule-management?view=teacher');
  };

  const nowMins = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const enrich = (slot) => {
    const [sH, sM] = String(slot?.startTime || '0:0').split(':').map(Number);
    const [eH, eM] = String(slot?.endTime   || '0:0').split(':').map(Number);
    const s = (sH || 0) * 60 + (sM || 0);
    const e = (eH || 0) * 60 + (eM || 0);
    const status = nowMins >= s && nowMins <= e ? 'current' : (nowMins < s ? 'upcoming' : 'completed');
    return { ...slot, _s: s, _e: e, _status: status };
  };

  const enriched = useMemo(
      () => scheduleData.map(enrich).sort((a,b)=>a._s - b._s),
      [scheduleData, nowMins]
  );

  const currentClass = useMemo(() => enriched.find(s => s._status === 'current'), [enriched]);
  const nextClass    = useMemo(() => enriched.find(s => s._status === 'upcoming'), [enriched]);

  const statusBadge = (st) => st === 'current'
      ? 'bg-success text-success-foreground'
      : (st === 'upcoming' ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground');

  return (
      <section
          className="bg-card rounded-lg border border-border p-6 overflow-hidden paint-contain no-gutter-shift"
          aria-labelledby="today-schedule-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="today-schedule-title" className="text-lg font-semibold text-foreground">Today's Schedule</h3>
          <Button variant="ghost" size="sm" iconName="Calendar" onClick={handleViewFullSchedule}>View Full</Button>
        </div>

        {(currentClass || nextClass) && (
            <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/10">
              {currentClass ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="status-indicator bg-success" />
                      <span className="text-sm font-medium text-success">Currently Teaching</span>
                    </div>
                    <h4 className="font-semibold text-foreground">{currentClass.subject}</h4>
                    <p className="text-sm text-muted-foreground">
                      {currentClass.startTime} - {currentClass.endTime} • {currentClass.room}
                    </p>
                  </div>
              ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="status-indicator bg-warning" />
                      <span className="text-sm font-medium text-warning">Next Class</span>
                    </div>
                    <h4 className="font-semibold text-foreground">{nextClass.subject}</h4>
                    <p className="text-sm text-muted-foreground">
                      {nextClass.startTime} - {nextClass.endTime} • {nextClass.room}
                    </p>
                  </div>
              )}
            </div>
        )}

        <div
            className="space-y-3 max-h-80 overflow-y-auto thin-scrollbar"
            role="list"
            aria-label="Lessons timeline"
            style={{ overscrollBehavior: 'contain' }}
        >
          {enriched.map((slot, i) => (
              <div
                  key={`${slot.subject}|${slot.startTime}|${i}`}
                  className={`flex items-center gap-4 p-3 rounded-md transition-colors
              ${slot._status==='current' ? 'bg-success/10 border border-success/20' :
                      slot._status==='upcoming' ? 'bg-muted hover:bg-muted/80' : 'bg-muted/50 opacity-75'}`}
                  role="listitem"
              >
                <div className="flex-shrink-0 text-center w-20">
                  <div className="text-sm font-medium text-foreground">{slot.startTime}</div>
                  <div className="text-xs text-muted-foreground">{slot.endTime}</div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{slot.subject}</h4>
                  <p className="text-sm text-muted-foreground">
                    {slot.grade && slot.grade.match(/^\d{1,2}-sk$/i) ? slot.grade.toUpperCase() : `Grade ${slot.grade}`} • {slot.room}
                  </p>
                </div>

                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(slot._status)}`}>
              {slot._status === 'current' ? 'Now' : (slot._status === 'upcoming' ? 'Upcoming' : 'Done')}
            </span>
              </div>
          ))}

          {enriched.length === 0 && (
              <div className="text-center py-8">
                <Icon name="Calendar" size={48} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No classes scheduled.</p>
              </div>
          )}
        </div>
      </section>
  );
};

export default TodaySchedulePanel;