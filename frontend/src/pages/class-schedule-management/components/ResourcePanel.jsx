// src/pages/Schedule/components/ResourcePanel.jsx
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useToasts } from '../../../components/ui/Toasts';

import useProfileDisplayName from '../../../hooks/useProfileDisplayName';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';
import { displayNameFrom, readTitlesFrom, nameFromEmail } from '../../../utils/displayName';
import { useAuth } from '../../../contexts/AuthContext';

const asStr = (v) => String(v ?? '');

const StatusBadge = ({ status }) => {
    const map = {
        available:   { tw: 'text-success bg-success/10 border-success/20', icon: 'CheckCircle', label: 'available' },
        scheduled:   { tw: 'text-primary bg-primary/10 border-primary/20', icon: 'Calendar',    label: 'scheduled' },
        busy:        { tw: 'text-error bg-error/10 border-error/20',       icon: 'Clock',       label: 'busy' },
        occupied:    { tw: 'text-error bg-error/10 border-error/20',       icon: 'Clock',       label: 'occupied' },
        'in-use':    { tw: 'text-error bg-error/10 border-error/20',       icon: 'Clock',       label: 'in use' },
        break:       { tw: 'text-warning bg-warning/10 border-warning/20', icon: 'Coffee',      label: 'break' },
        maintenance: { tw: 'text-muted-foreground bg-muted border-border', icon: 'Wrench',      label: 'maintenance' },
    };
    const m = map[status] || { tw: 'text-muted-foreground bg-muted border-border', icon: 'Circle', label: status || 'unknown' };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border backdrop-blur ${m.tw}`}>
            <Icon name={m.icon} size={10} />
            {m.label}
    </span>
    );
};

const ProgressBar = ({ value = 0, max = 10 }) => {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
        </div>
    );
};

const Card = ({ title, subtitle, extra, right, children, expanded, onToggle, isBlocked }) => (
    <motion.article
        className={`metric-card w-full p-3 sm:p-4 ${expanded ? 'ring-1 ring-primary/25' : ''}`}
        initial={{ opacity: 0, y: 14 }}
        animate={isBlocked ? {} : { opacity: 1, y: 0 }}
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
    >
        <button
            className="w-full flex items-start justify-between gap-3 text-left pb-2"
            onClick={() => onToggle?.()}
            aria-expanded={expanded}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">{title}</div>
                    {right}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1 break-words">{subtitle}</p>}
                {extra}
            </div>
            <Icon name="ChevronDown" size={16} className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
            {expanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                >
                    <div className="pt-3 border-t border-border/60" />
                    <div className="pt-3 space-y-2 text-sm text-foreground/90">
                        {children}
    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </motion.article>
);

const InfoRow = ({ icon, label, value, strong = false }) => (
    <div className="flex items-start gap-2">
        <Icon name={icon} size={14} className="mt-0.5 text-muted-foreground" />
        <div className="text-xs leading-5">
            <span className="text-muted-foreground">{label}: </span>
            <span className={strong ? 'font-medium text-foreground' : 'text-foreground'}>{value ?? '—'}</span>
        </div>
    </div>
);

const Chip = ({ children, tw = '' }) => (
    <span className={`px-2 py-1 bg-card/70 text-foreground/90 text-[11px] rounded border border-border/60 backdrop-blur-sm ${tw}`}>{children}</span>
);

const TitlesRow = ({ prefix = [], suffix = [] }) => {
    const has = (prefix && prefix.length) || (suffix && suffix.length);
    if (!has) return null;
    return (
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {Array.isArray(prefix) && prefix.map((t, i) => <Chip key={`pre-${i}`}>{t}</Chip>)}
            {Array.isArray(suffix) && suffix.map((t, i) => <Chip key={`suf-${i}`}>{t}</Chip>)}
        </div>
    );
};

const hoursForTeacher = (email, scheduleData=[]) =>
    (scheduleData || []).filter(t => (t.teacherEmail || '').toLowerCase() === String(email||'').toLowerCase()).length;

const hoursForRoom = (roomName, scheduleData=[]) =>
    (scheduleData || []).filter(t => (t.room || '').toLowerCase() === String(roomName||'').toLowerCase()).length;

const nextForRoom = (roomName, scheduleData=[]) => {
    const DAY_ORDER = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6 };
    const slots = (scheduleData || [])
        .filter(t => (t.room || '').toLowerCase() === String(roomName||'').toLowerCase())
        .sort((a,b) => {
            const dayA = DAY_ORDER[(a.day||'').toLowerCase()] ?? 99;
            const dayB = DAY_ORDER[(b.day||'').toLowerCase()] ?? 99;
            if (dayA !== dayB) return dayA - dayB;
            return (a.time||'').localeCompare(b.time||'');
        });
    if (!slots.length) return null;
    const s = slots[0];
    return { day: s.day, time: s.time, endTime: s.endTime, subject: s.subject };
};

const nextForTeacher = (email, scheduleData=[]) => {
    const slots = (scheduleData || [])
        .filter(t => (t.teacherEmail || '').toLowerCase() === String(email||'').toLowerCase())
        .sort((a,b)=> (a.day||'').localeCompare(b.day||'') || (a.time||'').localeCompare(b.time||''));
    if (!slots.length) return '—';
    const s = slots[0];
    return `${s.time} • ${s.day} • ${s.room}`;
};

const TeacherCard = ({ data, onClick, scheduleData = [], userRole = 'teacher', isBlocked }) => {
    const [open, setOpen] = useState(false);
    const scheduled = hoursForTeacher(data.email, scheduleData);
    const next = nextForTeacher(data.email, scheduleData);
    const rawName = data.name || data.displayName || data.fullName || '';
    // Use readable name or extract from email for avatar
    const cleanName = rawName && !rawName.includes('@') ? rawName : (nameFromEmail(data.email) || data.email || '—');
    const shownDept = data.departments?.[0] || data.primaryDepartment || 'Faculty';

    return (
        <div
            onClick={() => onClick?.('teacher', { name: data.displayName || cleanName, email: data.email })}
            className="cursor-pointer"
        >
            <Card
                title={
                    <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-full overflow-hidden inline-flex flex-shrink-0">
              <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`}
                  alt={cleanName}
                  className="w-8 h-8 aspect-square object-cover rounded-full"
              />
            </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-foreground truncate">{cleanName}</div>
                                {data.isYou && userRole !== 'student' && <Chip tw="bg-primary/10 border-primary/30 text-primary">you</Chip>}
                            </div>
                            {userRole !== 'student' && <TitlesRow prefix={data.titlesPrefix} suffix={data.titlesSuffix} />}
                        </div>
                    </div>
                }
                subtitle={userRole === 'student' ? (next || '—') : shownDept}
                extra={<div className="text-[11px] text-muted-foreground mt-0.5">{userRole === 'student' ? shownDept : data.email}</div>}
                right={<StatusBadge status={scheduled ? 'busy' : 'available'} />}
                expanded={open}
                onToggle={() => setOpen((v) => !v)}
                isBlocked={isBlocked}
            >
                <div className="space-y-2">
                    <InfoRow icon="Calendar" label={userRole === 'student' ? 'Next class' : 'Next'} value={next || '—'} />
                    {userRole !== 'student' && (
                        <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Hours: <span className="text-foreground font-medium">{scheduled || 0}/10</span>
              </span>
                            <div className="flex-1">
                                <ProgressBar value={scheduled || 0} max={10} />
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

const RoomCard = ({ data, onClick, equipmentList = [], scheduleData = [], isBlocked }) => {
    const [open, setOpen] = useState(false);
    const eqHere = useMemo(() => {
        const key = String(data?.name || '').trim().toLowerCase();
        if (!key) return [];
        return (equipmentList || []).filter((item) => String(item?.location || item?.Location || '').trim().toLowerCase() === key);
    }, [equipmentList, data?.name]);

    const linkNode = (() => {
        if (!data.link) return '—';
        const v = String(data.link);
        const isEmail = v.includes('@') && !/^https?:\/\//i.test(v);
        const href = isEmail ? `mailto:${v}` : v;
        return (
            <a className="text-primary underline" href={href} target={isEmail ? undefined : '_blank'} rel={isEmail ? undefined : 'noreferrer'}>
                {v}
            </a>
        );
    })();
    
    // Get schedule info for this room
    const scheduledCount = useMemo(() => hoursForRoom(data?.name, scheduleData), [data?.name, scheduleData]);
    const nextBooking = useMemo(() => nextForRoom(data?.name, scheduleData), [data?.name, scheduleData]);
    
    // Calculate room status based on schedule
    const roomStatus = useMemo(() => {
        if (!data.active) return 'maintenance';
        if (scheduledCount > 0) return 'scheduled';
        return 'available';
    }, [data.active, scheduledCount]);
    
    // Format next booking display
    const nextBookingDisplay = useMemo(() => {
        if (!nextBooking) return '—';
        return `${nextBooking.day} ${nextBooking.time}${nextBooking.endTime ? '-' + nextBooking.endTime : ''}`;
    }, [nextBooking]);

    return (
        <div onClick={() => onClick?.('room', { name: data.name })} className="cursor-pointer">
            <Card
                title={<span className="text-sm font-semibold text-foreground break-words">{data.name}</span>}
                subtitle={`${data.type || 'Room'} • Capacity ${data.capacity ?? '—'}`}
                right={<StatusBadge status={roomStatus} />}
                expanded={open}
                onToggle={() => setOpen((v) => !v)}
                isBlocked={isBlocked}
            >
                <div className="space-y-2">
                    <InfoRow icon="MapPin" label="Type" value={data.type || '—'} />
                    <InfoRow icon="Building" label="Building" value={data.building || '—'} />
                    <InfoRow icon="Layers" label="Floor" value={data.floor || '—'} />
                    <InfoRow icon="Calendar" label="Next booking" value={nextBookingDisplay} />
                    {data.reservedBy && <InfoRow icon="User" label="Reserved by" value={data.reservedBy} />}
                    <InfoRow icon="Link2" label="Link" value={linkNode} />
                    <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Equipment:</div>
                        {eqHere && eqHere.length ? (
                            <div className="flex flex-wrap gap-1">
                                {eqHere.map((e) => (
                                    <Chip key={e.id}>{e.name}</Chip>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">Nothing here</div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

const EquipmentCard = ({ data, onClick, scheduleData = [], isBlocked }) => {
    const [open, setOpen] = useState(false);
    
    // Get schedule info for the room where this equipment is located
    const roomName = data.location || data.roomId || '';
    const nextBooking = useMemo(() => nextForRoom(roomName, scheduleData), [roomName, scheduleData]);
    const isRoomScheduled = useMemo(() => hoursForRoom(roomName, scheduleData) > 0, [roomName, scheduleData]);
    
    // Format next booking display based on room schedule
    const nextBookingDisplay = useMemo(() => {
        if (!nextBooking) return '—';
        return `${nextBooking.day} ${nextBooking.time}${nextBooking.endTime ? '-' + nextBooking.endTime : ''}`;
    }, [nextBooking]);
    
    // Determine actual status based on availability and room schedule
    const actualStatus = useMemo(() => {
        if (data.status === 'maintenance' || data.status === 'broken' || data.status === 'retired') {
            return data.status;
        }
        // If room has scheduled classes, equipment is "in-use"
        if (isRoomScheduled) return 'scheduled';
        return data.isAvailable === false ? 'in-use' : 'available';
    }, [data.status, data.isAvailable, isRoomScheduled]);
    
    return (
        <div onClick={() => onClick?.('equipment', data)} className="cursor-pointer">
            <Card
                title={<span className="text-sm font-semibold text-foreground break-words">{data.name}</span>}
                subtitle={data.type || 'Equipment'}
                right={<StatusBadge status={actualStatus} />}
                expanded={open}
                onToggle={() => setOpen((v) => !v)}
                isBlocked={isBlocked}
            >
                <div className="grid grid-cols-1 gap-2">
                    <InfoRow icon="MapPin" label="Location" value={data.location || '—'} />
                    <InfoRow icon="User" label="Assigned" value={data.assignedTo || '—'} />
                    <InfoRow icon="Calendar" label="Next booking" value={nextBookingDisplay} />
                    {data.reservedBy && <InfoRow icon="UserCheck" label="Reserved by" value={data.reservedBy} />}
                </div>
            </Card>
        </div>
    );
};

const ResourcePanel = ({
                           isCollapsed,
                           onToggle,
                           selectedDate = new Date(),
                           onResourceSelect,
                           scheduleData,
                           timeSlots,
                           currentUserEmail = '',
                           currentUserName = '',
                           classGroupDict = [],
                           userRole = 'teacher',
                           teacherList: providedTeacherList = [],
                           roomList: providedRoomList = [],
                           equipmentList: providedEquipmentList = [],
                       }) => {
    const { notify } = useToasts();
    const { isBlocked } = useGlobalLoaderBlocking();
    const lastToastRef = useRef('');
    const [viewportW, setViewportW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
    const [initialViewportSet, setInitialViewportSet] = useState(false);
    const isPinned = viewportW >= 1280;
    const drawerOpen = !isPinned && !isCollapsed;

    useEffect(() => {
        if (!initialViewportSet && typeof window !== 'undefined') {
            setViewportW(window.innerWidth);
            setInitialViewportSet(true);
        }
    }, [initialViewportSet]);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        if (!isPinned || isCollapsed) {
            root.style.setProperty('--resource-offset', '0px');
            body.classList.remove('resource-panel-active');
            return () => {
                root.style.setProperty('--resource-offset', '0px');
                body.classList.remove('resource-panel-active');
            };
        }
        const offset = '24rem';
        root.style.setProperty('--resource-offset', offset);
        body.classList.add('resource-panel-active');
        return () => {
            root.style.setProperty('--resource-offset', '0px');
            body.classList.remove('resource-panel-active');
        };
    }, [isPinned, isCollapsed]);

    useEffect(() => {
        const onR = () => {
            if (!initialViewportSet) return;
            setViewportW(window.innerWidth);
        };
        if (!initialViewportSet && typeof window !== 'undefined') {
            setViewportW(window.innerWidth);
            setInitialViewportSet(true);
        }
        window.addEventListener('resize', onR);
        return () => window.removeEventListener('resize', onR);
    }, [initialViewportSet]);

    const safeDate = useMemo(() => {
        try {
            return selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
        } catch {
            return new Date();
        }
    }, [selectedDate]);

    const slotsCount = useMemo(() => (Array.isArray(timeSlots) ? timeSlots.length : 0), [timeSlots]);
    const schedCount = useMemo(() => Array.isArray(scheduleData) ? scheduleData.length : 0, [scheduleData]);

    const youDisplayName = useProfileDisplayName(currentUserName);
    const { user, userProfile } = useAuth();

    const [youProfile, setYouProfile] = useState(null);
    useEffect(() => {
        const deriveProfile = () => {
            // Use only userProfile from context, no static fallback
            if (userProfile && Object.keys(userProfile).length) {
                return userProfile;
            }
            return null;
        };
        setYouProfile(deriveProfile());
    }, [userProfile]);

    useEffect(() => {
        const onBus = (e) => {
            if (e?.detail) {
                setYouProfile(e.detail);
            } else {
                // Use only userProfile from context
                setYouProfile(userProfile && Object.keys(userProfile).length ? userProfile : null);
            }
        };
        window.addEventListener('mais:profile-updated', onBus);
        return () => {
            window.removeEventListener('mais:profile-updated', onBus);
        };
    }, [userProfile]);

    const teacherEmailsInSchedule = useMemo(() => {
        const s = new Set();
        (scheduleData || []).forEach(ev => {
            const em = (ev.teacherEmail || '').toLowerCase();
            if (em) s.add(em);
        });
        return s;
    }, [scheduleData]);

    const roomNamesInSchedule = useMemo(() => {
        const s = new Set();
        (scheduleData || []).forEach(ev => {
            const r = asStr(ev.room);
            if (r) s.add(r);
        });
        return s;
    }, [scheduleData]);

    const teacherList = useMemo(() => providedTeacherList, [providedTeacherList]);
    const roomList = useMemo(() => providedRoomList, [providedRoomList]);
    const equipmentList = useMemo(() => providedEquipmentList, [providedEquipmentList]);

    const resourceLabel = useCallback((type, payload) => {
        if (!payload) return '';
        if (type === 'teacher') return payload.name || payload.email || payload.id || 'Teacher';
        if (type === 'room') return payload.name || payload.id || 'Room';
        if (type === 'equipment') return payload.name || payload.id || 'Equipment';
        if (type === 'classGroup') return payload.key ? `${payload.key} group` : 'Class group';
        if (type === 'subject') return payload.name || 'Subject';
        return 'Resource';
    }, []);

    const handleSelectionToast = useCallback(
        (type, payload) => {
            const label = resourceLabel(type, payload);
            const key = `${type}:${label}`.toLowerCase();
            if (key && lastToastRef.current === key) return;
            lastToastRef.current = key;
            const title = type === 'teacher'
                ? 'Teacher filter applied'
                : type === 'room'
                    ? 'Room filter applied'
                    : type === 'equipment'
                        ? 'Equipment filter applied'
                        : 'Filter updated';
            notify('info', label, { title, lockMs: 1800 });
        },
        [notify, resourceLabel]
    );

    const handleResourceSelect = useCallback(
        (type, payload, options = {}) => {
            onResourceSelect?.(type, payload);
            handleSelectionToast(type, payload);
            if (options.shouldCloseDrawer) onToggle?.();
        },
        [handleSelectionToast, onResourceSelect, onToggle]
    );

    const tabs = [
        { id: 'teachers',  label: 'Teachers',  icon: 'Users',    count: teacherList.length },
        { id: 'rooms',     label: 'Rooms',     icon: 'Building', count: roomList.length },
        { id: 'equipment', label: 'Equipment', icon: 'Monitor',  count: equipmentList.length },
    ];
    const [activeTab, setActiveTab] = useState('teachers');

    const [searchTerm, setSearchTerm] = useState('');
    const [onlyScheduled, setOnlyScheduled] = useState(false);
    const [onlyAvailable, setOnlyAvailable] = useState(false);

    useEffect(() => {
        setOnlyScheduled(false);
        setOnlyAvailable(false);
    }, [activeTab]);

    const normalizeText = useCallback((value) => String(value || '').toLowerCase(), []);
    const normalizedSearch = normalizeText(searchTerm).trim();

    const teacherStats = useMemo(() => {
        const scheduled = teacherList.reduce((acc, item) => {
            const email = normalizeText(item?.email);
            return acc + (teacherEmailsInSchedule.has(email) ? 1 : 0);
        }, 0);
        const available = Math.max(0, teacherList.length - scheduled);
        return { total: teacherList.length, scheduled, available };
    }, [teacherList, teacherEmailsInSchedule, normalizeText]);

    const roomStats = useMemo(() => {
        const scheduled = roomList.reduce((acc, item) => {
            const name = asStr(item?.name);
            return acc + (roomNamesInSchedule.has(name) ? 1 : 0);
        }, 0);
        const available = Math.max(0, roomList.length - scheduled);
        return { total: roomList.length, scheduled, available };
    }, [roomList, roomNamesInSchedule]);

    const equipmentStats = useMemo(() => {
        const base = equipmentList.reduce(
            (acc, item) => {
                const status = normalizeText(item?.status);
                if (status === 'available') acc.available += 1;
                if (status === 'maintenance') acc.maintenance += 1;
                if (status === 'in-use' || status === 'busy' || status === 'occupied') acc.inUse += 1;
                return acc;
            },
            { available: 0, maintenance: 0, inUse: 0 }
        );
        return { total: equipmentList.length, ...base };
    }, [equipmentList, normalizeText]);

    const filteredTeachers = useMemo(() => {
        return teacherList.filter((item) => {
            const haystack = [
                item?.displayName,
                item?.fullName,
                item?.name,
                item?.email,
                item?.primaryDepartment,
                Array.isArray(item?.departments) ? item.departments.join(' ') : '',
            ]
                .map(normalizeText)
                .join(' ');
            if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
            const email = normalizeText(item?.email);
            const isScheduled = teacherEmailsInSchedule.has(email);
            if (onlyScheduled && !isScheduled) return false;
            if (onlyAvailable && isScheduled) return false;
            return true;
        });
    }, [teacherList, normalizeText, normalizedSearch, onlyScheduled, onlyAvailable, teacherEmailsInSchedule]);

    const filteredRooms = useMemo(() => {
        return roomList.filter((item) => {
            const haystack = [
                item?.name,
                item?.type,
                item?.building,
                item?.location,
                Array.isArray(item?.tags) ? item.tags.join(' ') : '',
            ]
                .map(normalizeText)
                .join(' ');
            if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
            const scheduled = roomNamesInSchedule.has(asStr(item?.name));
            if (onlyScheduled && !scheduled) return false;
            const status = normalizeText(item?.status);
            const isAvailable = !scheduled && !['maintenance', 'occupied', 'in-use', 'busy'].includes(status);
            if (onlyAvailable && !isAvailable) return false;
            return true;
        });
    }, [roomList, normalizeText, normalizedSearch, onlyScheduled, onlyAvailable, roomNamesInSchedule]);

    const filteredEquipment = useMemo(() => {
        return equipmentList.filter((item) => {
            const haystack = [
                item?.name,
                item?.type,
                item?.location,
                item?.notes,
                item?.assignedTo,
            ]
                .map(normalizeText)
                .join(' ');
            if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
            const status = normalizeText(item?.status);
            const isAvailable = status === 'available';
            const isInUse = ['in-use', 'busy', 'occupied'].includes(status);
            if (onlyAvailable && !isAvailable) return false;
            if (onlyScheduled && !isInUse) return false;
            return true;
        });
    }, [equipmentList, normalizeText, normalizedSearch, onlyAvailable, onlyScheduled]);

    const statsByTab = useMemo(() => ({
        teachers: [
            { label: 'Total', value: teacherStats.total },
            { label: 'Assigned', value: teacherStats.scheduled },
            { label: 'Available', value: teacherStats.available },
        ],
        rooms: [
            { label: 'Total', value: roomStats.total },
            { label: 'Scheduled', value: roomStats.scheduled },
            { label: 'Free', value: roomStats.available },
        ],
        equipment: [
            { label: 'Total', value: equipmentStats.total },
            { label: 'Available', value: equipmentStats.available },
            { label: 'Maintenance', value: equipmentStats.maintenance },
        ],
    }), [teacherStats, roomStats, equipmentStats]);

    const totalsByTab = useMemo(() => ({
        teachers: { visible: filteredTeachers.length, total: teacherList.length },
        rooms: { visible: filteredRooms.length, total: roomList.length },
        equipment: { visible: filteredEquipment.length, total: equipmentList.length },
    }), [filteredTeachers.length, teacherList.length, filteredRooms.length, roomList.length, filteredEquipment.length, equipmentList.length]);

    const toggleLabels = {
        teachers: {
            scheduled: `Assigned (${teacherStats.scheduled})`,
            available: `Available (${teacherStats.available})`,
        },
        rooms: {
            scheduled: `Scheduled (${roomStats.scheduled})`,
            available: `Free (${roomStats.available})`,
        },
        equipment: {
            scheduled: `In use (${equipmentStats.inUse})`,
            available: `Available (${equipmentStats.available})`,
        },
    };

    const placeholderByTab = {
        teachers: 'Search teachers, departments, email…',
        rooms: 'Search rooms, buildings, equipment…',
        equipment: 'Search equipment, locations…',
    };

    const isFiltered = Boolean(normalizedSearch || onlyScheduled || onlyAvailable);
    const emptyMessage = isFiltered ? 'No matching resources' : 'Nothing here';

    const renderStatsChips = () => {
        const chips = statsByTab[activeTab];
        if (!chips?.length) return null;
        return (
            <motion.div
                key={`stats-${activeTab}`}
                className="flex flex-wrap items-center gap-2 px-4 py-2"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {chips.map((chip) => (
                    <Chip key={chip.label} tw="inline-flex items-center gap-2 bg-white/5 border-white/10 px-2.5 py-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{chip.label}</span>
                        <span className="text-sm font-semibold text-foreground">{chip.value}</span>
                    </Chip>
                ))}
            </motion.div>
        );
    };

    const renderFilterControls = () => {
        const totals = totalsByTab[activeTab];
        const toggles = toggleLabels[activeTab] || {};
        return (
            <motion.div
                key={`filters-${activeTab}`}
                className="flex flex-col gap-3 px-4 py-3 border-b border-border/70"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Input
                    leadingIcon="Search"
                    placeholder={placeholderByTab[activeTab] || 'Search resources…'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                />
                <div className="flex flex-wrap items-center gap-2">
                    {toggles.scheduled && (
                        <Button
                            size="sm"
                            variant={onlyScheduled ? 'default' : 'outline'}
                            onClick={() => setOnlyScheduled((prev) => !prev)}
                            iconName="CalendarDays"
                        >
                            {toggles.scheduled}
                        </Button>
                    )}
                    {toggles.available && (
                        <Button
                            size="sm"
                            variant={onlyAvailable ? 'default' : 'outline'}
                            onClick={() => setOnlyAvailable((prev) => !prev)}
                            iconName="Sparkles"
                        >
                            {toggles.available}
                        </Button>
                    )}
                    {totals && (
                        <span className="ml-auto text-[11px] text-muted-foreground">
                            Showing {totals.visible} / {totals.total}
                        </span>
                    )}
                </div>
            </motion.div>
        );
    };

    const contextBar = (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/70 bg-muted/25 text-[11px] text-muted-foreground">
            <Icon name="Calendar" size={12} />
            <span className="whitespace-nowrap">
        {safeDate.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}
      </span>
            <span className="ml-2 flex items-center gap-1">
        <Chip>slots {slotsCount}</Chip>
        <Chip>entries {schedCount}</Chip>
      </span>
        </div>
    );

    if (isPinned) {
        const quickStats = [
            { icon: 'Users', label: 'Teachers', value: teacherStats.total },
            { icon: 'Building', label: 'Rooms', value: roomStats.total },
            { icon: 'Monitor', label: 'Gear', value: equipmentStats.total },
        ];
            return (
            <aside
                style={{ top: 'calc(var(--hdr-h, 4rem) + env(safe-area-inset-top, 0px))' }}
                className={`resource-panel fixed right-0 bottom-0 z-40 overflow-hidden flex flex-col transition-[width] duration-300 ease-out ${
                    isCollapsed ? 'w-16' : 'w-96'
                }`}
            >
                {isCollapsed ? (
                    <div className="flex flex-col items-center py-4 gap-5 h-full">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggle}
                            aria-label="Expand resources"
                            className="rounded-full bg-white/5 hover:bg-white/10"
                        >
                            <Icon name="PanelRightOpen" size={18} />
                        </Button>
                        <div className="flex flex-col items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                            {quickStats.map((item) => (
                                <div key={item.label} className="flex flex-col items-center gap-1">
                                    <Icon name={item.icon} size={16} className="text-primary" />
                                    <span className="text-sm font-semibold text-foreground">{item.value}</span>
                                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground/80">{item.label}</span>
                        </div>
                            ))}
                    </div>
                </div>
                ) : (
                <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-4 border-b border-border/70">
                        <h3 className="text-lg font-semibold text-foreground">Resources</h3>
                        <Button variant="ghost" size="icon" onClick={onToggle}>
                            <Icon name="ChevronRight" size={16} />
                        </Button>
                    </div>

                        <div className="flex border-b border-border/70 sticky top-0 bg-card z-10">
                            {tabs.map((tab) => {
                                const active = activeTab === tab.id;
                                return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium relative transition ${active ? 'text-primary' : 'text-muted-foreground'}`}
                                        aria-current={active ? 'page' : undefined}
                                    >
                                        {active && <span className="absolute inset-0 rounded-none border-b-2 border-primary bg-primary/10" />}
                                        <span className="relative z-10 flex items-center gap-2 text-xs sm:text-sm">
                                <Icon name={tab.icon} size={16} />
                                <span className="truncate">{tab.label}</span>
                                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tab.count}</span>
                                        </span>
                            </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/70 bg-muted/25 text-[11px] text-muted-foreground">
                            <Icon name="Calendar" size={12} />
                            <span className="whitespace-nowrap">
                                {safeDate.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}
                            </span>
                            <span className="ml-2 flex items-center gap-1">
                                <Chip>slots {slotsCount}</Chip>
                                <Chip>entries {schedCount}</Chip>
                            </span>
                    </div>

                        {renderStatsChips()}
                        {renderFilterControls()}

                        <div className="resource-scroll flex-1 overflow-y-auto overflow-x-hidden p-4 overscroll-contain space-y-3">
                        {activeTab === 'teachers' &&
                                (filteredTeachers.length ? (
                                <div className="space-y-3">
                                        {filteredTeachers.map((t, i) => (
                                        <TeacherCard key={t.email || t.id || `teacher-${i}`} data={t} onClick={handleResourceSelect} scheduleData={scheduleData} userRole={userRole} isBlocked={isBlocked} />
                                    ))}
                                </div>
                            ) : (
                                    <div className="text-xs text-muted-foreground">{emptyMessage}</div>
                            ))}

                        {activeTab === 'rooms' &&
                                (filteredRooms.length ? (
                                <div className="space-y-3">
                                        {filteredRooms.map((r, i) => (
                                        <RoomCard
                                            key={r.name || r.id || `room-${i}`}
                                            data={r}
                                            onClick={handleResourceSelect}
                                            equipmentList={equipmentList}
                                            scheduleData={scheduleData}
                                            isBlocked={isBlocked}
                                        />
                                    ))}
                                </div>
                            ) : (
                                    <div className="text-xs text-muted-foreground">{emptyMessage}</div>
                            ))}

                        {activeTab === 'equipment' &&
                                (filteredEquipment.length ? (
                                <div className="space-y-3">
                                        {filteredEquipment.map((e, i) => (
                                        <EquipmentCard key={e.id || `${e.name}-${i}`} data={e} onClick={handleResourceSelect} scheduleData={scheduleData} isBlocked={isBlocked} />
                                    ))}
                                </div>
                            ) : (
                                    <div className="text-xs text-muted-foreground">{emptyMessage}</div>
                            ))}
                    </div>
                        </div>
                )}
            </aside>
        );
    }

    return (
        <>
            <AnimatePresence>
                {drawerOpen && (
                    <motion.aside
                role="dialog"
                aria-label="Resources"
                aria-modal="true"
                        style={{ top: 'calc(var(--hdr-h, 4rem) + env(safe-area-inset-top, 0px))' }}
                        className="resource-panel fixed right-0 bottom-0 z-[60] w-[min(92vw,420px)] max-w-sm"
                        initial={{ x: '100%', opacity: 0.6 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Icon name="Layers" size={16} className="text-muted-foreground" />
                            <h3 className="text-base font-semibold text-foreground">Resources</h3>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Close resources">
                            <Icon name="X" size={18} />
                        </Button>
                    </div>

                    <div className="flex border-b border-border sticky top-0 bg-card z-10">
                        {tabs.map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                                <motion.button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                    className="flex-1 min-w-0 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-medium relative"
                                    whileHover={{ y: -1.5 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="resource-tab-mobile"
                                            className="absolute inset-0 border-b-2 border-primary bg-primary/10"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-2 text-xs sm:text-sm">
                                        <Icon name={tab.icon} size={16} className={active ? 'text-primary' : 'text-muted-foreground'} />
                                        <span className={`truncate ${active ? 'text-primary' : 'text-muted-foreground'}`}>{tab.label}</span>
                                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{tab.count}</span>
                                    </span>
                                </motion.button>
                            );
                        })}
                    </div>

                    {contextBar}

                    {renderStatsChips()}
                    {renderFilterControls()}

                    <motion.div
                        layout
                        className="resource-scroll flex-1 overflow-y-auto p-4 space-y-3"
                    >
                        {activeTab === 'teachers' &&
                            (filteredTeachers.length ? (
                                <motion.div layout className="space-y-3">
                                    {filteredTeachers.map((t, i) => (
                                        <TeacherCard
                                            key={t.email || t.id || `teacher-${i}`}
                                            data={t}
                                            scheduleData={scheduleData}
                                            userRole={userRole}
                                            onClick={(type, payload) =>
                                                handleResourceSelect(type, payload, { shouldCloseDrawer: true })
                                            }
                                            isBlocked={isBlocked}
                                        />
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="text-xs text-muted-foreground">{emptyMessage}</div>
                            ))}

                        {activeTab === 'rooms' &&
                            (filteredRooms.length ? (
                                <motion.div layout className="space-y-3">
                                    {filteredRooms.map((r, i) => (
                                        <RoomCard
                                            key={r.name || r.id || `room-${i}`}
                                            data={r}
                                            onClick={(type, payload) =>
                                                handleResourceSelect(type, payload, { shouldCloseDrawer: true })
                                            }
                                            equipmentList={equipmentList}
                                            scheduleData={scheduleData}
                                            isBlocked={isBlocked}
                                        />
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="text-xs text-muted-foreground">{emptyMessage}</div>
                            ))}

                        {activeTab === 'equipment' &&
                            (filteredEquipment.length ? (
                                <motion.div layout className="space-y-3">
                                    {filteredEquipment.map((e, i) => (
                                        <EquipmentCard
                                            key={e.id || `${e.name}-${i}`}
                                            data={e}
                                            onClick={(type, payload) =>
                                                handleResourceSelect(type, payload, { shouldCloseDrawer: true })
                                            }
                                            scheduleData={scheduleData}
                                            isBlocked={isBlocked}
                                        />
                                    ))}
                                </motion.div>
                            ) : (
                                <div className="text-xs text-muted-foreground">{emptyMessage}</div>
                            ))}

                        <div className="pt-6" />
                    </motion.div>

                    <div className="p-4 border-t border-border/70 bg-card/80">
                        <Button
                            className="w-full"
                            variant="outline"
                            onClick={onToggle}
                            aria-label="Close resources"
                        >
                            <Icon name="ChevronLeft" size={16} />
                            Close
                        </Button>
                        </div>
                    </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {!drawerOpen && (
                <button
                    onClick={onToggle}
                    aria-label="Open resources"
                    style={{ top: 'calc(var(--hdr-h, 4rem) + env(safe-area-inset-top, 0px) + 12px)' }}
                    className="fixed right-3 z-[55] inline-flex items-center justify-center rounded-full border border-border/70 bg-card/80 shadow-lg w-11 h-11 text-foreground transition hover:bg-card"
                >
                    <Icon name="PanelRightOpen" size={18} />
                </button>
            )}
        </>
    );
};

export default ResourcePanel;