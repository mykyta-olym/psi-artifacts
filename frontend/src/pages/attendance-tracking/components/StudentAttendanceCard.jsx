import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Avatar from '../../../components/ui/Avatar';

const StudentAttendanceCard = ({
                                 student,
                                 onAttendanceChange,
                                 isEditable = true,
                                 showHistory = false
                               }) => {
  const [showDetails, setShowDetails] = useState(false);

  const attendanceOptions = [
    { value: 'present', label: 'Present', icon: 'CheckCircle', color: 'text-success' },
    { value: 'absent',  label: 'Absent',  icon: 'XCircle',    color: 'text-destructive' },
    { value: 'late',    label: 'Late',    icon: 'Clock',      color: 'text-warning' },
    { value: 'excused', label: 'Excused', icon: 'Shield',     color: 'text-secondary' }
  ];

  const getAttendanceColor = (status) =>
      attendanceOptions.find(o => o.value === status)?.color || 'text-muted-foreground';
  const getAttendanceIcon  = (status) =>
      attendanceOptions.find(o => o.value === status)?.icon  || 'Circle';

  const handleStatusChange = (newStatus) => {
    if (isEditable && onAttendanceChange) onAttendanceChange(student?.id, newStatus);
  };

  return (
      <div className="bg-card rounded-lg border border-border p-3 sm:p-4 hover-lift transition-all duration-200">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0">
              <Avatar
                  name={student?.name || student?.email || '—'}
                  src={student?.avatar || student?.photo || null}
                  size={48}
                  rounded
                  className="border-2 border-border"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 pr-2">
                  <h3
                      className="text-sm md:text-base font-semibold text-foreground leading-tight whitespace-normal break-normal"
                      style={{ wordBreak: 'normal' }}
                  >
                    {student?.name}
                  </h3>

                  <p className="text-xs sm:text-[13px] text-muted-foreground whitespace-normal break-normal">
                    <span>ID: {student?.studentId}</span>
                    <span className="mx-1">•</span>
                    <span>{student?.gradeText}</span>
                    <span className="mx-1">•</span>
                    <span>{student?.section}</span>
                    <span className="mx-1 xl:inline hidden">•</span>
                    <span className="xl:inline hidden">{student?.email}</span>
                  </p>
                </div>

                {showHistory && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowDetails(!showDetails)}
                        className="flex-shrink-0"
                        title="History"
                        aria-label="Toggle attendance history"
                    >
                      <Icon name={showDetails ? 'ChevronUp' : 'ChevronDown'} size={16} />
                    </Button>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div
                      className="h-1.5 bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${student?.attendanceRate ?? 0}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{student?.attendanceRate ?? 0}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 md:gap-2 xl:flex-nowrap xl:justify-end self-start xl:self-auto">
            {isEditable ? (
                attendanceOptions.map(opt => (
                    <Button
                        key={opt.value}
                        variant={student?.status === opt.value ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => handleStatusChange(opt.value)}
                        className="w-9 h-9 xl:w-8 xl:h-8"
                        title={opt.label}
                        aria-label={opt.label}
                    >
                      <Icon
                          name={opt.icon}
                          size={16}
                          className={student?.status === opt.value ? 'text-primary-foreground' : opt.color}
                      />
                    </Button>
                ))
            ) : (
                <div className="flex items-center gap-2">
                  <Icon name={getAttendanceIcon(student?.status)} size={16} className={getAttendanceColor(student?.status)} />
                  <span className={`text-sm font-medium ${getAttendanceColor(student?.status)}`}>
                {student?.status?.charAt(0)?.toUpperCase() + student?.status?.slice(1)}
              </span>
                </div>
            )}
          </div>
        </div>

        {showDetails && showHistory && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Recent Attendance (Last 7 days)</h4>
              <div className="flex flex-wrap gap-2">
                {student?.recentAttendance?.map((day, i) => (
                    <div key={i} className="flex items-center gap-1 px-2 py-1 rounded border border-border">
                      <Icon name={getAttendanceIcon(day.status)} size={12} className={getAttendanceColor(day.status)} />
                      <span className="text-xs text-muted-foreground">{new Date(day.date).getDate()}</span>
                    </div>
                ))}
              </div>
            </div>
        )}

        {student?.attendanceRate < 75 && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded-md">
              <Icon name="AlertTriangle" size={14} className="text-warning" />
              <span className="text-xs text-warning">Low attendance rate - Parent notification sent</span>
            </div>
        )}
      </div>
  );
};

export default StudentAttendanceCard;