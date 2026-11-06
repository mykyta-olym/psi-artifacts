import React, { useMemo, useId } from 'react';
import { motion, LayoutGroup, MotionConfig, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

const buildRange = (currentPage, totalPages) => {
    if (!totalPages || totalPages <= 0) return [];
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }
    const range = [1];
    if (currentPage > 3) range.push('left-ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i += 1) {
        if (!range.includes(i)) range.push(i);
    }
    if (currentPage < totalPages - 2) range.push('right-ellipsis');
    range.push(totalPages);
    return range;
};

const navButtonClasses = 'relative inline-flex items-center justify-center h-9 rounded-full px-3 text-xs font-medium uppercase tracking-wide transition-all duration-200 backdrop-blur';
const numberButtonClasses = 'relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-sm font-medium transition-all duration-200';

const Pagination = ({ currentPage = 1, totalPages = 1, onChange, className = '' }) => {
    const layoutId = useId();
    const range = useMemo(() => buildRange(currentPage, totalPages), [currentPage, totalPages]);

    if (totalPages <= 1) return null;

    const goTo = (page) => {
        if (typeof onChange !== 'function') return;
        if (page < 1 || page > totalPages || page === currentPage) return;
        onChange(page);
    };

    const renderPageButton = (value, idx) => {
        if (value === 'left-ellipsis' || value === 'right-ellipsis') {
            return (
                <motion.span
                    key={`${value}-${idx}`}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="px-2 text-xs text-muted-foreground select-none"
                >
                    …
                </motion.span>
            );
        }
        const isActive = currentPage === value;
        return (
            <motion.button
                key={value}
                layout
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Page ${value}`}
                onClick={() => goTo(value)}
                className={cn(
                    numberButtonClasses,
                    'border border-white/5 bg-card/70 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                )}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
            >
                {isActive && (
                    <motion.span
                        layoutId={`${layoutId}-active`}
                        className="absolute inset-0 rounded-lg border border-primary/45 bg-gradient-to-br from-primary/25 via-primary/15 to-transparent shadow-[0_12px_30px_rgba(96,165,250,0.32)]"
                        transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.7 }}
                    />
                )}
                <span className="relative z-10 text-sm font-semibold text-foreground">{value}</span>
            </motion.button>
        );
    };

    return (
        <MotionConfig transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex items-center gap-2 flex-wrap', className)}
            >
                <LayoutGroup>
                    <motion.button
                        layout
                        type="button"
                        onClick={() => goTo(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={cn(
                            navButtonClasses,
                            'border border-white/5 bg-card/70 text-muted-foreground hover:text-foreground hover:border-primary/35 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            currentPage === 1 && 'opacity-40 pointer-events-none'
                        )}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Previous
                    </motion.button>

                    <AnimatePresence initial={false} mode="popLayout">
                        {range.map((value, idx) => renderPageButton(value, idx))}
                    </AnimatePresence>

                    <motion.button
                        layout
                        type="button"
                        onClick={() => goTo(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={cn(
                            navButtonClasses,
                            'border border-white/5 bg-card/70 text-muted-foreground hover:text-foreground hover:border-primary/35 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            currentPage === totalPages && 'opacity-40 pointer-events-none'
                        )}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        Next
                    </motion.button>
                </LayoutGroup>
            </motion.div>
        </MotionConfig>
    );
};

export default Pagination;
