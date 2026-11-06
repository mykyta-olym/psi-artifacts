// src/components/ui/ModalBase.jsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, MotionConfig } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

/**
 * Base modal component with consistent styling across the application
 * Matches the design from ScheduleModal
 */
export default function ModalBase({ 
  open, 
  title, 
  subtitle, 
  onClose, 
  children, 
  footer,
  maxWidth = 'max-w-[800px]',
  className = '',
  contentClassName = '',
}) {
  const modalRef = useRef(null);
  
  // Close on ESC key
  useEffect(() => {
    if (!open) return;
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <MotionConfig transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
      <div className="fixed inset-0 z-110 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4 pt-6 pb-24 text-center sm:block sm:p-0">
          <motion.div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={`relative inline-block w-full ${maxWidth} my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border ${className}`}
            style={{ maxHeight: 'min(95vh, 900px)' }}
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 sm:py-4.5 border-b border-border sticky top-0 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <div className="min-w-0">
                <h3 id="modal-title" className="text-base sm:text-lg font-semibold text-foreground">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="rounded-lg">
                <Icon name="X" size={20} />
              </Button>
            </div>
            
            {/* Content */}
            <div className={`px-5 sm:px-7 py-4 overflow-y-auto ${contentClassName}`} style={{ maxHeight: 'calc(min(95vh, 900px) - 160px)' }}>
              {children}
            </div>
            
            {/* Footer */}
            {footer && (
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-t border-border sticky bottom-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  {footer}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </MotionConfig>,
    document.body
  );
}
