// src/pages/final-thesis/components/modals/ModalBase.jsx
import React from 'react';
import Icon from '../../../../components/AppIcon';
import Button from '../../../../components/ui/Button';

export default function ModalBase({ open, title, subtitle, onClose, children, footer }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-110 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-6 pb-24 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-background/80 backdrop-blur-sm" onClick={onClose} />
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block w-full max-w-[100vw] sm:max-w-3xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-card shadow-modal rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 border-b border-border bg-card sticky top-0 z-20">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">{title}</h3>
                            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="flex-shrink-0">
                            <Icon name="X" size={22} />
                        </Button>
                    </div>
                    <div className="px-4 sm:px-5 md:px-8 py-5 md:py-8 max-h-[68vh] sm:max-h-[66vh] overflow-y-auto thin-scrollbar">
                        {children}
                    </div>
                    {footer && (
                        <div className="px-4 sm:px-6 md:px-8 py-3 md:py-5 border-t border-border bg-card sticky bottom-0">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                                {footer}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}