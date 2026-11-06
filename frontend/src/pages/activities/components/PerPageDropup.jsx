// src/pages/activities/components/PerPageDropup.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

const PerPageDropup = ({ value, onChange, options }) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    const menuRef = useRef(null);

    const [pos, setPos] = useState({
        left: 0,
        top: 0,
        placement: 'down', // 'up' | 'down'
        ready: false,
    });

    const label =
        options.find((o) => String(o.value) === String(value))?.label ||
        `${value} / page`;

    const computePosition = (placementPref = null) => {
        const btn = btnRef.current;
        const menu = menuRef.current;
        if (!btn || !menu) return;

        const pad = 8;
        const br = btn.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Measure the menu
        const mw = menu.offsetWidth || 220;
        const mh = menu.offsetHeight || 180;

        // Decide up/down
        const preferUp = placementPref
            ? placementPref === 'up'
            : (vh - br.bottom) < (mh + 12); // not enough space below

        const placement = preferUp ? 'up' : 'down';

        // Horizontal clamp
        const left = clamp(br.left, pad, vw - mw - pad);

        // Vertical position
        const top = placement === 'down' ? br.bottom + 6 : br.top - mh - 6;

        setPos({ left, top, placement, ready: true });
    };

    // Open: compute initial position quickly (after first paint)
    useLayoutEffect(() => {
        if (!open) return;
        // ensure menu exists before measuring
        const rAF = requestAnimationFrame(() => computePosition());
        return () => cancelAnimationFrame(rAF);
    }, [open]);

    // Recompute on scroll/resize while open
    useEffect(() => {
        if (!open) return;
        const onScroll = () => computePosition(pos.placement);
        const onResize = () => computePosition();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
         
    }, [open, pos.placement]);

    // Outside click / Esc
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (btnRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // Keyboard nav inside the list
    const onMenuKeyDown = (e) => {
        if (!menuRef.current) return;
        const items = Array.from(menuRef.current.querySelectorAll('button[data-opt="true"]'));
        if (!items.length) return;

        const idx = items.findIndex((el) => el === document.activeElement);
        const focusAt = (i) => items[i]?.focus();

        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); focusAt((idx + 1 + items.length) % items.length); break;
            case 'ArrowUp':   e.preventDefault(); focusAt((idx - 1 + items.length) % items.length); break;
            case 'Home':      e.preventDefault(); focusAt(0); break;
            case 'End':       e.preventDefault(); focusAt(items.length - 1); break;
            case 'Enter':     e.preventDefault(); document.activeElement?.click?.(); break;
            default: break;
        }
    };

    useEffect(() => {
        if (!open || !menuRef.current) return;
        const current =
            menuRef.current.querySelector('button[aria-selected="true"]') ||
            menuRef.current.querySelector('button[data-opt="true"]');
        current?.focus();
    }, [open]);

    // The floating menu rendered to body to escape transformed ancestors
    const menu = open ? createPortal(
        <div
            ref={menuRef}
            role="listbox"
            aria-label="Rows per page"
            className={`fixed z-[2000] ${pos.placement === 'up' ? 'origin-bottom' : 'origin-top'} animate-[panelIn_.18s_ease-out]`}
            style={{
                left: pos.left,
                top: pos.top,
                visibility: pos.ready ? 'visible' : 'hidden',
            }}
            onKeyDown={onMenuKeyDown}
        >
            <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-modal overflow-auto max-h-[50vh] p-1 min-w-[180px]">
                {options.map((opt) => {
                    const active = String(value) === String(opt.value);
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            data-opt="true"
                            role="option"
                            aria-selected={active}
                            onClick={() => { onChange(String(opt.value)); setOpen(false); }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-[6px] hover:bg-muted transition whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-ring/50 active:scale-[.99] ${active ? 'bg-muted/60' : ''}`}
                        >
                            <span className="order-1">{opt.label}</span>
                            <span className={`ml-auto order-2 ${active ? 'opacity-100' : 'opacity-0'}`}>
                <Icon name="Check" size={14} />
              </span>
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="listbox"
                className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-background text-sm whitespace-nowrap leading-[1.2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition active:scale-[.98]"
                title="Rows per page"
            >
                {label}
                <span
                    className={`inline-flex transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
                    aria-hidden
                >
          <Icon name="ChevronDown" size={16} className="opacity-70" />
        </span>
            </button>

            {menu}
        </>
    );
};

export default PerPageDropup;