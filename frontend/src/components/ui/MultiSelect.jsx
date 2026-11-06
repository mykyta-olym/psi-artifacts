// src/components/ui/MultiSelect.jsx
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import Input from './Input';

const POS = { DOWN: 'down', UP: 'up' };

/**
 * MultiSelect component with chip-based selection matching Select styling
 * @param {string} label - Label for the input
 * @param {Array<string>} value - Selected values
 * @param {Function} onChange - Callback when values change
 * @param {Array<{value: string, label: string}>} options - Available options
 * @param {string} placeholder - Placeholder text
 * @param {boolean} disabled - Whether the input is disabled
 * @param {boolean} required - Whether the field is required
 * @param {string} error - Error message
 * @param {string} description - Description text
 * @param {boolean} searchable - Enable search functionality
 * @param {string} className - Additional CSS classes
 * @param {string} size - Size variant: 'sm', 'md', 'lg'
 */
const MultiSelect = ({
    label,
    value = [],
    onChange,
    options = [],
    placeholder = 'Select...',
    disabled = false,
    required = false,
    error,
    description,
    searchable = true,
    className = '',
    size = 'md'
}) => {
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const popRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlight, setHighlight] = useState(-1);
    const [placement, setPlacement] = useState(POS.DOWN);
    const [coords, setCoords] = useState({
        left: 0,
        top: 0,
        bottom: 0,
        width: 0,
    });

    const selectedValues = Array.isArray(value) ? value : [];
    
    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm.trim()) return options;
        const q = searchTerm.toLowerCase();
        return options.filter((o) =>
            String(o?.label ?? '').toLowerCase().includes(q) ||
            String(o?.value ?? '').toLowerCase().includes(q)
        );
    }, [options, searchable, searchTerm]);

    const availableOptions = useMemo(() => {
        const selectedSet = new Set(selectedValues);
        return filteredOptions.filter((opt) => !selectedSet.has(opt.value));
    }, [filteredOptions, selectedValues]);

    const selectedLabels = useMemo(() => {
        const valueSet = new Set(selectedValues);
        return options.filter((o) => valueSet.has(o.value));
    }, [selectedValues, options]);

    const displayText = useMemo(() => {
        if (selectedValues.length === 0) return placeholder;
        if (selectedValues.length <= 2) return selectedLabels.map((o) => o.label).join(', ');
        return `${selectedLabels.slice(0, 2).map((o) => o.label).join(', ')} +${selectedValues.length - 2}`;
    }, [selectedLabels, selectedValues.length, placeholder]);

    const open = () => {
        if (disabled) return;
        setIsOpen(true);
        setHighlight(0);
    };

    const close = () => {
        setIsOpen(false);
        setSearchTerm('');
        setHighlight(-1);
    };

    const toggle = () => (isOpen ? close() : open());

    const measureAndPlace = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const estimated = Math.min(320, Math.max(220, (availableOptions.length || 6) * 40 + (searchable ? 56 : 8)));
        setPlacement(spaceBelow < estimated ? POS.UP : POS.DOWN);
        setCoords({
            left: Math.round(rect.left),
            top: Math.round(rect.bottom + 8),
            bottom: Math.round(window.innerHeight - rect.top + 8),
            width: Math.round(rect.width),
        });
    };

    useLayoutEffect(() => {
        if (isOpen) measureAndPlace();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, availableOptions.length, searchable]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (!rootRef.current) return;
            const pop = popRef.current;
            if (
                !rootRef.current.contains(e.target) &&
                !(pop && pop.contains(e.target))
            ) {
                close();
            }
        };
        const onEsc = (e) => e.key === 'Escape' && close();
        const onReflow = () => isOpen && measureAndPlace();

        if (isOpen) {
            document.addEventListener('mousedown', onDocClick);
            document.addEventListener('keydown', onEsc);
            window.addEventListener('resize', onReflow, { passive: true });
            window.addEventListener('scroll', onReflow, { passive: true, capture: true });
        }
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleToggle = (optValue) => {
        if (disabled) return;
        const newValues = selectedValues.includes(optValue)
            ? selectedValues.filter((v) => v !== optValue)
            : [...selectedValues, optValue];
        onChange?.(newValues);
    };

    const handleRemove = (optValue, e) => {
        e?.stopPropagation();
        if (disabled) return;
        onChange?.(selectedValues.filter((v) => v !== optValue));
    };

    const onKeyDown = (e) => {
        if (!isOpen) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
                e.preventDefault();
                open();
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(availableOptions.length - 1, h + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlight >= 0 && availableOptions[highlight]) {
                handleToggle(availableOptions[highlight].value);
            }
        } else if (e.key === 'Backspace' && !searchTerm && selectedValues.length > 0) {
            e.preventDefault();
            onChange?.(selectedValues.slice(0, -1));
        }
    };

    const sizeClass =
        size === 'sm'
            ? 'h-9 text-sm'
            : size === 'lg'
                ? 'h-11 text-[15px]'
                : 'h-10 text-sm';

    const popStyles =
        placement === POS.DOWN
            ? {
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                minWidth: `${coords.width}px`,
                zIndex: 2147483000,
            }
            : {
                position: 'fixed',
                bottom: `${coords.bottom}px`,
                left: `${coords.left}px`,
                minWidth: `${coords.width}px`,
                zIndex: 2147483000,
            };

    return (
        <div ref={rootRef} className={cn('relative', className)}>
            <style>{`
          .shadow-modal{--tw-shadow-color:0 10px 40px rgba(0,0,0,.55)}
        `}</style>

            {label && (
                <label className="mb-2 block text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="ml-1 text-error">*</span>}
                </label>
            )}

            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={toggle}
                onKeyDown={onKeyDown}
                className={cn(
                    'flex w-full items-center gap-2 rounded-md border px-3 py-2 ring-offset-background transform-gpu transition',
                    'bg-input/80 text-foreground backdrop-blur min-h-[2.5rem]',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    error
                        ? 'border-error/50 focus-visible:ring-error/30'
                        : 'border-border focus-visible:ring-primary/40',
                    selectedValues.length === 0 && 'text-muted-foreground',
                    sizeClass
                )}
                aria-invalid={Boolean(error)}
            >
                <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
                    {selectedLabels.length > 0 ? (
                        <>
                            {selectedLabels.slice(0, 2).map((opt) => (
                                <span
                                    key={opt.value}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-medium ring-1 ring-primary/30"
                                >
                                    <span className="truncate max-w-[200px]">{opt.label}</span>
                                    {!disabled && (
                                        <span
                                            onClick={(e) => handleRemove(opt.value, e)}
                                            className="hover:bg-primary/30 rounded-full p-0.5 transition cursor-pointer"
                                            role="button"
                                            aria-label="Remove"
                                        >
                                            <X className="h-3 w-3" />
                                        </span>
                                    )}
                                </span>
                            ))}
                            {selectedLabels.length > 2 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                                    +{selectedLabels.length - 2} more
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="truncate">{displayText}</span>
                    )}
                </div>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 transition-transform duration-200 ease-out flex-shrink-0',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={popRef}
                            initial={{
                                opacity: 0,
                                y: placement === POS.DOWN ? 6 : -6,
                                scale: 0.98,
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                transition: { duration: 0.16 },
                            }}
                            exit={{
                                opacity: 0,
                                y: placement === POS.DOWN ? 6 : -6,
                                scale: 0.98,
                                transition: { duration: 0.12 },
                            }}
                            style={popStyles}
                            className={cn(
                                'rounded-lg border text-popover-foreground shadow-modal',
                                'bg-popover backdrop-blur max-h-[72vh] overflow-hidden'
                            )}
                            role="listbox"
                        >
                            {searchable && (
                                <div className="p-2 border-b border-border">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            autoFocus
                                            placeholder="Search…"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-8 bg-input/70"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedLabels.length > 0 && (
                                <div className="px-2 py-2 border-b border-border">
                                    <div className="text-xs font-medium text-muted-foreground mb-1.5">
                                        Selected ({selectedLabels.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto thin-scrollbar">
                                        {selectedLabels.map((opt) => (
                                            <span
                                                key={opt.value}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-medium ring-1 ring-primary/30"
                                            >
                                                <span className="truncate max-w-[180px]">{opt.label}</span>
                                                {!disabled && (
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemove(opt.value, e);
                                                        }}
                                                        className="hover:bg-primary/30 rounded-full p-0.5 transition cursor-pointer"
                                                        role="button"
                                                        aria-label="Remove"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <ul className="max-h-72 overflow-auto py-1 thin-scrollbar">
                                {availableOptions.length > 0 && selectedLabels.length > 0 && (
                                    <li className="px-3 py-1 text-xs font-medium text-muted-foreground">
                                        Available
                                    </li>
                                )}
                                {availableOptions.length === 0 ? (
                                    <li className="px-3 py-2 text-sm text-muted-foreground select-none">
                                        {searchTerm ? 'No options found' : selectedValues.length > 0 ? 'All options selected' : 'No options available'}
                                    </li>
                                ) : (
                                    (() => {
                                        // Group options by program
                                        const grouped = {};
                                        availableOptions.forEach((option) => {
                                            const program = option.program || 'Other';
                                            if (!grouped[program]) grouped[program] = [];
                                            grouped[program].push(option);
                                        });

                                        let flatIndex = 0;
                                        return Object.entries(grouped).map(([program, opts], groupIdx) => (
                                            <React.Fragment key={program}>
                                                {Object.keys(grouped).length > 1 && (
                                                    <li className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/80 bg-muted/20 sticky top-0">
                                                        {program}
                                                    </li>
                                                )}
                                                {opts.map((option) => {
                                                    const currentIndex = flatIndex++;
                                                    const isActive = currentIndex === highlight;
                                                    return (
                                                        <li
                                                            key={String(option.value)}
                                                            role="option"
                                                            aria-selected={false}
                                                            className={cn(
                                                                'relative mx-1 flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none',
                                                                'transition-colors',
                                                                isActive ? 'bg-white/10' : 'hover:bg-white/10'
                                                            )}
                                                            onMouseEnter={() => setHighlight(currentIndex)}
                                                            onClick={() => {
                                                                handleToggle(option.value);
                                                                setSearchTerm('');
                                                            }}
                                                            title={option.label}
                                                        >
                                                            <span className="flex-1 truncate">{option.label}</span>
                                                        </li>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ));
                                    })()
                                )}
                            </ul>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {description && !error && (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
            {error && <p className="mt-1 text-sm text-error">{error}</p>}
        </div>
    );
};

export default MultiSelect;
