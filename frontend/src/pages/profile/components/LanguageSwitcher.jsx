// ./pages/profile/components/LanguageSwitcher.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import useUserPreference from '../../../hooks/useUserPreference';

const LanguageSwitcher = ({ className = '', onChange }) => {
    const languagePreference = useUserPreference('ui.language', 'en');
    const [selected, setSelected] = useState(languagePreference.value || 'en');
    const [open, setOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const languages = useMemo(() => ([
        { code: 'en', name: 'English',   flag: '🇬🇧' },
        { code: 'sk', name: 'Slovak',    flag: '🇸🇰' },
        { code: 'cz', name: 'Czech',     flag: '🇨🇿' },
        { code: 'pl', name: 'Polish',    flag: '🇵🇱' },
        { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
        { code: 'de', name: 'German',    flag: '🇩🇪' },
        { code: 'ua', name: 'Ukrainian', flag: '🇺🇦' }
    ]), []);

    const supported = useMemo(() => new Set(['en']), []);
    const selectedLang = languages.find(l => l.code === selected) || languages[0];

    useEffect(() => {
        if (languagePreference.loading) return;
        const current = languagePreference.value || 'en';
        if (!supported.has(current)) {
            languagePreference.setValue('en');
            setSelected('en');
        } else {
            setSelected(current);
        }
    }, [languagePreference.value, languagePreference.loading, languagePreference, supported]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2400);
        return () => clearTimeout(t);
    }, [toast]);

    const closeMenu = () => setOpen(false);

    const notifyUnsupported = (label) => {
        setToast(`"${label}" is not implemented yet. Only English is available.`);
        closeMenu();
    };

    const apply = (code) => {
        if (!supported.has(code)) {
            notifyUnsupported(languages.find(l => l.code === code)?.name || code.toUpperCase());
            return;
        }
        setSelected(code);
        languagePreference.setValue(code);
        window.dispatchEvent(new CustomEvent('mais:lang-changed', { detail: { code } }));
        if (typeof onChange === 'function') onChange(code);
        closeMenu();
    };

    // ---------- Bottom sheet drag (Pointer Events only; no passive touch listeners) ----------
    const sheetRef = useRef(null);
    const handleRef = useRef(null);
    const drag = useRef({ active: false, startY: 0, lastY: 0 });
    const [dragY, setDragY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const THRESHOLD = 96;

    const startDrag = (y) => {
        drag.current.active = true;
        drag.current.startY = y;
        drag.current.lastY = y;
        setDragging(true);
        setDragY(0);
    };

    const onPointerDown = (e) => {
        // capture pointer so move/up keep firing even if finger leaves handle
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        startDrag(e.clientY ?? 0);
    };

    const onPointerMove = (e) => {
        if (!drag.current.active) return;
        const y = e.clientY ?? 0;
        const dy = Math.max(0, y - drag.current.startY);
        drag.current.lastY = y;
        setDragY(dy);
    };

    const finishDrag = () => {
        if (!drag.current.active) return;
        const dy = Math.max(0, drag.current.lastY - drag.current.startY);
        drag.current.active = false;
        setDragging(false);
        if (dy > THRESHOLD) {
            setDragY(0);
            closeMenu(); // unmount sheet immediately (prevents "bounce back")
            return;
        }
        setDragY(0); // snap back
    };

    const onPointerUp = () => finishDrag();
    const onPointerCancel = () => finishDrag();

    const sheetStyle = {
        transform: `translateY(${dragging ? dragY : 0}px)`,
        transition: dragging ? 'none' : 'transform 200ms ease-out'
    };

    return (
        <section className={`rounded-lg border border-border bg-card p-4 sm:p-6 ${className}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Icon name="Globe" size={18} className="text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">Language</h3>
                </div>
                <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground bg-muted/40">
            Only English supported
          </span>
                </div>
            </div>

            <div className="mt-3 hidden md:flex flex-wrap gap-2">
                {languages.map(l => {
                    const active = selected === l.code;
                    const isSupported = supported.has(l.code);
                    return (
                        <Button
                            key={l.code}
                            size="sm"
                            variant={active ? 'default' : 'outline'}
                            className="rounded-full px-3"
                            aria-pressed={active}
                            onClick={() => (isSupported ? apply(l.code) : notifyUnsupported(l.name))}
                        >
                            <span className="mr-1">{l.flag}</span>
                            <span className="uppercase">{l.code}</span>
                            <span className="ml-1 text-xs opacity-70">· {l.name}</span>
                        </Button>
                    );
                })}
            </div>

            <div className="mt-3 md:hidden">
                <Button
                    variant="outline"
                    className="w-full justify-between"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    iconName={open ? 'ChevronUp' : 'ChevronDown'}
                    onClick={() => setOpen(v => !v)}
                >
                    <span>🌐 {selectedLang.name}</span>
                </Button>

                {open && (
                    <>
                        <div className="fixed inset-0 z-40 bg-black/40" onClick={closeMenu} />

                        <div
                            ref={sheetRef}
                            role="menu"
                            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-popover shadow-xl"
                            style={sheetStyle}
                            onClickCapture={(e) => e.stopPropagation()}
                        >
                            <div className="pt-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
                                {/* Drag handle — Pointer Events only; prevent scroll via CSS touch-action */}
                                <div
                                    ref={handleRef}
                                    className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted"
                                    style={{ touchAction: 'none' }}
                                    onPointerDown={onPointerDown}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={onPointerCancel}
                                    aria-label="Drag down to close"
                                />

                                <div className="px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="Globe" size={18} className="text-muted-foreground" />
                                        <span className="font-medium">Choose language</span>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground bg-muted/50">
                    Only English
                  </span>
                                </div>

                                <div className="mt-3 px-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {languages.map(l => {
                                        const isSupported = supported.has(l.code);
                                        const active = selected === l.code;
                                        const handlePick = () => (isSupported ? apply(l.code) : notifyUnsupported(l.name));
                                        return (
                                            <button
                                                key={l.code}
                                                role="menuitemradio"
                                                aria-checked={active}
                                                onClick={handlePick}
                                                className={`w-full rounded-lg px-4 py-3 text-left text-sm flex items-center justify-between
                          ${active ? 'bg-primary text-primary-foreground' : 'bg-card/70 border border-border hover:bg-muted/60'}`}
                                            >
                        <span className="flex items-center gap-2">
                          <span className="text-lg leading-none">{l.flag}</span>
                          <span className="uppercase">{l.code}</span>
                          <span className="opacity-70">{l.name}</span>
                        </span>
                                                {!isSupported && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            soon
                          </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-3 px-4">
                                    <Button variant="ghost" className="w-full" onClick={closeMenu} iconName="X">
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {toast && (
                <div
                    role="alert"
                    aria-live="polite"
                    className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                    <Icon name="Info" size={16} className="mt-0.5 text-muted-foreground" />
                    <span>{toast}</span>
                </div>
            )}
        </section>
    );
};

export default LanguageSwitcher;