import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import useUserPreference from '../../hooks/useUserPreference';

const INJECTED_CSS = `
.keycap-scene{perspective:1000px;transform-style:preserve-3d;}
@keyframes keycap-in{0%{opacity:0;transform:translate3d(0,-16px,0) scale(.98);filter:blur(1.5px);}60%{opacity:1;transform:translate3d(0,2px,0) scale(1.01);filter:blur(.4px);}100%{opacity:1;transform:translate3d(0,0,0) scale(1);filter:blur(0);}}
.keycap-in{opacity:0;animation:keycap-in 680ms both;will-change:transform,opacity,filter;}
@media (prefers-reduced-motion: reduce){.keycap-in{animation:none!important;opacity:1!important;transform:none!important;filter:none!important;}}

.chip{position:relative;overflow:hidden;transform:translateY(0) scale(1);transition:transform .28s ease;will-change:transform;}
.chip::after{content:"";position:absolute;inset:-2px;background:linear-gradient(120deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.18) 40%,rgba(255,255,255,0) 80%);transform:translateX(-120%);pointer-events:none;}
@keyframes chip-shimmer{0%{transform:translateX(-120%);}100%{transform:translateX(120%);}}
.chip:hover{transform:translateY(0) scale(1.03)!important;background-color:inherit!important;border-color:inherit!important;filter:none!important;box-shadow:none!important;}
.chip:hover::after{animation:chip-shimmer 700ms linear both;}
.chip:active{transform:translateY(0) scale(.98)!important;box-shadow:none!important;}
.chip:focus-visible{outline:2px solid rgba(125,211,252,.9);outline-offset:2px;}
@media (prefers-reduced-motion: reduce){.chip,.chip:hover,.chip:active{transition:none!important;transform:none!important;animation:none!important;}.chip::after{display:none!important;}}

.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}
.no-scrollbar::-webkit-scrollbar{width:0;height:0;display:none;}
.no-scrollbar::-webkit-scrollbar-button{width:0;height:0;display:none;}

.edge-mask{-webkit-mask-image:linear-gradient(to right,transparent 0,black 24px,black calc(100% - 24px),transparent 100%);mask-image:linear-gradient(to right,transparent 0,black 24px,black calc(100% - 24px),transparent 100%);}

.popover{position:absolute;top:100%;right:0;min-width:220px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(17,24,39,.9);backdrop-filter:blur(8px);box-shadow:0 10px 40px rgba(0,0,0,.35);padding:10px;z-index:50;}
`;

const cx = (...a) => a.filter(Boolean).join(' ');

const FACULTIES = [
    { id: 'TUKE', href: 'https://www.tuke.sk' },
    { id: 'FBERG', href: 'https://fberg.tuke.sk' },
    { id: 'FMMR', href: 'https://fmmr.tuke.sk' },
    { id: 'SjF', href: 'https://sjf.tuke.sk' },
    { id: 'FEI', href: 'https://fei.tuke.sk' },
    { id: 'SvF', href: 'https://svf.tuke.sk' },
    { id: 'EkF', href: 'https://ekf.tuke.sk' },
    { id: 'FVT', href: 'https://fvt.tuke.sk' },
    { id: 'FU', href: 'https://fu.tuke.sk' },
    { id: 'LF', href: 'https://lf.tuke.sk' }
];

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
    { code: 'cz', name: 'Czech', flag: '🇨🇿' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'ua', name: 'Ukrainian', flag: '🇺🇦' }
];

const SUPPORTED = new Set(['en']);

