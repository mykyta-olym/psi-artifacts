// src/pages/activities/components/RowActionsDropdown.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const useIsDesktop = (query = '(min-width: 1280px)') => {
    const mqRef = useRef(null);
    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia(query).matches;
    });
    useEffect(() => {
        if (!window.matchMedia) return;
        mqRef.current = window.matchMedia(query);
        const handler = (e) => setIsDesktop(e.matches);
        mqRef.current.addEventListener?.('change', handler);
        return () => mqRef.current?.removeEventListener?.('change', handler);
    }, [query]);
    return isDesktop;
};

const RowActionsDropdown = ({
                                activity,
                                onOpen,
                                onResolve,
                                onMarkAction,
                                onDelete,
                                onExport,
                                onSetPriority,
                                isPinned,
                                onTogglePin
                            }) => {
    const isDesktop = useIsDesktop();
    const [open, setOpen] = useState(false);

    const wrapRef = useRef(null);
    const btnRef = useRef(null);
    const menuRef = useRef(null);
    const handleRef = useRef(null);

    const [pos, setPos] = useState({ left: 0, top: 0, bottom: null, width: 220, placement: 'down' });
    const close = () => setOpen(false);
    const toggle = () => setOpen(o => !o);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            close();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') close();
        };
        const onScroll = () => { if (isDesktop) updatePosition(); };
        const onResize = () => { if (isDesktop) updatePosition(); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open, isDesktop]);

    const updatePosition = () => {
        if (!btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        const pad = 8;
        const prefWidth = Math.max(220, r.width);
        let left = Math.min(Math.max(r.right - prefWidth, pad), Math.max(pad, window.innerWidth - prefWidth - pad));
        let top = r.bottom + 6;
        let bottom = null;
        let placement = 'down';
        const approxHeight = 280;
        if (window.innerHeight - r.bottom < approxHeight + 12) {
            bottom = Math.max(pad, window.innerHeight - r.top + 6);
            top = null;
            placement = 'up';
        }
        setPos({ left, top, bottom, width: prefWidth, placement });
    };

    useEffect(() => {
        if (!open || !isDesktop) return;
        updatePosition();
        const raf = requestAnimationFrame(() => {
            if (!menuRef.current || !btnRef.current) return;
            const menuRect = menuRef.current.getBoundingClientRect();
            const btnRect = btnRef.current.getBoundingClientRect();
            const pad = 8;
            let left = Math.min(Math.max(btnRect.right - menuRect.width, pad), Math.max(pad, window.innerWidth - menuRect.width - pad));
            let top = btnRect.bottom + 6;
            let bottom = null;
            let placement = 'down';
            if (window.innerHeight - btnRect.bottom < menuRect.height + 12) {
                bottom = Math.max(pad, window.innerHeight - btnRect.top + 6);
                top = null;
                placement = 'up';
            }
            setPos({ left, top, bottom, width: Math.max(menuRect.width, 220), placement });
        });
        return () => cancelAnimationFrame(raf);
    }, [open, isDesktop]);

    useEffect(() => {
        if (!(open && !isDesktop)) return;
        const stopScroll = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            e.preventDefault();
        };
        const opts = { passive: false, capture: true };
        document.addEventListener('touchmove', stopScroll, opts);
        document.addEventListener('wheel', stopScroll, opts);
        return () => {
            document.removeEventListener('touchmove', stopScroll, opts);
            document.removeEventListener('wheel', stopScroll, opts);
        };
    }, [open, isDesktop]);

    const sections = useMemo(() => ([
        {
            key: 'main',
            items: [
                { key: 'open', icon: 'ExternalLink', label: 'Open', onClick: onOpen },
                activity?.requiresAction
                    ? { key: 'resolve', icon: 'CheckCheck', label: 'Resolve', onClick: onResolve }
                    : { key: 'mark', icon: 'AlertTriangle', label: 'Mark action', onClick: onMarkAction },
                { key: 'pin', icon: isPinned ? 'StarOff' : 'Star', label: isPinned ? 'Unpin' : 'Pin', onClick: onTogglePin },
            ].filter(Boolean)
        },
        {
            key: 'priority',
            title: 'Priority',
            items: [
                { key: 'p-high', icon: 'Flag', label: 'Set priority: High', onClick: () => onSetPriority?.('high'), active: activity?.priority === 'high' },
                { key: 'p-medium', icon: 'Flag', label: 'Set priority: Medium', onClick: () => onSetPriority?.('medium'), active: activity?.priority === 'medium' },
                { key: 'p-low', icon: 'Flag', label: 'Set priority: Low', onClick: () => onSetPriority?.('low'), active: activity?.priority === 'low' },
            ]
        },
        {
            key: 'other',
            items: [
                { key: 'copy', icon: 'Copy', label: 'Copy ID', onClick: () => navigator.clipboard?.writeText(String(activity?.id || '')) },
                { key: 'export', icon: 'Download', label: 'Export (CSV)', onClick: onExport },
                { key: 'del', icon: 'Trash2', label: 'Delete', onClick: onDelete, danger: true },
            ]
        }
    ]), [activity?.id, activity?.priority, activity?.requiresAction, isPinned, onDelete, onExport, onMarkAction, onOpen, onResolve, onSetPriority, onTogglePin]);

    const trigger = (
        <Button
            ref={btnRef}
            size="xs"
            variant="ghost"
            iconName="MoreVertical"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Row actions"
            className="data-[state=open]:bg-muted transition"
        />
    );

    return (
        <div ref={wrapRef} className="relative">
            {trigger}

            {open && isDesktop && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="Row actions menu"
                    className={`fixed z-[9999] bg-popover text-popover-foreground border border-border rounded-md shadow-modal p-1
            max-h-[70vh] overflow-auto ${pos.placement === 'up' ? 'origin-bottom-right' : 'origin-top-right'}`}
                    style={{
                        left: pos.left,
                        top: pos.top ?? 'auto',
                        bottom: pos.bottom ?? 'auto',
                        minWidth: Math.max(220, pos.width),
                        scrollbarGutter: 'stable'
                    }}
                >
                    {sections.map((sec, sIdx) => (
                        <div key={sec.key} className="py-1">
                            {sec.title && <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground/80">{sec.title}</div>}
                            {sec.items.map((it) => (
                                <button
                                    key={it.key}
                                    type="button"
                                    data-menuitem="true"
                                    onClick={() => { it.onClick?.(); close(); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-[6px] hover:bg-muted text-left transition
                    ${it.danger ? 'text-destructive' : ''} ${it.active ? 'bg-muted/60' : ''} focus:outline-none focus:ring-1 focus:ring-ring/50`}
                                >
                                    <Icon name={it.icon} size={16} className="opacity-80" />
                                    <span className="flex-1">{it.label}</span>
                                    {it.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">current</span>}
                                </button>
                            ))}
                            {sIdx < sections.length - 1 && <div className="my-1 border-t border-border" />}
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {open && !isDesktop && createPortal(
                <MobileSheet
                    menuRef={menuRef}
                    handleRef={handleRef}
                    sections={sections}
                    onClose={close}
                />,
                document.body
            )}
        </div>
    );
};

const MobileSheet = ({ menuRef, handleRef, sections, onClose }) => {
    const drag = useRef({ active: false, startY: 0, dy: 0, canDrag: false });
    const THRESHOLD = 100;

    useEffect(() => {
        const sheet = menuRef.current;
        if (!sheet) return;

        const onStart = (e) => {
            const y = e.touches[0].clientY;
            const fromHandle = handleRef.current?.contains(e.target);
            const atTop = sheet.scrollTop <= 0;
            drag.current = { active: true, startY: y, dy: 0, canDrag: fromHandle || atTop };
            sheet.style.transition = 'none';
        };

        const onMove = (e) => {
            if (!drag.current.active) return;
            const y = e.touches[0].clientY;
            const dy = Math.max(0, y - drag.current.startY);
            if (drag.current.canDrag && dy > 0) {
                e.preventDefault();
                drag.current.dy = dy;
                sheet.style.transform = `translateY(${dy}px)`;
            } else {
                drag.current.dy = 0;
                sheet.style.transform = 'translateY(0)';
            }
        };

        const finish = () => {
            if (!drag.current.active) return;
            const dy = drag.current.dy;
            drag.current.active = false;
            if (dy > THRESHOLD) {
                sheet.style.transition = 'transform 180ms ease-out';
                sheet.style.transform = `translateY(100%)`;
                setTimeout(onClose, 170);
            } else {
                sheet.style.transition = 'transform 180ms ease-out';
                sheet.style.transform = 'translateY(0)';
            }
        };

        sheet.addEventListener('touchstart', onStart, { passive: true });
        sheet.addEventListener('touchmove', onMove, { passive: false });
        sheet.addEventListener('touchend', finish);
        sheet.addEventListener('touchcancel', finish);

        return () => {
            sheet.removeEventListener('touchstart', onStart);
            sheet.removeEventListener('touchmove', onMove);
            sheet.removeEventListener('touchend', finish);
            sheet.removeEventListener('touchcancel', finish);
        };
    }, [menuRef, handleRef, onClose]);

    return (
        <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog" aria-label="Row actions">
            <div className="absolute inset-0 bg-black/45" onClick={onClose} />
            <div
                ref={menuRef}
                className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-popover text-popover-foreground border-t border-border shadow-modal
          p-3 pt-2 max-h-[80vh] overflow-auto overscroll-contain will-change-transform"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', scrollbarGutter: 'stable', transform: 'translateY(0)' }}
            >
                <div ref={handleRef} className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/20" aria-hidden />
                <div className="flex items-center justify-between px-1 pb-2">
                    <div className="text-sm font-semibold">Actions</div>
                    <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close actions">
                        <Icon name="X" size={16} />
                    </Button>
                </div>

                {sections.map((sec, sIdx) => (
                    <div key={sec.key} className="py-1">
                        {sec.title && <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground/80">{sec.title}</div>}
                        <div className="grid">
                            {sec.items.map((it) => (
                                <button
                                    key={it.key}
                                    type="button"
                                    onClick={() => { it.onClick?.(); onClose(); }}
                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-[10px] text-base
                    hover:bg-muted active:bg-muted focus:outline-none focus:ring-1 focus:ring-ring/50
                    ${it.danger ? 'text-destructive' : ''} ${it.active ? 'bg-muted/60' : ''}`}
                                >
                                    <Icon name={it.icon} size={18} className="opacity-90" />
                                    <span className="flex-1">{it.label}</span>
                                    {it.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">current</span>}
                                </button>
                            ))}
                        </div>
                        {sIdx < sections.length - 1 && <div className="my-2 border-t border-border" />}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RowActionsDropdown;