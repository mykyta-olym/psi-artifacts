// src/pages/attendance-tracking/components/BulkActionsModal.jsx
import React, { useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const BulkActionsModal = ({
                            isOpen,
                            onClose,
                            students,
                            onBulkUpdate,
                            onCopyPreviousDay,
                            canEdit,
                            canCopyPreviousDay,
                            selectedClass,
                            userRole
                          }) => {
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('present');
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'contain';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehaviorY = prevHtmlOverscroll;
      body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen]);

  const attendanceOptions = [
    { value: 'present', label: 'Mark as Present', icon: 'CheckCircle', color: 'text-success' },
    { value: 'absent',  label: 'Mark as Absent',  icon: 'XCircle',    color: 'text-error' },
    { value: 'late',    label: 'Mark as Late',    icon: 'Clock',       color: 'text-warning' },
    { value: 'excused', label: 'Mark as Excused', icon: 'Shield',      color: 'text-accent' }
  ];

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) setSelectedStudents(students?.map((s) => s?.id));
    else setSelectedStudents([]);
  };

  const handleStudentSelect = (studentId, checked) => {
    if (checked) setSelectedStudents((prev) => [...prev, studentId]);
    else {
      setSelectedStudents((prev) => prev.filter((id) => id !== studentId));
      setSelectAll(false);
    }
  };

  const doBulkUpdate = () => {
    if (!canEdit) return;
    if (selectedStudents?.length > 0) {
      onBulkUpdate(selectedStudents, bulkStatus);
      onClose();
      setSelectedStudents([]);
      setSelectAll(false);
    }
  };

  const doCopyPrev = () => {
    if (!canEdit || !canCopyPreviousDay) return;
    onCopyPreviousDay();
    onClose();
  };

  if (!isOpen) return null;

  const classBadge = selectedClass ? (
      <div className="ml-2 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
        <Icon name="Hash" size={12} />
        <span className="max-w-[28ch] truncate">{String(selectedClass)}</span>
      </div>
  ) : null;

  return (
      <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center"
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          data-selected-class={selectedClass ?? undefined}
      >
        <div
            className="fixed inset-0 z-[10] bg-black/60"
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
        />
        <div
            role="dialog"
            aria-modal="true"
            className="relative z-[20] bg-card border border-border shadow-modal w-screen h-[100dvh] sm:w-full sm:max-w-2xl sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg overflow-hidden"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border bg-card pt-[max(env(safe-area-inset-top),1rem)] sm:pt-6">
            <div className="flex items-center min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate">Bulk Attendance Actions</h2>
              {classBadge}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <Icon name="X" size={20} />
            </Button>
          </div>

          <div
              className="p-4 sm:p-6 overflow-y-auto overscroll-contain"
              style={{ maxHeight: 'calc(100dvh - 140px)' }}
          >
            {!canEdit && userRole === 'teacher' && (
                <div className="mb-4 p-3 rounded border border-warning/30 bg-warning/10 text-warning text-sm">
                  Read-only for teachers on past dates. Switch to today to edit or copy.
                </div>
            )}

            {selectedClass && (
                <div className="mb-4 text-xs text-muted-foreground">
                  Applying actions to: <span className="font-medium text-foreground">{String(selectedClass)}</span>
                </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <Button
                    variant="outline"
                    onClick={doCopyPrev}
                    className="justify-start w-full"
                    iconName="Copy"
                    disabled={!canEdit || !canCopyPreviousDay}
                    title={!canCopyPreviousDay ? 'No previous day data or not allowed' : `Copy previous day${selectedClass ? ` for ${String(selectedClass)}` : ''}`}
                >
                  Copy Previous Day
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                      if (!canEdit) return;
                      setSelectedStudents(students?.map((s) => s?.id));
                      setBulkStatus('present');
                    }}
                    className="justify-start w-full"
                    iconName="CheckCircle"
                    disabled={!canEdit}
                    title={`Mark all${selectedClass ? ` in ${String(selectedClass)}` : ''} as Present`}
                >
                  Mark All Present
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Select Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {attendanceOptions.map((option) => (
                    <Button
                        key={option.value}
                        variant={bulkStatus === option.value ? 'default' : 'outline'}
                        onClick={() => canEdit && setBulkStatus(option.value)}
                        className="justify-start w-full"
                        iconName={option.icon}
                        disabled={!canEdit}
                        title={`${option.label}${selectedClass ? ` for ${String(selectedClass)}` : ''}`}
                    >
                      {option.label.replace('Mark as ', '')}
                    </Button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Select Students</h3>
                <Checkbox
                    label="Select All"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e?.target?.checked)}
                    disabled={!canEdit}
                />
              </div>

              <div
                  className="space-y-2 max-h-64 overflow-y-auto overscroll-contain border border-border rounded-md p-2 sm:p-3"
                  style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {students?.map((student) => (
                    <div key={student?.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-md">
                      <Checkbox
                          checked={selectedStudents?.includes(student?.id)}
                          onChange={(e) => handleStudentSelect(student?.id, e?.target?.checked)}
                          disabled={!canEdit}
                      />
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-primary-foreground">
                        {student?.name?.charAt(0)}
                      </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{student?.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {student?.studentId}</p>
                        </div>
                      </div>
                      <div className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
                        Current: {student?.status}
                      </div>
                    </div>
                ))}
              </div>
            </div>

            <div className="text-sm text-muted-foreground mb-2 sm:mb-4">
              {selectedStudents?.length} of {students?.length} students selected
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center justify-end p-4 sm:p-6 border-t border-border bg-card pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
                onClick={doBulkUpdate}
                disabled={!canEdit || selectedStudents?.length === 0}
                iconName="Check"
                className="w-full sm:w-auto"
                title={!canEdit ? 'Read-only day' : ''}
            >
              Update Attendance ({selectedStudents?.length})
            </Button>
          </div>
        </div>
      </div>
  );
};

export default BulkActionsModal;