const SiteHeader = ({ mode = 'home' }) => {
    const [clock, setClock] = useState(() => new Date());
    const [toast, setToast] = useState('');
    const [openLang, setOpenLang] = useState(false);
    const location = useLocation();

    useEffect(() => {
        let s = document.getElementById('mais-global-styles');
        if (!s) {
            s = document.createElement('style');
            s.id = 'mais-global-styles';
            document.head.appendChild(s);
        }
        s.textContent = INJECTED_CSS;
    }, []);

    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 2200);
        return () => clearTimeout(t);
    }, [toast]);

    const languagePreference = useUserPreference('ui.language', 'en');
    const selectedLang = languagePreference.value || 'en';

    const applyLang = (code) => {
        if (!SUPPORTED.has(code)) {
            setToast(`"${LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase()}" not available yet`);
            return;
        }
        languagePreference.setValue(code);
        window.dispatchEvent(new CustomEvent('mais:lang-changed', { detail: { code } }));
        setOpenLang(false);
    };

    return (
        <header className="w-full border-b border-white/10 bg-white/10 backdrop-blur-md keycap-in sticky top-0 z-40">
            <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
                <div className="flex items-center justify-between gap-2 sm:gap-3 py-2.5 sm:py-3">
                    <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 shadow-[0_8px_20px_rgba(2,132,199,.35)] shrink-0">
                            <Icon name="GraduationCap" size={18} color="#fff" />
                        </div>
                        <div className="leading-tight min-w-0">
                            <div className="text-base sm:text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-indigo-300 tracking-tight truncate">
                                MAIS 2.0
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-white/70 truncate">
                                Technical University of Košice
                            </div>
                        </div>
                    </Link>

                    <div className="hidden xl:flex items-center gap-2 min-w-0">
                        <div className="hidden lg:flex flex-wrap items-center gap-1">
                            {LANGUAGES.map((l) => {
                                const active = selectedLang === l.code;
                                const isSupported = SUPPORTED.has(l.code);
                                return (
                                    <button
                                        key={l.code}
                                        onClick={() => applyLang(l.code)}
                                        aria-pressed={active}
                                        className={cx(
                                            'chip px-2 py-1 rounded text-[11px] border',
                                            active ? 'bg-sky-500/20 border-sky-400/40 text-sky-100' : 'bg-white/10 border-white/15 text-white/80',
                                            !isSupported && 'opacity-70'
                                        )}
                                        title={isSupported ? `${l.name}` : `${l.name} — soon`}
                                    >
                                        <span className="mr-1">{l.flag}</span>
                                        <span className="uppercase">{l.code}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="hidden lg:flex items-center gap-2 text-xs text-white/70 min-w-0">
                            <Icon name="Clock" size={14} color="currentColor" />
                            <span className="truncate">{clock.toLocaleString()}</span>
                        </div>
                    </div>

                                        <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
                        <div className="relative">
                            <button
                                onClick={() => setOpenLang((v) => !v)}
                                className="lg:hidden chip px-2 py-1 rounded border border-white/15 bg-white/10 text-white/90 text-xs"
                                aria-expanded={openLang}
                            >
                                <span className="mr-1">🌐</span>
                                <span className="uppercase">{selectedLang}</span>
                            </button>
                            {openLang && (
                                <div className="popover">
                                    <div className="text-[11px] text-white/70 px-1 pb-1">Language</div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {LANGUAGES.map((l) => {
                                            const active = selectedLang === l.code;
                                            const isSupported = SUPPORTED.has(l.code);
                                            return (
                                                <button
                                                    key={l.code}
                                                    onClick={() => applyLang(l.code)}
                                                    className={cx(
                                                        'chip px-2 py-1 rounded border text-sm text-left',
                                                        active ? 'bg-sky-500/20 border-sky-400/40 text-sky-100' : 'bg-white/10 border-white/15 text-white/90',
                                                        !isSupported && 'opacity-70'
                                                    )}
                                                >
                                                    <span className="mr-1">{l.flag}</span>
                                                    <span className="uppercase">{l.code}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {mode === 'home' ? (
                            <Link to="/login" state={{ from: location }}>
                                <Button size="sm" className="ml-0 sm:ml-1" iconName="LogIn">
                                    Log in
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/">
                                <Button size="sm" className="ml-0 sm:ml-1" variant="outline" iconName="Home">
                                    Home
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="pb-2 -mx-3 sm:mx-0">
                    <div className="edge-mask no-scrollbar flex items-center gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory px-3 sm:px-0">
                        {FACULTIES.map((f) => (
                            <a
                                key={f.id}
                                href={f.href}
                                target="_blank"
                                rel="noreferrer"
                                className="chip inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/10 bg-white/10 text-white/90 text-[11px] sm:text-xs snap-start shrink-0"
                            >
                                <Icon name="ChevronRight" size={14} className="opacity-80" />
                                <span className="whitespace-nowrap">{f.id}</span>
                            </a>
                        ))}
                    </div>
                </div>

                {toast && (
                    <div className="pb-2">
                        <div className="rounded-md border border-white/15 bg-white/10 text-[12px] px-3 py-2 text-white/90">{toast}</div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default SiteHeader;