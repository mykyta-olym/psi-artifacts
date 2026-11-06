// src/pages/student-management/components/StudentTableHeader.jsx
import React, { useMemo, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const StudentTableHeader = ({
                                searchQuery = '',
                                onSearchChange = (_v) => {},
                                selectedGrade = '',
                                onGradeChange = (_v) => {},
                                selectedStatus = 'all',
                                onStatusChange = (_v) => {},
                                statusOptions = [],
                                selectedClass = '',
                                onClassChange = (_v) => {},
                                selectedSubject = 'all',
                                onSubjectChange = (_v) => {},
                                subjectOptions = [],
                                onAddStudent = () => {},
                                onBulkAction = (_v) => {},
                                selectedCount = 0,
                                totalCount = 0,
                                showAdvancedSearch = false,
                                onToggleAdvancedSearch = () => {},
                                advStudentId = '',
                                advParentName = '',
                                advDob = '',
                                advGender = 'all',
                                onAdvChange = (_k, _v) => {},
                                onApplyFilters = () => {},
                                onClearFilters = () => {},
                                onOpenChat = () => {},
                                classGroupOptions = [],
                                academicYear = '',
                                allowBulkActions = true,
                                allowAdd = true,
                            }) => {
    const { pathname } = useLocation();
    const isStudents = pathname === '/student-management';
    const isFaculty = pathname === '/faculty-management';

    const statusOptionsSafe = useMemo(() => {
        if (Array.isArray(statusOptions) && statusOptions.length > 0) {
            return statusOptions;
        }
        // Fallback if not provided
        return [
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
        ];
    }, [statusOptions]);

    const bulkActions = useMemo(
        () => [
            { value: 'activate', label: 'Activate Students' },
            { value: 'deactivate', label: 'Deactivate Students' },
            { value: 'export', label: 'Export Selected' },
            { value: 'send-notification', label: 'Send Notification' },
            { value: 'update-grade', label: 'Update Grade Level' },
            { value: 'delete', label: 'Delete Selected' },
        ],
        []
    );

    const gradeOptions = useMemo(() => {
        // Grade filter removed - return empty array
        return [];
    }, []);

    const subjectOptsSafe = useMemo(() => {
        if (Array.isArray(subjectOptions) && subjectOptions.length) return subjectOptions;
        return [{ value: 'all', label: 'All Subjects' }];
    }, [subjectOptions]);

    const classOptsSafe = useMemo(() => (Array.isArray(classGroupOptions) ? classGroupOptions : []), [classGroupOptions]);

    const genderOptions = useMemo(
        () => [
            { value: 'all', label: 'All' },
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
        ],
        []
    );

    return (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6" role="region" aria-label="Student filters">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
                <div className="min-w-0 space-y-1">
                    <h2 className="text-xl font-semibold text-foreground truncate">
                        {isFaculty ? 'Faculty Management' : 'Student Management'}
                    </h2>
                    <div className="text-sm text-muted-foreground">
                        Total: {totalCount}
                        {selectedCount > 0 && <span className="text-primary"> • {selectedCount} selected</span>}
                        {academicYear && <span className="ml-2">• {academicYear}</span>}
                    </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-center gap-2 w-full xl:w-auto flex-wrap xl:flex-nowrap">
                    <div className="xl:hidden grid grid-cols-2 gap-2 w-full">
                        <Link
                            to="/student-management"
                            className={`px-3 py-2 rounded-md text-sm text-center font-medium border ${
                                isStudents ? 'bg-background text-foreground border-border shadow-sm' : 'bg-muted text-muted-foreground border-transparent'
                            }`}
                        >
                            Students
                        </Link>
                        <Link
                            to="/faculty-management"
                            className={`px-3 py-2 rounded-md text-sm text-center font-medium border ${
                                isFaculty ? 'bg-background text-foreground border-border shadow-sm' : 'bg-muted text-muted-foreground border-transparent'
                            }`}
                        >
                            Faculty
                        </Link>
                    </div>

                    <div className="hidden xl:flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Link
                            to="/student-management"
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                                isStudents ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Students
                        </Link>
                        <Link
                            to="/faculty-management"
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                                isFaculty ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Faculty
                        </Link>
                    </div>

                    <Button
                        variant="outline"
                        iconName="Filter"
                        onClick={onToggleAdvancedSearch}
                        aria-expanded={showAdvancedSearch ? 'true' : 'false'}
                        aria-controls="advanced-filters"
                        className={`w-full xl:w-auto ${showAdvancedSearch ? 'bg-primary/10 text-primary' : ''}`}
                    >
                        Filters
                    </Button>

                    {selectedCount > 0 &&
                        (allowBulkActions ? (
                            <>
                                <div className="min-w-[200px] w-full xl:w-auto">
                                    <Select placeholder="Bulk Actions" options={bulkActions} value="" onChange={(value) => onBulkAction(value)} className="w-full" />
                                </div>
                                <Button variant="default" iconName="MessageCircle" onClick={onOpenChat} className="w-full xl:w-auto">
                                    Chat
                                </Button>
                            </>
                        ) : (
                            <Button variant="default" iconName="MessageCircle" onClick={onOpenChat} className="w-full xl:w-auto">
                                Chat
                            </Button>
                        ))}

                    {allowAdd && (
                        <div className="w-full xl:w-auto">
                            <Button variant="default" iconName="UserPlus" onClick={onAddStudent} className="w-full">
                                Add Student
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="block xl:hidden space-y-3">
                    <Input
                        type="search"
                        placeholder="Search by name, student ID, or parent contact..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e?.target?.value ?? '')}
                        className="w-full"
                    />

                    <div className="grid gap-3 md:gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                        <Select
                            placeholder="Subject"
                            options={subjectOptsSafe}
                            value={selectedSubject ?? 'all'}
                            onChange={(v) => onSubjectChange(v)}
                            className="w-full"
                        />
                        <Select
                            placeholder="Status"
                            options={statusOptionsSafe}
                            value={selectedStatus ?? 'all'}
                            onChange={(v) => onStatusChange(v)}
                            className="w-full"
                        />
                        <Select
                            placeholder="Class"
                            options={classOptsSafe}
                            value={selectedClass ?? ''}
                            onChange={(v) => onClassChange(v)}
                            className="w-full"
                        />
                    </div>
                </div>

                <div className="hidden xl:grid xl:grid-cols-12 gap-3 md:gap-4">
                    <div className="xl:col-span-5 min-w-0">
                        <Input
                            type="search"
                            placeholder="Search by name, student ID, or parent contact..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e?.target?.value ?? '')}
                            className="w-full"
                        />
                    </div>

                    <div className="xl:col-span-2 min-w-0">
                        <Select
                            placeholder="Subject"
                            options={subjectOptsSafe}
                            value={selectedSubject ?? 'all'}
                            onChange={(v) => onSubjectChange(v)}
                            className="w-full"
                            disabled={!subjectOptions || subjectOptions.length === 0}
                            clearable={false}
                        />
                    </div>

                    <div className="xl:col-span-2 min-w-0">
                        <Select
                            placeholder="Status"
                            options={statusOptionsSafe}
                            value={selectedStatus ?? 'all'}
                            onChange={(v) => onStatusChange(v)}
                            className="w-full"
                        />
                    </div>

                    <div className="xl:col-span-2 min-w-0">
                        <Select
                            placeholder="Class"
                            options={classOptsSafe}
                            value={selectedClass ?? ''}
                            onChange={(v) => onClassChange(v)}
                            className="w-full"
                            disabled={!selectedSubject || selectedSubject === 'all'}
                        />
                    </div>
                </div>

                <AnimatePresence initial={false}>
                    {showAdvancedSearch && (
                    <motion.div
                        id="advanced-filters"
                        className="bg-muted/50 rounded-lg p-4 border border-border"
                        initial={{ height: 0, opacity: 0, y: -6 }}
                        animate={{ height: 'auto', opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                            <Input
                                label="Student ID"
                                placeholder="Enter student ID"
                                value={advStudentId}
                                onChange={(e) => onAdvChange('studentId', e?.target?.value ?? '')}
                                className="w-full"
                            />
                            <Input
                                label="Parent Name"
                                placeholder="Enter parent name"
                                value={advParentName}
                                onChange={(e) => onAdvChange('parentName', e?.target?.value ?? '')}
                                className="w-full"
                            />
                            <Input
                                label="Date of Birth"
                                type="date"
                                value={advDob}
                                onChange={(e) => onAdvChange('dob', e?.target?.value ?? '')}
                                className="w-full"
                            />
                            <Select
                                label="Gender"
                                placeholder="Select gender"
                                options={genderOptions}
                                value={advGender}
                                onChange={(v) => onAdvChange('gender', v)}
                                className="w-full"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-4">
                            <Button variant="outline" size="sm" onClick={onClearFilters}>
                                Clear Filters
                            </Button>
                            <Button variant="default" size="sm" onClick={onApplyFilters}>
                                Apply Filters
                            </Button>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
        </div>
    );
};

StudentTableHeader.displayName = 'StudentTableHeader';

export default memo(StudentTableHeader);