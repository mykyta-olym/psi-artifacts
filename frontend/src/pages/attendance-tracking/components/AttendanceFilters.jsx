import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const AttendanceFilters = ({
                               searchTerm,
                               onSearchChange,
                               statusFilter,
                               onStatusFilterChange,
                               attendanceRateFilter,
                               onAttendanceRateFilterChange,
                               groupFilter,
                               onGroupFilterChange,
                               availableGroups = [],
                               onClearFilters,
                           }) => {
    const statusOptions = [
        { value: '', label: 'All Status' },
        { value: 'present', label: 'Present' },
        { value: 'absent', label: 'Absent' },
        { value: 'late', label: 'Late' },
        { value: 'excused', label: 'Excused' },
    ];

    const attendanceRateOptions = [
        { value: '', label: 'All Rates' },
        { value: 'excellent', label: '95%+ (Excellent)' },
        { value: 'good', label: '85–94% (Good)' },
        { value: 'fair', label: '75–84% (Fair)' },
        { value: 'poor', label: 'Below 75% (Poor)' },
    ];

    const groupOptions = [
        { value: '', label: 'All Groups' },
        ...availableGroups.map(g => ({ value: g, label: g }))
    ];

    const hasActive = !!(searchTerm || statusFilter || attendanceRateFilter || groupFilter);

    return (
        <div className="bg-card rounded-lg border border-border p-3 sm:p-4 mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm font-semibold text-foreground">Filters</h3>
                {hasActive && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearFilters}
                        iconName="X"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Clear All
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-2">
                    <Input
                        type="search"
                        placeholder="Search by name, email, or ID…"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e?.target?.value)}
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Select
                        value={statusFilter}
                        onChange={onStatusFilterChange}
                        options={statusOptions}
                        placeholder="Status"
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Select
                        value={attendanceRateFilter}
                        onChange={onAttendanceRateFilterChange}
                        options={attendanceRateOptions}
                        placeholder="Attendance rate"
                        className="w-full"
                    />
                </div>

                <div className="space-y-2">
                    <Select
                        value={groupFilter}
                        onChange={onGroupFilterChange}
                        options={groupOptions}
                        placeholder="Group"
                        className="w-full"
                    />
                </div>
            </div>

            {hasActive && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                    <div className="flex flex-wrap gap-2">
                        {searchTerm && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm">
                                <Icon name="Search" size={12} />
                                <span className="truncate max-w-[180px] sm:max-w-none">Search: {searchTerm}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onSearchChange('')}
                                    className="w-5 h-5 p-0 hover:bg-primary/20"
                                >
                                    <Icon name="X" size={10} />
                                </Button>
                            </div>
                        )}

                        {statusFilter && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 bg-accent/10 text-accent rounded-full text-sm">
                                <Icon name="Filter" size={12} />
                                <span>Status: {statusOptions.find(o => o.value === statusFilter)?.label}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onStatusFilterChange('')}
                                    className="w-5 h-5 p-0 hover:bg-accent/20"
                                >
                                    <Icon name="X" size={10} />
                                </Button>
                            </div>
                        )}

                        {attendanceRateFilter && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm">
                                <Icon name="TrendingUp" size={12} />
                                <span>Rate: {attendanceRateOptions.find(o => o.value === attendanceRateFilter)?.label}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onAttendanceRateFilterChange('')}
                                    className="w-5 h-5 p-0 hover:bg-warning/20"
                                >
                                    <Icon name="X" size={10} />
                                </Button>
                            </div>
                        )}

                        {groupFilter && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-sm">
                                <Icon name="Users" size={12} />
                                <span>Group: {groupFilter}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onGroupFilterChange('')}
                                    className="w-5 h-5 p-0 hover:bg-indigo-500/20"
                                >
                                    <Icon name="X" size={10} />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceFilters;