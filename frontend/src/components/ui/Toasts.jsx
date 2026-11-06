// src/components/ui/Toasts.jsx
import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../AppIcon';
import useGlobalLoaderBlocking from '../../hooks/useGlobalLoaderBlocking';

const ToastsCtx = createContext(null);

export const ToastsProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const [pendingToasts, setPendingToasts] = useState([]);
    const loaderBlocking = useGlobalLoaderBlocking(true);
    const wasBlockedRef = useRef(false);

    // Коли лоадери завершились, показуємо pending toasts
    useEffect(() => {
        // Tracking whether we were blocked before
        if (loaderBlocking) {
            wasBlockedRef.current = true;
        }
        
        // Show pending toasts only after loaders finish (transition from blocked to unblocked)
        if (wasBlockedRef.current && !loaderBlocking && pendingToasts.length > 0) {
            setToasts((prev) => [...prev, ...pendingToasts]);
            setPendingToasts([]);
            wasBlockedRef.current = false;
        }
    }, [loaderBlocking, pendingToasts]);

    const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
    const clear = () => {
        setToasts([]);
        setPendingToasts([]);
    };

    const push = (payload) => {
        const id = payload.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const toast = { id, ...payload };
        
        // Якщо force=true або немає активних лоадерів, показуємо відразу
        if (payload.force || !loaderBlocking) {
            setToasts((prev) => [...prev, toast]);
        } else {
            // Інакше додаємо в чергу
            setPendingToasts((prev) => [...prev, toast]);
        }
        
        return id;
    };

    const normalizeArgs = (arg1, arg2, arg3) => {
        if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
            const {
                type,
                variant,
                message,
                description,
                force,
                title,
                duration,
                icon,
                ...rest
            } = arg1;
            return {
                type: typeof type === 'string'
                    ? type.toLowerCase()
                    : typeof variant === 'string'
                        ? variant.toLowerCase()
                        : 'default',
                message: typeof message === 'string'
                    ? message
                    : typeof description === 'string'
                        ? description
                        : '',
                options: {
                    ...rest,
                    title,
                    duration,
                    icon,
                    force: Boolean(force),
                },
            };
        }

        return {
            type: typeof arg1 === 'string' ? arg1.toLowerCase() : 'default',
            message: typeof arg2 === 'string' ? arg2 : (arg2 == null ? '' : String(arg2)),
            options: {
                ...(typeof arg3 === 'object' && arg3 !== null ? arg3 : {}),
                force: Boolean(arg3?.force),
            },
        };
    };

    const notify = (arg1, arg2, arg3) => {
        const ALLOWED_TYPES = new Set(['error', 'warning', 'success', 'info']);
        const presets = {
            error: { title: 'Error', icon: 'X', duration: 4200 },
            warning: { title: 'Heads up', icon: 'AlertTriangle', duration: 3600 },
            success: { title: 'Success', icon: 'CheckCircle', duration: 3000 },
            info: { title: 'Info', icon: 'Info', duration: 3000 },
            default: { title: 'Notice', icon: 'Bell', duration: 3000 },
        };

        const { type, message, options } = normalizeArgs(arg1, arg2, arg3);
        const resolvedType = presets[type] ? type : 'default';
        const force = Boolean(options?.force);

        if (!force && !ALLOWED_TYPES.has(resolvedType)) {
            return null;
        }

        const base = presets[resolvedType] || presets.default;
        const {
            title,
            duration,
            icon,
            force: _omitForce,
            ...restOpts
        } = options || {};

        return push({
            type: resolvedType,
            title: typeof title === 'string' && title.trim() ? title : base.title,
            message: message,
            icon: typeof icon === 'string' && icon.trim() ? icon : base.icon,
            duration: Number.isFinite(duration) ? duration : base.duration,
            ...restOpts,
        });
    };

    const value = useMemo(() => ({ toasts, push, notify, remove, clear }), [toasts]);

    return <ToastsCtx.Provider value={value}>{children}</ToastsCtx.Provider>;
};

export const useToasts = () => {
    const ctx = useContext(ToastsCtx);
    if (!ctx) throw new Error('useToasts must be used within <ToastsProvider>');
    return ctx;
};

const ToastItem = ({ toast, onClose }) => {
    const { type, title, message, icon, duration = 2600 } = toast;
    const dragging = useRef({ active: false, startX: 0, dx: 0, started: false });
    const [isDragging, setIsDragging] = useState(false);
    const timerRef = useRef(null);
    const startTimeRef = useRef(Date.now());
    const pausedAtRef = useRef(0);

    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        startTimeRef.current = Date.now();
        timerRef.current = setTimeout(() => onCloseRef.current?.(), duration);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [duration]);

    const palette =
        {
            success: { ring: 'ring-success/30', dot: 'bg-success', text: 'text-success' },
            error: { ring: 'ring-error/30', dot: 'bg-error', text: 'text-error' },
            warning: { ring: 'ring-warning/30', dot: 'bg-warning', text: 'text-warning' },
            info: { ring: 'ring-primary/30', dot: 'bg-primary', text: 'text-primary' },
            default: { ring: 'ring-border/40', dot: 'bg-muted-foreground/50', text: 'text-foreground' },
        }[type] || { ring: 'ring-border/40', dot: 'bg-muted-foreground/50', text: 'text-foreground' };

    const isInteractive = (el) => {
        if (!el) return false;
        return el.closest('button, a, [role="button"], input, textarea, select, [data-no-drag]') != null;
    };

    const onPointerDown = (e) => {
        if (isInteractive(e.target)) return;
        if (e.button !== 0) return;
        dragging.current = { active: true, startX: e.clientX, dx: 0, started: false };
        setIsDragging(true);
        // Pause auto-close timer and record when we paused
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            pausedAtRef.current = Date.now() - startTimeRef.current;
        }
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
    };

    const onPointerMove = (e) => {
        if (!dragging.current.active) return;
        const dx = e.clientX - dragging.current.startX;
        if (!dragging.current.started && Math.abs(dx) < 6) return;
        if (!dragging.current.started) {
            dragging.current.started = true;
            setIsDragging(true);
        }
        dragging.current.dx = dx;
        const el = e.currentTarget;
        el.style.transform = `translateX(${dx}px)`;
        el.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 220));
    };

    const finishPointer = (el) => {
        const dx = dragging.current.dx;
        const shouldClose = Math.abs(dx) > 120;
        
        dragging.current = { active: false, startX: 0, dx: 0, started: false };
        
        if (shouldClose) {
            // Keep isDragging true to keep progress bar paused while closing
            // Animate out and close
            el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
            el.style.transform = `translateX(${dx > 0 ? '400px' : '-400px'})`;
            el.style.opacity = '0';
            setTimeout(() => {
                onCloseRef.current?.();
            }, 200);
        } else {
            // Only resume if not dismissing
            setIsDragging(false);
            el.style.transition = 'transform 150ms ease, opacity 150ms ease';
            el.style.transform = 'translateX(0px)';
            el.style.opacity = '1';
            setTimeout(() => {
                el.style.transition = '';
            }, 160);
            // Resume auto-close timer from where we paused
            const remainingTime = duration - pausedAtRef.current;
            if (remainingTime > 0) {
                timerRef.current = setTimeout(() => onCloseRef.current?.(), remainingTime);
            }
        }
    };

    const onPointerUp = (e) => {
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
        finishPointer(e.currentTarget);
    };
    const onPointerCancel = (e) => {
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
        finishPointer(e.currentTarget);
    };

    return (
        <div
            className={`pointer-events-auto select-none w-[92vw] max-w-[420px] sm:max-w-[440px] backdrop-blur-md bg-card/90 border border-border shadow-lg rounded-xl ring-1 ${palette.ring} overflow-hidden`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            role={type === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            style={{ touchAction: 'pan-y', willChange: 'transform, opacity' }}
        >
            <style>{`@keyframes toastScale { to { transform: scaleX(0); } }`}</style>
            <div className="flex items-start gap-3 px-3.5 py-3">
                <div className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full ${palette.dot}`}>
                    <Icon name={icon} size={14} className="text-background" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground truncate">{title}</div>
                        <button
                            aria-label="Close notification"
                            data-no-drag="true"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCloseRef.current?.();
                            }}
                            className="shrink-0 p-1 rounded-md hover:bg-muted/70 active:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <Icon name="X" size={14} />
                        </button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{message}</div>
                </div>
            </div>
            <div className="h-1 w-full bg-muted/60 overflow-hidden">
                <div
                    className={`h-1 ${palette.dot} origin-left`}
                    style={{
                        animation: `toastScale ${duration}ms linear forwards`,
                        transform: 'scaleX(1)',
                        willChange: 'transform',
                        animationPlayState: isDragging ? 'paused' : 'running',
                    }}
                />
            </div>
        </div>
    );
};

export const ToastViewport = ({ position = 'top-right', className = '' }) => {
    const { toasts, remove } = useToasts();

    const isTop = position === 'top-right' || position === 'top-left';
    const alignClass = position.endsWith('right') ? 'right-2 sm:right-4' : 'left-2 sm:left-4';
    const stylePos = isTop
        ? { top: 'calc(var(--app-header-height, 64px) + 8px)' }
        : { bottom: '12px' };

    const content = (
        <div
            aria-live="polite"
            role="region"
            className={`fixed pointer-events-none flex flex-col gap-2 pr-[env(safe-area-inset-right)] ${alignClass} ${className}`}
            style={{ zIndex: 2147483647, ...stylePos }}
        >
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
            ))}
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};