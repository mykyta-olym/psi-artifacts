// src/pages/faculty-management/components/FacultyTableHeader.jsx
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { Link } from 'react-router-dom';

const FacultyTableHeader = ({
                                title,
                                switcher,
                                q,
                                onQ,
                                department,
                                onDepartment,
                                departments = [],
                                program,
                                onProgram,
                                programs = [],
                                status,
                                onStatus,
                                empType,
                                onEmpType,
                                subject,
                                onSubject,
                                subjects = [],
                                minExp,
                                onMinExp,
                                day,
                                onDay,
                                showAdv,
                                onToggleAdv,
                                cert,
                                onCert,
                                hireFrom,
                                onHireFrom,
                                hireTo,
                                onHireTo,
                                ratingMin,
                                onRatingMin,
                                selectedCount,
                                totalCount,
                                onAdd,
                                onBulk,
                                onOpenChat,
                                canManage = true,
                                onClearAdvanced,
                            }) => {
    const statusOpts = [
        { value: 'all', label: 'All status' },
        { value: 'active', label: 'Active' },
        { value: 'on-leave', label: 'On leave' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'substitute', label: 'Substitute' }
    ];
    const empTypeOpts = [
        { value: 'all', label: 'All types' },
        { value: 'full-time', label: 'Full-time' },
        { value: 'part-time', label: 'Part-time' }
    ];
    const dayOpts = ['all', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({ value: d, label: d === 'all' ? 'Any day' : d }));

    const handleMinExpChange = (e) => {
        const v = e.target.value;
        if (v === '') return onMinExp('');
        const n = Number(v);
        onMinExp(Number.isNaN(n) ? '' : Math.min(50, Math.max(0, n)));
    };

    return (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-4">
                <div className="space-y-1 min-w-0">
                    <h2 className="text-xl font-semibold text-foreground truncate">{title}</h2>
                    <div className="text-sm text-muted-foreground">
                        Total: {totalCount}
                        {selectedCount > 0 && canManage && <span className="text-primary"> • {selectedCount} selected</span>}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <div className="md:hidden grid grid-cols-2 gap-2 w-full">
                        <Link
                            to={switcher?.left?.to || '/student-management'}
                            className={`px-3 py-2 rounded-md text-sm text-center font-medium border ${
                                switcher?.left?.active ? 'bg-background text-foreground border-border shadow-sm' : 'bg-muted text-muted-foreground border-transparent'
                            }`}
                        >
                            {switcher?.left?.label || 'Students'}
                        </Link>
                        <Link
                            to={switcher?.right?.to || '/faculty-management'}
                            className={`px-3 py-2 rounded-md text-sm text-center font-medium border ${
                                switcher?.right?.active ? 'bg-background text-foreground border-border shadow-sm' : 'bg-muted text-muted-foreground border-transparent'
                            }`}
                        >
                            {switcher?.right?.label || 'Faculty'}
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Link
                            to={switcher?.left?.to || '/student-management'}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                                switcher?.left?.active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {switcher?.left?.label || 'Students'}
                        </Link>
                        <Link
                            to={switcher?.right?.to || '/faculty-management'}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                                switcher?.right?.active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {switcher?.right?.label || 'Faculty'}
                        </Link>
                    </div>

                    {selectedCount > 0 && canManage && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full md:w-auto">
                            <Select
                                placeholder="Bulk actions"
                                options={[
                                    { value: 'activate', label: 'Set Active' },
                                    { value: 'on-leave', label: 'Set On leave' },
                                    { value: 'export', label: 'Export CSV' }
                                ]}
                                value=""
                                onChange={onBulk}
                                className="w-full sm:w-44"
                            />
                            <Button variant="default" size="sm" iconName="MessageCircle" onClick={onOpenChat} className="w-full sm:w-auto">
                                Chat
                            </Button>
                        </div>
                    )}

                    {canManage && (
                        <Button variant="default" iconName="UserPlus" onClick={onAdd} className="w-full md:w-auto">
                            Add Faculty
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="order-4 md:order-4 xl:order-1 md:col-span-3 xl:col-span-2 min-w-0">
                    <div className="hidden xl:block text-sm text-muted-foreground mb-[7px]">Search</div>
                    <Input
                        type="search"
                        placeholder="Search by name, employee ID, email, subject…"
                        value={q}
                        onChange={(e) => onQ(e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="order-1 md:order-1 xl:order-2 min-w-0">
                    <Select
                        label="Department"
                        value={department}
                        onChange={onDepartment}
                        options={departments.map((d) => ({ value: d, label: d === 'all' ? 'All departments' : d }))}
                        className="w-full"
                    />
                </div>

                <div className="order-2 md:order-2 xl:order-3 min-w-0">
                    <Select
                        label="Program"
                        value={program}
                        onChange={onProgram}
                        options={programs.map((p) => ({ value: p, label: p === 'all' ? 'All programs' : p }))}
                        className="w-full"
                    />
                </div>

                <div className="order-3 md:order-3 xl:order-4 min-w-0">
                    <Select label="Status" value={status} onChange={onStatus} options={statusOpts} className="w-full" />
                </div>

                <div className="order-5 md:order-5 xl:order-5 min-w-0">
                    <Select label="Type" value={empType} onChange={onEmpType} options={empTypeOpts} className="w-full" />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="min-w-0">
                    <Select
                        label="Subject"
                        value={subject}
                        onChange={onSubject}
                        options={subjects.map((s) => ({ value: s, label: s === 'all' ? 'All subjects' : s }))}
                        className="w-full"
                    />
                </div>

                <div className="min-w-0">
                    <Input label="Min experience (yrs)" type="number" value={minExp} onChange={handleMinExpChange} min={0} max={50} className="w-full" />
                </div>

                <div className="min-w-0">
                    <Select label="Available" value={day} onChange={onDay} options={dayOpts} className="w-full" />
                </div>

                <div className="flex items-end">
                    <Button
                        variant="outline"
                        iconName="Filter"
                        onClick={onToggleAdv}
                        className={`w-full sm:w-auto ${showAdv ? 'bg-primary/10 text-primary' : ''}`}
                        aria-pressed={showAdv ? 'true' : 'false'}
                    >
                        Advanced
                    </Button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {showAdv && (
                    <motion.div
                        className="mt-4 rounded-lg border border-border p-4 bg-muted/40"
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                            <Input label="Certification contains" value={cert} onChange={(e) => onCert(e.target.value)} className="w-full" />
                            <Input label="Hire date from" type="date" value={hireFrom} onChange={(e) => onHireFrom(e.target.value)} className="w-full" />
                            <Input label="Hire date to" type="date" value={hireTo} onChange={(e) => onHireTo(e.target.value)} className="w-full" />
                            <Input
                                label="Min rating (0–5)"
                                type="number"
                                value={ratingMin}
                                onChange={(e) => onRatingMin(e.target.value)}
                                min={0}
                                max={5}
                                step="0.1"
                                className="w-full"
                            />
                            <div className="flex items-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={() => onClearAdvanced?.()}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FacultyTableHeader;