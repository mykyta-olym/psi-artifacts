// src/pages/attendance-tracking/components/AttendanceStats.jsx
import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import { cn } from '../../../utils/cn';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';

const AttendanceStats = ({ stats, selectedClass, userRole }) => {
  const isBlocked = useGlobalLoaderBlocking();
  const statCards = [
    {
      title: 'Present',
      value: stats?.present,
      total: stats?.total,
      percentage: stats?.total > 0 ? Math.round((stats?.present / stats?.total) * 100) : 0,
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20'
    },
    {
      title: 'Absent',
      value: stats?.absent,
      total: stats?.total,
      percentage: stats?.total > 0 ? Math.round((stats?.absent / stats?.total) * 100) : 0,
      icon: 'XCircle',
      color: 'text-error',
      bgColor: 'bg-error/10',
      borderColor: 'border-error/20'
    },
    {
      title: 'Late',
      value: stats?.late,
      total: stats?.total,
      percentage: stats?.total > 0 ? Math.round((stats?.late / stats?.total) * 100) : 0,
      icon: 'Clock',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20'
    },
    {
      title: 'Excused',
      value: stats?.excused,
      total: stats?.total,
      percentage: stats?.total > 0 ? Math.round((stats?.excused / stats?.total) * 100) : 0,
      icon: 'Shield',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      borderColor: 'border-accent/20'
    }
  ];

  if (userRole === 'teacher') {
    statCards.push({
      title: 'Chronic Absences',
      value: stats?.chronicAbsences || 0,
      total: stats?.total,
      percentage: stats?.total > 0 ? Math.round(((stats?.chronicAbsences || 0) / stats?.total) * 100) : 0,
      icon: 'AlertTriangle',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/20'
    });
  }

  return (
      <>
        {selectedClass && (
            <div
                className="mb-3 inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                aria-label="Selected class"
            >
              <Icon name="Hash" size={14} />
              <span className="font-medium text-foreground">Class:</span>
              <span className="truncate max-w-[40ch]">{String(selectedClass)}</span>
            </div>
        )}

        <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-6"
            data-selected-class={selectedClass ?? undefined}
        >
          {statCards?.map((stat, index) => (
              <motion.div
                  key={index}
                  className={cn('metric-card w-full p-3 sm:p-4', stat?.borderColor)}
                  initial={{ opacity: 0, y: 16, rotateX: 45, scale: 0.95 }}
                  animate={isBlocked 
                      ? { opacity: 0, y: 16, rotateX: 45, scale: 0.95 }
                      : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                  style={{ transformOrigin: 'center bottom', perspective: '1000px' }}
                  transition={{ duration: 0.35, delay: isBlocked ? 0 : ANIMATION_DELAYS.SUMMARY_CARDS + index * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.995 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${stat?.bgColor}`}>
                    <Icon name={stat?.icon} size={16} className={stat?.color} />
                  </div>
                  <span className="text-[11px] sm:text-xs text-muted-foreground">
                {stat?.percentage}%
              </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{stat?.value}</p>
                  <p className="text-xs text-muted-foreground">{stat?.title}</p>
                  {stat?.total > 0 && (
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${stat?.color?.replace('text-', 'bg-')}`}
                            style={{ width: `${stat?.percentage}%` }}
                        />
                      </div>
                  )}
                </div>
              </motion.div>
          ))}
        </div>
      </>
  );
};

export default AttendanceStats;