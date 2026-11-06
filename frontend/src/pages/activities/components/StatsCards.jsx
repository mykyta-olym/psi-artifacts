import React from 'react';
import { motion } from 'framer-motion';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';

const StatsCards = ({ stats }) => {
    const isBlocked = useGlobalLoaderBlocking();
    const items = [
        { key: 'submissions', label: 'SUBMISSIONS', value: stats?.byType?.find(x => x.type === 'submissions')?.count ?? 0 },
        { key: 'communications', label: 'MESSAGES', value: stats?.byType?.find(x => x.type === 'communications')?.count ?? 0 },
        { key: 'attendance', label: 'ATTENDANCE', value: stats?.byType?.find(x => x.type === 'attendance')?.count ?? 0 },
        { key: 'grades', label: 'GRADES', value: stats?.byType?.find(x => x.type === 'grades')?.count ?? 0 },
        { key: 'announcements', label: 'ANNOUNCEMENTS', value: stats?.byType?.find(x => x.type === 'announcements')?.count ?? 0 },
        { key: 'schedule', label: 'SCHEDULE', value: stats?.byType?.find(x => x.type === 'schedule')?.count ?? 0 },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((card, idx) => (
                <motion.div
                    key={card.key}
                    initial={{ opacity: 0, y: 16, rotateX: 45, scale: 0.95 }}
                    animate={isBlocked 
                        ? { opacity: 0, y: 16, rotateX: 45, scale: 0.95 }
                        : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                    transition={{ duration: 0.35, delay: isBlocked ? 0 : ANIMATION_DELAYS.SUMMARY_CARDS + idx * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
                    style={{ transformOrigin: 'center bottom', perspective: '1000px' }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileTap={{ scale: 0.995 }}
                    className="metric-card w-full"
                >
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{card.label}</div>
                    <div className="text-2xl font-semibold text-foreground">{card.value}</div>
                </motion.div>
            ))}
        </div>
    );
};

export default StatsCards;