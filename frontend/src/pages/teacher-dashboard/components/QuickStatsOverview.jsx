import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';

const QuickStatsOverview = ({ statsData, onScrollToMyClasses, onNavigateToPendingGrades }) => {
  const navigate = useNavigate();
  const isBlocked = useGlobalLoaderBlocking();

  const stats = [
    {
      id: 'total-students',
      label: 'Total Students',
      value: statsData?.totalStudents,
      icon: 'Users',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: statsData?.studentChange,
      onClick: () => navigate('/student-management'),
      unit: null
    },
    {
      id: 'classes-today',
      label: 'Classes Today',
      value: statsData?.classesToday,
      icon: 'Calendar',
      color: 'text-success',
      bgColor: 'bg-success/10',
      change: null,
      onClick: onScrollToMyClasses || (() => navigate('/class-schedule-management')),
      unit: null
    },
    {
      id: 'pending-grades',
      label: 'Pending Grades',
      value: statsData?.pendingGrades,
      icon: 'BookOpen',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      change: statsData?.gradeChange,
      onClick: onNavigateToPendingGrades || (() => navigate('/grade-management')),
      unit: null
    },
    {
      id: 'attendance-rate',
      label: 'Attendance Rate',
      value: statsData?.attendanceRate,
      icon: 'CheckSquare',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      change: statsData?.attendanceChange,
      onClick: () => navigate('/attendance-tracking'),
      unit: '%'
    }
  ];

  const changeColor = (c) => (!c ? '' : c > 0 ? 'text-success' : 'text-error');
  const changeIcon  = (c) => (!c ? null : c > 0 ? 'TrendingUp' : 'TrendingDown');

  return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" aria-label="Quick stats">
        {stats.map((s, idx) => {
          const isValueAvailable = typeof s.value === 'number' && Number.isFinite(s.value);
          const displayValue = isValueAvailable ? (s.unit ? `${s.value}${s.unit}` : s.value) : '—';
          // Allow click if onClick function exists (regardless of value)
          const canClick = typeof s.onClick === 'function';

          return (
            <motion.button
                key={s.id}
                onClick={canClick ? s.onClick : undefined}
                disabled={!canClick}
                aria-disabled={!canClick}
                className={`group metric-card text-left w-full ${canClick ? 'cursor-pointer' : 'cursor-default opacity-95'}`}
                initial={{ opacity: 0, y: 16, rotateX: 45, scale: 0.95 }}
                animate={isBlocked 
                    ? { opacity: 0, y: 16, rotateX: 45, scale: 0.95 }
                    : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: isBlocked ? 0 : ANIMATION_DELAYS.SUMMARY_CARDS + idx * ANIMATION_DELAYS.STEP, ease: 'easeOut' }}
                style={{ transformOrigin: 'center bottom', perspective: '1000px' }}
                whileHover={canClick ? { y: -2 } : {}}
                whileTap={canClick ? { scale: 0.995 } : {}}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg ${s.bgColor} flex items-center justify-center transform transition-transform duration-200 ${canClick ? 'group-hover:scale-105' : ''}`}>
                  <Icon name={s.icon} size={24} className={s.color} />
                </div>

                {s.change !== null && (
                    <div className={`flex items-center gap-1 ${changeColor(s.change)}`}>
                      {changeIcon(s.change) && <Icon name={changeIcon(s.change)} size={14} />}
                      <span className="text-xs font-medium">{Math.abs(s.change)}%</span>
                    </div>
                )}
              </div>

              <div>
                <div className="text-2xl font-bold text-foreground mb-1 truncate">{displayValue}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>

              <div
                  aria-hidden="true"
                  className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />
            </motion.button>
          );
        })}
      </div>
  );
};

export default QuickStatsOverview;