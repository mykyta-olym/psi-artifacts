// src/pages/Schedule/components/ScheduleStats.jsx
import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';

const normalizeMetric = (raw, defaults = {}) => {
    if (raw == null) return { value: 0, delta: 0, deltaKind: 'flat', caption: '', ...defaults };
    if (typeof raw === 'number' || typeof raw === 'string') {
        return { value: raw, delta: 0, deltaKind: 'flat', caption: '', ...defaults };
    }
    return { deltaKind: 'flat', caption: '', ...defaults, ...raw };
};

const TrendBadge = ({ kind = 'flat', text = '' }) => {
    const map = {
        up:   { tw: 'text-success bg-success/10 border-success/20',   icon: 'TrendingUp' },
        down: { tw: 'text-error bg-error/10 border-error/20',         icon: 'TrendingDown' },
        flat: { tw: 'text-muted-foreground bg-muted border-border',   icon: 'Minus' }
    };
    const m = map[kind] || map.flat;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-medium ${m.tw}`}>
      <Icon name={m.icon} size={12} />
            {text}
    </span>
    );
};

const StatCard = ({ title, metric, goodWhenLower = false, icon, index = 0, isBlocked = false }) => {
    const m = normalizeMetric(metric);
    const valueWithUnit = `${m.value}${m.unit || ''}`;
    let deltaText;
    if (m.note) {
        deltaText = m.note;
    } else {
        const sign = m.delta > 0 ? '+' : (m.delta < 0 ? '' : '±');
        const unit = m.deltaUnit || '';
        deltaText = Number(m.delta) === 0 ? '0' : `${sign}${m.delta}${unit}`;
    }
    const computedKind = m.deltaKind || (Number(m.delta) === 0 ? 'flat' : (m.delta > 0 ? 'up' : 'down'));
    const visualKind = goodWhenLower
        ? (computedKind === 'up' ? 'down' : computedKind === 'down' ? 'up' : 'flat')
        : computedKind;

    return (
        <motion.div
            className="metric-card w-full p-3 sm:p-4"
            initial={{ opacity: 0, y: 16, rotateX: 45, scale: 0.95 }}
            animate={isBlocked 
                ? { opacity: 0, y: 16, rotateX: 45, scale: 0.95 }
                : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            style={{ transformOrigin: 'center bottom', perspective: '1000px' }}
            transition={{ duration: 0.35, delay: isBlocked ? 0 : ANIMATION_DELAYS.SUMMARY_CARDS + index * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
        >
            <div className="flex items-center justify-between mb-1">
                <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
                {icon && <Icon name={icon} size={16} className="text-muted-foreground" />}
            </div>
            <div className="flex items-end justify-between gap-3">
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground">{valueWithUnit}</h3>
                {(m.caption || m.delta !== undefined) ? <TrendBadge kind={visualKind} text={m.caption || deltaText} /> : null}
            </div>
            {!!m.captionExtra && <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">{m.captionExtra}</p>}
        </motion.div>
    );
};

// Простенька картка для студентських метрик із явними текстами
const StudentStatCard = ({ title, value, icon, sub, badge, index = 0, isBlocked = false }) => (
    <motion.div
        className="metric-card w-full p-3 sm:p-4"
        initial={{ opacity: 0, y: 16, rotateX: 45, scale: 0.95 }}
        animate={isBlocked 
            ? { opacity: 0, y: 16, rotateX: 45, scale: 0.95 }
            : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        style={{ transformOrigin: 'center bottom', perspective: '1000px' }}
        transition={{ duration: 0.35, delay: isBlocked ? 0 : ANIMATION_DELAYS.SUMMARY_CARDS + index * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
    >
        <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
                {badge ? (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] font-medium ${badge.tw || ''}`}>
                        {badge.icon ? <Icon name={badge.icon} size={12} /> : null}
                        {badge.text}
                    </span>
                ) : null}
                {icon && <Icon name={icon} size={16} className="text-muted-foreground" />}
            </div>
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-foreground">{value}</h3>
        {sub ? <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">{sub}</p> : null}
    </motion.div>
);

