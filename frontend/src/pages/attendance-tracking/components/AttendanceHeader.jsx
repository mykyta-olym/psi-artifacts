import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';

const AttendanceHeader = ({
                              selectedDate,
                              onDateChange,
                              onDateStep,
                              selectedClass,
                              onClassChange,
                              classes,
                              userRole,
                              canEdit,
                              canGoPrev,
                              canGoNext,
                              onExportReport,
                              onBulkAction
                          }) => {
    const formatDate = (date) =>
        new Date(date)?.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

    return (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6 mb-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg shrink-0">
                        <Icon name="CheckSquare" size={20} color="white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Attendance Tracking</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{formatDate(selectedDate)}</p>
                    </div>
                    {!canEdit && userRole === 'teacher' && (
                        <span className="ml-1 sm:ml-2 px-2 py-1 text-[11px] rounded bg-warning/10 border border-warning/20 text-warning shrink-0">
              Read-only
            </span>
                    )}
                </div>

                <div className="flex flex-col md:flex-row md:flex-wrap gap-2 w-full xl:w-auto">
                    <div className="flex items-center gap-2 w/full md:w-auto">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onDateStep(-1)}
                            disabled={!canGoPrev}
                            className="shrink-0"
                            title="Previous day"
                        >
                            <Icon name="ChevronLeft" size={16} />
                        </Button>

                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => onDateChange(e?.target?.value)}
                            leadingIcon="Calendar"
                            className="w-full md:w-44"
                            size="sm"
                            inputClassName="text-sm"
                            aria-label="Selected date"
                        />

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onDateStep(+1)}
                            disabled={!canGoNext}
                            className="shrink-0"
                            title="Next day"
                        >
                            <Icon name="ChevronRight" size={16} />
                        </Button>
                    </div>

                    <div className="w-full md:flex-1 md:min-w-[220px] md:max-w-[360px]">
                        <Select
                            value={selectedClass}
                            onChange={onClassChange}
                            options={(classes || []).map((c) => ({ value: c?.id, label: c?.name }))}
                            placeholder="Select class"
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-2 w-full md:w-auto">
                        {userRole === 'teacher' && (
                            <Button
                                variant="outline"
                                iconName="Download"
                                onClick={onExportReport}
                                className="text-sm w-full md:w-auto"
                            >
                                Export
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            iconName="Users"
                            onClick={onBulkAction}
                            className="text-sm w-full md:w-auto"
                        >
                            Bulk Actions
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceHeader;