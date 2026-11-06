// src/pages/Schedule/components/ScheduleFilters.jsx
import React, { useMemo, useEffect } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import useProfileDisplayName from '../../../hooks/useProfileDisplayName';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';

const toSlug = (s = '') => {
  const normalized = String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return normalized;
};

const dedupeBySlug = (names = []) => {
    const used = new Set();
    const out = [];
    names.forEach((n) => {
        const str = String(n || '');
        const v = toSlug(str);
        if (!v) return;
        if (used.has(v)) return;
        used.add(v);
        out.push({ value: v, label: str });
    });
    return out;
};

const ScheduleFilters = ({
                             filters,
                             onFilterChange,
                             onClearFilters,
                             onViewModeChange,
                             viewMode = 'week',
                             classGroupOptions,        // null => hide (student)
                             userRole = 'teacher',
                             scheduleData = [],
                             teacherNames = [],
                             courseNames = [],
                             roomNames = [],
                         }) => {
    const { user, userProfile } = useAuth();
    const fallbackName =
        userProfile?.full_name ||
        user?.full_name ||
        user?.email?.split('@')[0] ||
        'User';
    const currentUserNameRaw = useProfileDisplayName(fallbackName);
    // Ensure we never use email as display name - filter it out
    const currentUserName = useMemo(() => {
        const name = String(currentUserNameRaw || '').trim();
        // If it looks like an email, try to get a better name
        if (name.includes('@')) {
            // Try to extract name from email or use fallback
            const fromEmail = userProfile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User';
            return fromEmail.includes('@') ? 'User' : fromEmail;
        }
        return name || 'User';
    }, [currentUserNameRaw, userProfile?.full_name, user?.full_name, user?.email]);
    const currentUserSlug = useMemo(() => toSlug(currentUserName), [currentUserName]);

    // role-based options
    const teacherOptions = useMemo(() => {
        const sourceNames = (() => {
            if (userRole === 'student') {
                return Array.from(new Set((scheduleData || []).map((e) => e.teacher).filter(Boolean)));
            }
            if (Array.isArray(teacherNames) && teacherNames.length) return teacherNames;
            return Array.from(new Set((scheduleData || []).map((e) => e.teacher).filter(Boolean)));
        })();
        // Filter out emails from source names
        const filteredNames = sourceNames.filter((n) => {
            const name = String(n || '').trim();
            return name && !name.includes('@');
        });
        const base = dedupeBySlug(filteredNames);
        const exists = base.some((o) => o.value === currentUserSlug);
        if (!exists && currentUserName && !currentUserName.includes('@')) {
            base.unshift({ value: currentUserSlug, label: currentUserName });
        } else if (exists) {
            const idx = base.findIndex((o) => o.value === currentUserSlug);
            if (idx >= 0) {
                const me = base[idx];
                base.splice(idx, 1);
                base.unshift(me);
            }
        }
        return userRole === 'student' ? [{ value: 'all', label: 'All Teachers' }, ...base] : base;
    }, [currentUserName, currentUserSlug, teacherNames, scheduleData, userRole]);

    useEffect(() => {
        if (userRole === 'student') return;
        const currentValue = filters?.teacher;
        // If current value is an email, convert it to slug
        if (currentValue && currentValue.includes('@')) {
            // Try to find matching teacher by email and convert to slug
            const matchingOption = teacherOptions.find((o) => {
                // This won't work if email is in label, so we'll use currentUserSlug
                return false;
            });
            // Convert email to slug or use currentUserSlug
            const emailSlug = toSlug(currentValue.split('@')[0]);
            const matchingSlug = teacherOptions.find((o) => o.value === emailSlug)?.value || currentUserSlug;
            if (matchingSlug) {
                onFilterChange?.('teacher', matchingSlug);
            }
            return;
        }
        // Ensure current user is selected by default if no teacher is selected or if 'all' is selected
        if (!currentValue || currentValue === 'all' || currentValue === '') {
            if (currentUserSlug) {
                onFilterChange?.('teacher', currentUserSlug);
            }
        }
    }, [filters?.teacher, currentUserSlug, onFilterChange, userRole, teacherOptions]);

    // Filter schedule data by selected teacher
    const filteredScheduleByTeacher = useMemo(() => {
        if (!filters?.teacher || filters.teacher === 'all' || userRole === 'student') {
            return scheduleData;
        }
        return scheduleData.filter((e) => {
            const teacherSlug = toSlug(e.teacher || '');
            return teacherSlug === filters.teacher;
        });
    }, [scheduleData, filters?.teacher, userRole]);

    const subjectOptions = useMemo(() => {
        const sourceNames = (() => {
            if (userRole === 'student') {
                return Array.from(new Set((scheduleData || []).map((e) => e.subject).filter(Boolean)));
            }
            // For teachers, filter by selected teacher's schedule
            if (filters?.teacher && filters.teacher !== 'all') {
                const courses = Array.from(new Set((filteredScheduleByTeacher || []).map((e) => e.subject).filter(Boolean)));
                if (courses.length > 0) return courses;
            }
            if (Array.isArray(courseNames) && courseNames.length) return courseNames;
            return Array.from(new Set((scheduleData || []).map((e) => e.subject).filter(Boolean)));
        })();
        const opts = dedupeBySlug(sourceNames);
        return [{ value: 'all', label: 'All Courses' }, ...opts];
    }, [courseNames, userRole, scheduleData, filteredScheduleByTeacher, filters?.teacher]);

    const facultyOptions = useMemo(() => {
        const sourceNames = Array.from(
            new Set(
                (scheduleData || [])
                    .map((e) => {
                        // Handle both string and object faculty values
                        if (typeof e.faculty === 'object' && e.faculty !== null) {
                            return e.faculty.name || e.faculty.code || '';
                        }
                        return String(e.faculty || '');
                    })
                    .filter(Boolean)
            )
        );
        const opts = dedupeBySlug(sourceNames);
        return [{ value: 'all', label: 'All Faculties' }, ...opts];
    }, [scheduleData]);

    const programOptions = useMemo(() => {
        const filteredByFaculty = filters?.faculty && filters.faculty !== 'all'
            ? (scheduleData || []).filter((e) => {
                const facultyStr = typeof e.faculty === 'object' && e.faculty !== null
                    ? (e.faculty.name || e.faculty.code || '')
                    : String(e.faculty || '');
                return toSlug(facultyStr) === filters.faculty;
            })
            : scheduleData;
        const sourceNames = Array.from(
            new Set(
                (filteredByFaculty || [])
                    .map((e) => {
                        // Handle both string and object program values
                        if (typeof e.program === 'object' && e.program !== null) {
                            return e.program.name || e.program.code || '';
                        }
                        return String(e.program || '');
                    })
                    .filter(Boolean)
            )
        );
        const opts = dedupeBySlug(sourceNames);
        return [{ value: 'all', label: 'All Programs' }, ...opts];
    }, [scheduleData, filters?.faculty]);

    const roomOptions = useMemo(() => {
        const sourceNames = (() => {
            if (userRole === 'student') {
                return Array.from(new Set((scheduleData || []).map((e) => e.room).filter(Boolean)));
            }
            // For teachers, filter by selected teacher's schedule
            if (filters?.teacher && filters.teacher !== 'all') {
                const rooms = Array.from(new Set((filteredScheduleByTeacher || []).map((e) => e.room).filter(Boolean)));
                if (rooms.length > 0) return rooms;
            }
            if (Array.isArray(roomNames) && roomNames.length) return roomNames;
            return Array.from(new Set((scheduleData || []).map((e) => e.room).filter(Boolean)));
        })();
        const opts = dedupeBySlug(sourceNames);
        return [{ value: 'all', label: 'All Rooms' }, ...opts];
    }, [roomNames, userRole, scheduleData, filteredScheduleByTeacher, filters?.teacher]);

    const viewModeOptions = [
        { value: 'week', label: 'Week View' },
        { value: 'day', label: 'Day View' },
    ];

    const hasActiveFilters = () => {
        return Object.entries(filters).some(([k, v]) => {
            if (['conflicts', 'today', 'available'].includes(k)) return !!v;
            // Teacher filter is always set (default to current user), so don't count it as active filter
            if (k === 'teacher' && userRole !== 'student') return false;
            return v && v !== 'all';
        });
    };

    const isActive = (key) => !!filters?.[key];

    const { isBlocked } = useGlobalLoaderBlocking();

    return (
        <MotionConfig transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: ANIMATION_DELAYS.SUMMARY_CARDS }}
                className="bg-card rounded-lg border border-border p-4 sm:p-6 mb-6"
            >
                <motion.div
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4"
                    initial={{ opacity: 0, y: 14 }}
                    animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                    transition={{ delay: ANIMATION_DELAYS.SUMMARY_CARDS + 0.05 }}
                >
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">Schedule Filters</h3>
                    <div className="flex items-center gap-2">
                        <Select options={viewModeOptions} value={viewMode} onChange={onViewModeChange} className="w-36" />
                        {hasActiveFilters() && (
                            <Button variant="outline" size="sm" onClick={onClearFilters} iconName="X" className="hidden sm:inline-flex">
                                Clear
                            </Button>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    className={`grid grid-cols-1 md:grid-cols-2 ${classGroupOptions ? 'lg:grid-cols-4 xl:grid-cols-5' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-3 sm:gap-4`}
                    variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                    initial="hidden"
                    animate={isBlocked ? "hidden" : "visible"}
                >
                    {[{
                        id: 'teacher',
                        node: (
                            <Select
                                label="Teacher"
                                options={teacherOptions}
                                value={(() => {
                                    const currentValue = filters?.teacher;
                                    // If current value is an email, try to find matching slug
                                    if (currentValue && currentValue.includes('@')) {
                                        // Try to find teacher by email in options
                                        const teacher = teacherOptions.find((o) => {
                                            // Check if any option's label contains this email (unlikely but possible)
                                            return false; // Email shouldn't be in options
                                        });
                                        // If not found, use currentUserSlug as fallback
                                        return currentUserSlug || 'all';
                                    }
                                    // If value is not in options, use currentUserSlug
                                    if (currentValue && !teacherOptions.find((o) => o.value === currentValue)) {
                                        return currentUserSlug || 'all';
                                    }
                                    return currentValue || (userRole === 'student' ? 'all' : (currentUserSlug || 'all'));
                                })()}
                                onChange={(value) => onFilterChange('teacher', value)}
                                searchable
                            />
                        )
                    }, {
                        id: 'course',
                        node: (
                            <Select
                                label="Course"
                                options={subjectOptions}
                                value={filters?.subject || 'all'}
                                onChange={(value) => onFilterChange('subject', value)}
                                searchable
                            />
                        )
                    }, {
                        id: 'room',
                        node: (
                            <Select
                                label="Room"
                                options={roomOptions}
                                value={filters?.room || 'all'}
                                onChange={(value) => onFilterChange('room', value)}
                                searchable
                            />
                        )
                    }].map(({ id, node }) => (
                        <motion.div key={id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                            {node}
                        </motion.div>
                    ))}

                    {classGroupOptions && (
                        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                            <Select
                                label="Class"
                                options={(() => {
                                    if (!filters?.teacher || filters.teacher === 'all' || userRole === 'student') {
                                        return classGroupOptions;
                                    }
                                    // Get unique class groups from filtered schedule
                                    const usedGroups = new Set();
                                    filteredScheduleByTeacher.forEach((e) => {
                                        if (Array.isArray(e.classGroupKeys)) {
                                            e.classGroupKeys.forEach((key) => {
                                                if (key) usedGroups.add(key);
                                            });
                                        }
                                    });
                                    // Filter classGroupOptions to only include used groups
                                    const allOption = classGroupOptions.find((o) => o.value === 'all');
                                    const filtered = classGroupOptions.filter((o) => o.value === 'all' || usedGroups.has(o.value));
                                    return filtered.length > 1 ? filtered : (allOption ? [allOption] : classGroupOptions);
                                })()}
                                value={filters?.classGroup || 'all'}
                                onChange={(value) => onFilterChange('classGroup', value)}
                                searchable={false}
                            />
                        </motion.div>
                    )}

                    {userRole !== 'student' && (
                        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                            <Select
                                label="Faculty"
                                options={facultyOptions}
                                value={filters?.faculty || 'all'}
                                onChange={(value) => {
                                    onFilterChange('faculty', value);
                                    // Reset program filter when faculty changes
                                    if (value !== filters?.faculty) {
                                        onFilterChange('program', 'all');
                                    }
                                }}
                                searchable
                            />
                        </motion.div>
                    )}

                    {userRole !== 'student' && (
                        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                            <Select
                                label="Program"
                                options={programOptions}
                                value={filters?.program || 'all'}
                                onChange={(value) => onFilterChange('program', value)}
                                searchable
                            />
                        </motion.div>
                    )}

                    <motion.div
                        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                        className={`${classGroupOptions ? 'xl:col-span-1 md:col-span-2 lg:col-span-2' : 'md:col-span-2 lg:col-span-2'}`}
                    >
                        <Input
                            label="Search"
                            type="search"
                            placeholder="Search schedules..."
                            value={filters?.search || ''}
                            onChange={(e) => onFilterChange('search', e?.target?.value)}
                        />
                    </motion.div>
                </motion.div>

                <div className="flex flex-col gap-3 mt-4 pt-4 border-top border-t border-border">
                    <motion.div
                        className="flex flex-wrap items-center gap-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                        transition={{ delay: ANIMATION_DELAYS.SUMMARY_CARDS + 0.1 }}
                    >
                        <span className="text-sm font-medium text-muted-foreground">Quick Filters:</span>
                        <Button
                            variant={isActive('conflicts') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange('conflicts', !filters?.conflicts)}
                            iconName="AlertTriangle"
                            className={isActive('conflicts') ? '' : 'text-warning border-warning hover:bg-warning/10'}
                        >
                            Show Conflicts
                        </Button>
                        <Button
                            variant={isActive('today') ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange('today', !filters?.today)}
                            iconName="Calendar"
                        >
                            Today&apos;s Classes
                        </Button>
                        {userRole !== 'student' && (
                            <Button
                                variant={isActive('available') ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onFilterChange('available', !filters?.available)}
                                iconName="Clock"
                            >
                                Available Slots
                            </Button>
                        )}
                        {hasActiveFilters() && (
                            <Button variant="outline" size="sm" onClick={onClearFilters} iconName="X" className="sm:hidden">
                                Clear
                            </Button>
                        )}
                    </motion.div>

                    {hasActiveFilters() && (
                        <motion.div
                            className="pt-2"
                            initial={{ opacity: 0, y: 12 }}
                            animate={isBlocked ? {} : { opacity: 1, y: 0 }}
                            transition={{ delay: ANIMATION_DELAYS.SUMMARY_CARDS + 0.14 }}
                        >
                            <motion.div layout className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-muted-foreground">Active Filters:</span>
                                {Object.entries(filters)?.map(([key, value]) => {
                                    const isBool = ['conflicts', 'today', 'available'].includes(key);
                                    // Don't show teacher filter in active filters - it's always set to a default value
                                    if (key === 'teacher' && userRole !== 'student') return null;
                                    let displayValue = value;
                                    const label = isBool
                                        ? `${key === 'conflicts' ? 'Conflicts' : key === 'today' ? 'Today' : 'Available Slots'}`
                                        : `${key.charAt(0).toUpperCase()}${key.slice(1)}: ${displayValue}`;
                                    if (!value || value === 'all') return null;
                                    return (
                                        <motion.button
                                            layout
                                            type="button"
                                            key={`${key}-${value}`}
                                            onClick={() => onFilterChange(key, isBool ? false : 'all')}
                                            className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/15"
                                            whileHover={{ scale: 1.04, y: -1 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            {label}
                                            <Icon name="X" size={12} />
                                        </motion.button>
                                    );
                                })}
                            </motion.div>
                        </motion.div>
                    )}
                </div>
            </motion.section>
        </MotionConfig>
    );
};

export default ScheduleFilters;