const ScheduleStats = ({ stats = {}, userRole = 'teacher' }) => {
    const isBlocked = useGlobalLoaderBlocking();
    
    if (userRole === 'student') {
        // очікувані/опційні поля
        const {
            classesThisWeek = 0,
            classesToday = 0,
            nextClass = null,                 // { label, inMins, room }
            coursesThisWeek = 0,

            // опційні поля для повної заповненості та вільних слотів
            totalSlotsWeek,
            totalSlotsToday,
            freeSlotsWeek,
            freeSlotsToday,
            firstFreeSlotLabel,
            isWeekendToday = false,
            dayName,
        } = stats || {};

        const hasTodayTotals = typeof totalSlotsToday === 'number' && totalSlotsToday > 0;
        const hasWeekTotals  = typeof totalSlotsWeek === 'number' && totalSlotsWeek > 0;
        const fullToday = hasTodayTotals ? classesToday >= totalSlotsToday : false;
        const fullWeek  = hasWeekTotals ? classesThisWeek >= totalSlotsWeek : false;

        // Badge стилі
        const badgeSuccess = { tw: 'text-success bg-success/10 border-success/20', icon: 'Check' };
        const badgeWarn    = { tw: 'text-warning bg-warning/10 border-warning/20', icon: 'AlertTriangle' };
        const badgeInfo    = { tw: 'text-muted-foreground bg-muted border-border', icon: 'Info' };

        // 1) Classes this week
        let weekValue = '';
        let weekSub = '';
        let weekBadge = null;
        if (classesThisWeek === 0) {
            weekValue = 'No classes this week';
            weekSub = hasWeekTotals ? `0/${totalSlotsWeek} slots used` : '';
            weekBadge = hasWeekTotals ? { ...badgeInfo, text: 'Empty week' } : null;
        } else {
            weekValue = hasWeekTotals ? `${classesThisWeek} classes` : `${classesThisWeek} classes`;
            weekSub = hasWeekTotals ? `${classesThisWeek}/${totalSlotsWeek} slots used` : 'This week';
            weekBadge = hasWeekTotals
                ? (fullWeek ? { ...badgeWarn, text: 'Fully booked week' } : { ...badgeSuccess, text: 'Has free slots' })
                : null;
        }

        // 2) Today
        let todayValue = '';
        let todaySub = '';
        let todayBadge = null;
        if (isWeekendToday) {
            todayValue = 'Weekend';
            todaySub = 'No classes scheduled today';
            todayBadge = { ...badgeInfo, text: 'Relax' };
        } else if (classesToday === 0) {
            todayValue = 'No classes today';
            todaySub = dayName ? dayName : 'Today';
            todayBadge = { ...badgeInfo, text: 'Empty day' };
        } else {
            if (hasTodayTotals) {
                const free = Math.max(0, totalSlotsToday - classesToday);
                todayValue = `${classesToday} class${classesToday === 1 ? '' : 'es'} today`;
                if (fullToday) {
                    todaySub = 'Fully booked today';
                    todayBadge = { ...badgeWarn, text: 'No free slots' };
                } else {
                    todaySub = free === 1 ? '1 free slot today' : `${free} free slots today`;
                    todayBadge = { ...badgeSuccess, text: 'Has free slots' };
                }
            } else {
                todayValue = `${classesToday} class${classesToday === 1 ? '' : 'es'} today`;
                todaySub = 'Some slots may be free';
                todayBadge = { ...badgeInfo, text: 'Partial data' };
            }
        }

        // 3) Next class
        let nextValue = '';
        let nextSub = '';
        if (nextClass) {
            if (nextClass.inMins > 0) {
                nextValue = `Starts in ${nextClass.inMins} min`;
            } else {
                nextValue = 'In progress';
            }
            nextSub = `${nextClass.label}${nextClass.room ? ` — ${nextClass.room}` : ''}`;
        } else if (!isWeekendToday && classesToday > 0) {
            nextValue = 'No more classes today';
            nextSub = '';
        } else {
            nextValue = 'No upcoming classes';
            nextSub = 'Check week view';
        }

        // 4) Courses
        const coursesValue = coursesThisWeek === 0 ? 'No courses this week' : `${coursesThisWeek} course${coursesThisWeek === 1 ? '' : 's'}`;
        const coursesSub = coursesThisWeek === 0 ? '' : 'Unique courses';

        // 5) Free slots card (опціонально)
        const showFreeCard =
            typeof freeSlotsToday === 'number' ||
            typeof freeSlotsWeek === 'number' ||
            typeof firstFreeSlotLabel === 'string' ||
            hasTodayTotals ||
            hasWeekTotals;

        let freeValue = '';
        let freeSub = '';
        let freeBadge = null;

        if (showFreeCard) {
            const todayKnown = typeof freeSlotsToday === 'number' || hasTodayTotals;
            const weekKnown  = typeof freeSlotsWeek === 'number'  || hasWeekTotals;

            const todayFree = typeof freeSlotsToday === 'number'
                ? Math.max(0, freeSlotsToday)
                : (hasTodayTotals ? Math.max(0, (totalSlotsToday || 0) - (classesToday || 0)) : null);

            const weekFree = typeof freeSlotsWeek === 'number'
                ? Math.max(0, freeSlotsWeek)
                : (hasWeekTotals ? Math.max(0, (totalSlotsWeek || 0) - (classesThisWeek || 0)) : null);

            if (todayKnown && weekKnown && todayFree != null && weekFree != null) {
                freeValue = `${todayFree} free today / ${weekFree} this week`;
            } else if (todayKnown && todayFree != null) {
                freeValue = `${todayFree} free today`;
            } else if (weekKnown && weekFree != null) {
                freeValue = `${weekFree} free this week`;
            } else {
                freeValue = 'No free slot data';
            }

            if (firstFreeSlotLabel) {
                freeSub = `Next free: ${firstFreeSlotLabel}`;
            } else if (todayFree === 0 && !isWeekendToday) {
                freeSub = 'Fully booked today';
            } else if (weekFree === 0) {
                freeSub = 'Fully booked week';
            } else {
                freeSub = freeSub || '';
            }

            if (todayFree === 0 || weekFree === 0) {
                freeBadge = { ...badgeWarn, text: 'Busy schedule' };
            } else if (todayFree > 0 || weekFree > 0) {
                freeBadge = { ...badgeSuccess, text: 'Available time' };
            } else {
                freeBadge = { ...badgeInfo, text: 'Unknown' };
            }
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                <StudentStatCard
                    title="Classes this week"
                    value={weekValue}
                    icon="Layers"
                    sub={weekSub}
                    badge={weekBadge}
                    index={0}
                    isBlocked={isBlocked}
                />
                <StudentStatCard
                    title="Today"
                    value={todayValue}
                    icon="Calendar"
                    sub={todaySub}
                    badge={todayBadge}
                    index={1}
                    isBlocked={isBlocked}
                />
                <StudentStatCard
                    title="Next class"
                    value={nextValue}
                    sub={nextSub}
                    icon="Clock"
                    index={2}
                    isBlocked={isBlocked}
                />
                <StudentStatCard
                    title="Courses"
                    value={coursesValue}
                    sub={coursesSub}
                    icon="BookOpen"
                    index={3}
                    isBlocked={isBlocked}
                />
                {showFreeCard && (
                    <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                        <StudentStatCard
                            title="Free slots"
                            value={freeValue}
                            sub={freeSub}
                            icon="Clock3"
                            badge={freeBadge}
                            index={4}
                            isBlocked={isBlocked}
                        />
                    </div>
                )}
            </div>
        );
    }

    // teacher variant
    const totalClasses    = normalizeMetric(stats.totalClasses);
    const activeTeachers  = normalizeMetric(stats.activeTeachers);
    const roomUtilization = normalizeMetric(stats.roomUtilization, { unit: '%' });
    const conflicts       = normalizeMetric(stats.conflicts);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
            <StatCard title="Total Classes"      metric={totalClasses}    icon="Layers" index={0} isBlocked={isBlocked} />
            <StatCard title="Active Teachers"    metric={activeTeachers}  icon="UserCheck" index={1} isBlocked={isBlocked} />
            <StatCard title="Room Utilization"   metric={roomUtilization} icon="Activity" index={2} isBlocked={isBlocked} />
            <StatCard title="Schedule Conflicts" metric={conflicts}       icon="AlertTriangle" goodWhenLower index={3} isBlocked={isBlocked} />
        </div>
    );
};

export default ScheduleStats;