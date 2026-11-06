// src/pages/final-thesis/components/Metric.jsx
import React from 'react';
import { motion } from 'framer-motion';
import useGlobalLoaderBlocking from '../../../hooks/useGlobalLoaderBlocking';
import { ANIMATION_DELAYS } from '../../../constants/animations';

export default function Metric({ label, value, sub, delay = 0 }) {
    const isBlocked = useGlobalLoaderBlocking();
    return (
        <motion.div
            initial={{ opacity: 0, y: 16, rotateX: 45, scale: 0.95 }}
            animate={isBlocked 
                ? { opacity: 0, y: 16, rotateX: 45, scale: 0.95 }
                : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            transition={{ duration: 0.35, delay: isBlocked ? 0 : delay, ease: 'easeOut' }}
            style={{ transformOrigin: 'center bottom', perspective: '1000px' }}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.995 }}
            className="metric-card w-full"
        >
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
            <div className="text-2xl font-semibold text-foreground">{value}</div>
            {sub ? <div className="mt-3 text-xs text-muted-foreground leading-snug">{sub}</div> : null}
        </motion.div>
    );
}