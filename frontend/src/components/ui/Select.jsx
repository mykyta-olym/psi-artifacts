// src/components/ui/Select.jsx
import React, {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ChevronDown, Check, Search, X, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../utils/cn";
import Input from "./Input";

const POS = { DOWN: "down", UP: "up" };

const Select = React.forwardRef(
    (
        {
            className,
            options = [],
            value,
            defaultValue,
            placeholder = "Select an option",
            multiple = false,
            disabled = false,
            required = false,
            label,
            description,
            error,
            searchable = false,
            clearable = false,
            loading = false,
            id,
            name,
            size = "md",
            onChange,
            onOpenChange,
            onBlur,
            onFocus,
            ...props
        },
        ref
    ) => {
        const generatedId = useId();
        const selectId = id || `select-${generatedId}`;
        const listboxId = `${selectId}-list`;

        const rootRef = useRef(null);
        const triggerRef = useRef(null);
        const popRef = useRef(null);

        const [isOpen, setIsOpen] = useState(false);
        const [searchTerm, setSearchTerm] = useState("");
        const [highlight, setHighlight] = useState(-1);
        const [placement, setPlacement] = useState(POS.DOWN);

        const [coords, setCoords] = useState({
            left: 0,
            top: 0,
            bottom: 0,
            width: 0,
        });

        const val = value ?? defaultValue ?? (multiple ? [] : "");

        const filteredOptions = useMemo(() => {
            if (!searchable || !searchTerm.trim()) return options;
            const q = searchTerm.toLowerCase();
            return options.filter(
                (o) =>
                    String(o?.label ?? "").toLowerCase().includes(q) ||
                    String(o?.value ?? "").toLowerCase().includes(q)
            );
        }, [options, searchable, searchTerm]);

        const isSelected = (optionValue) => {
            if (multiple) return Array.isArray(val) && val.includes(optionValue);
            return val === optionValue;
        };

        const hasValue = multiple
            ? Array.isArray(val) && val.length > 0
            : val !== undefined && val !== "";

        const selectedLabels = useMemo(() => {
            if (!hasValue) return [];
            if (multiple) {
                const set = new Set(val);
                return options.filter((o) => set.has(o.value)).map((o) => o.label);
            }
            const it = options.find((o) => o.value === val);
            return it ? [it.label] : [];
        }, [val, options, hasValue, multiple]);

        const displayText = useMemo(() => {
            if (!hasValue) return placeholder;
            if (!multiple) return selectedLabels[0] ?? placeholder;
            if (selectedLabels.length <= 2) return selectedLabels.join(", ");
            return `${selectedLabels.slice(0, 2).join(", ")} +${
                selectedLabels.length - 2
            }`;
        }, [selectedLabels, hasValue, multiple, placeholder]);

        const open = () => {
            if (disabled) return;
            setIsOpen(true);
            onOpenChange?.(true);
            const idx = Math.max(
                0,
                filteredOptions.findIndex((o) => isSelected(o.value))
            );
            setHighlight(idx);
        };

        const close = () => {
            setIsOpen(false);
            onOpenChange?.(false);
            setSearchTerm("");
            setHighlight(-1);
        };

        const toggle = () => (isOpen ? close() : open());

        const measureAndPlace = () => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const estimated = Math.min(
                320,
                Math.max(220, (filteredOptions.length || 6) * 40 + (searchable ? 56 : 8))
            );
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
        }, [isOpen, filteredOptions.length, searchable]);

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
            const onEsc = (e) => e.key === "Escape" && close();
            const onReflow = () => isOpen && measureAndPlace();

            if (isOpen) {
                document.addEventListener("mousedown", onDocClick);
                document.addEventListener("keydown", onEsc);
                window.addEventListener("resize", onReflow, { passive: true });
                window.addEventListener("scroll", onReflow, { passive: true, capture: true });
            }
            return () => {
                document.removeEventListener("mousedown", onDocClick);
                document.removeEventListener("keydown", onEsc);
                window.removeEventListener("resize", onReflow);
                window.removeEventListener("scroll", onReflow, true);
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isOpen]);

        const onKeyDown = (e) => {
            if (!isOpen) {
                if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
                    e.preventDefault();
                    open();
                }
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(filteredOptions.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (highlight >= 0 && filteredOptions[highlight]) {
                    handleOptionSelect(filteredOptions[highlight]);
                }
            } else if (e.key === "Home") {
                e.preventDefault();
                setHighlight(0);
            } else if (e.key === "End") {
                e.preventDefault();
                setHighlight(filteredOptions.length - 1);
            }
        };

        const handleOptionSelect = (option) => {
            if (multiple) {
                const cur = Array.isArray(val) ? val : [];
                const exists = cur.includes(option.value);
                const next = exists
                    ? cur.filter((v) => v !== option.value)
                    : [...cur, option.value];
                onChange?.(next);
            } else {
                onChange?.(option.value);
                close();
            }
        };

        const handleClear = (e) => {
            e.stopPropagation();
            onChange?.(multiple ? [] : "");
            triggerRef.current?.focus();
        };

        const sizeClass =
            size === "sm"
                ? "h-9 text-sm"
                : size === "lg"
                    ? "h-11 text-[15px]"
                    : "h-10 text-sm";

        const popStyles =
            placement === POS.DOWN
                ? {
                    position: "fixed",
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    minWidth: `${coords.width}px`,
                    zIndex: 2147483000,
                }
                : {
                    position: "fixed",
                    bottom: `${coords.bottom}px`,
                    left: `${coords.left}px`,
                    minWidth: `${coords.width}px`,
                    zIndex: 2147483000,
                };

        return (
            <div ref={rootRef} className={cn("relative", className)}>
                <style>{`
          .shadow-modal{--tw-shadow-color:0 10px 40px rgba(0,0,0,.55)}
        `}</style>

                {label && (
                    <label
                        htmlFor={selectId}
                        className="mb-2 block text-sm font-medium text-foreground"
                    >
                        {label}
                        {required && <span className="ml-1 text-error">*</span>}
                    </label>
                )}

                <button
                    ref={(node) => {
                        triggerRef.current = node;
                        if (typeof ref === "function") ref(node);
                        else if (ref) ref.current = node;
                    }}
                    id={selectId}
                    type="button"
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    onClick={toggle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    className={cn(
                        "flex w-full items-center justify-between rounded-md border px-3 py-2 ring-offset-background transform-gpu transition",
                        "bg-input/80 text-foreground backdrop-blur",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                        error
                            ? "border-error/50 focus-visible:ring-error/30"
                            : "border-border focus-visible:ring-primary/40",
                        !hasValue && "text-muted-foreground",
                        sizeClass
                    )}
                    aria-invalid={Boolean(error)}
                    {...props}
                >
                    <span className="truncate">{displayText}</span>
                    <span className="ml-2 flex items-center gap-1">
            {loading && <Loader2 className="h-4 w-4 animate-spin opacity-80" />}
                        {clearable && hasValue && !loading && (
                            <span
                                role="button"
                                tabIndex={-1}
                                onClick={handleClear}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleClear();
                                    }
                                }}
                                className="grid place-items-center rounded hover:bg-white/10 transition h-5 w-5 cursor-pointer"
                                aria-label="Clear value"
                                title="Clear"
                            >
                                <X className="h-3.5 w-3.5 opacity-90" />
                            </span>
                        )}
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 transition-transform duration-200 ease-out",
                                isOpen && "rotate-180"
                            )}
                        />
          </span>
                </button>

                {name && (
                    <>
                        {multiple ? (
                            Array.isArray(val) &&
                            val.map((v) => (
                                <input key={String(v)} type="hidden" name={`${name}[]`} value={v} />
                            ))
                        ) : (
                            <input type="hidden" name={name} value={val ?? ""} />
                        )}
                    </>
                )}

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
                                    "rounded-lg border text-popover-foreground shadow-modal",
                                    "bg-popover backdrop-blur max-h-[72vh] overflow-hidden"
                                )}
                                role="listbox"
                                id={listboxId}
                                aria-labelledby={selectId}
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

                                <ul className="max-h-72 overflow-auto py-1 thin-scrollbar">
                                    {filteredOptions.length === 0 ? (
                                        <li className="px-3 py-2 text-sm text-muted-foreground select-none">
                                            {searchTerm ? "No options found" : "No options available"}
                                        </li>
                                    ) : (
                                        filteredOptions.map((option, idx) => {
                                            const selected = isSelected(option.value);
                                            const isActive = idx === highlight;
                                            return (
                                                <li
                                                    key={String(option.value)}
                                                    role="option"
                                                    aria-selected={selected}
                                                    className={cn(
                                                        "relative mx-1 flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
                                                        "transition-colors",
                                                        option.disabled
                                                            ? "pointer-events-none opacity-50"
                                                            : isActive
                                                                ? "bg-white/10"
                                                                : "hover:bg-white/10",
                                                        selected && "bg-primary/20 ring-1 ring-primary/30"
                                                    )}
                                                    onMouseEnter={() => setHighlight(idx)}
                                                    onClick={() => !option.disabled && handleOptionSelect(option)}
                                                    title={option.label}
                                                >
                                                    <span className="flex-1 truncate">{option.label}</span>
                                                    {(multiple ? selected : selected) && (
                                                        <Check className="ml-2 h-4 w-4 opacity-90" />
                                                    )}
                                                    {option.description && (
                                                        <span className="ml-2 truncate text-xs text-muted-foreground">
                              {option.description}
                            </span>
                                                    )}
                                                </li>
                                            );
                                        })
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
    }
);

Select.displayName = "Select";

export default Select;