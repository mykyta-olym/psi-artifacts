// src/pages/Welcome.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from 'components/ui/Button';
import Icon from 'components/AppIcon';
import SiteHeader from 'components/ui/SiteHeader';
import SiteFooter from 'components/ui/SiteFooter';
import { ToastsProvider, ToastViewport, useToasts } from 'components/ui/Toasts';
import Reveal from 'components/motion/Reveal';
import { ANIMATION_DELAYS } from '../constants/animations';
import useGlobalLoaderBlocking from '../hooks/useGlobalLoaderBlocking';
import { listNews } from 'data/newsApi';

const KEYCAP_CSS = `
.keycap-scene { perspective: 1000px; transform-style: preserve-3d; }
@keyframes keycap-in {
  0%   { opacity: 0; transform: translate3d(0,-18px,0) rotateX(-22deg) scale(.98); filter: blur(2px); }
  40%  { opacity: 1; transform: translate3d(0,  3px,0) rotateX(  6deg) scale(1.02); filter: blur(.5px); }
  68%  {           transform: translate3d(0, -2px,0) rotateX( -4deg) scale(1.00); }
  100% { opacity: 1; transform: translate3d(0,  0px,0) rotateX(  0deg) scale(1.00); filter: blur(0); }
}
.keycap-in { opacity: 0; transform-origin: 50% 120%; animation-name: keycap-in; animation-fill-mode: both; will-change: transform, opacity, filter; }
@media (prefers-reduced-motion: reduce) {
  .keycap-in { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
}
.keycap-pressable { transition: transform .25s ease, box-shadow .25s ease; transform-style: preserve-3d; }
.keycap-pressable:hover { transform: translateZ(0) translateY(-2px); }
.glass-edge { box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 20px 60px rgba(2,132,199,.12), 0 8px 24px rgba(0,0,0,.35); }
`;

const cx = (...a) => a.filter(Boolean).join(' ');
const Kcap = ({ delay = 0, dur = 720, className = '', children, style }) => (
    <div className={cx('keycap-in', className)} style={{ animationDelay: `${delay}ms`, animationDuration: `${dur}ms`, ...style }}>
        {children}
    </div>
);

const PLATBY_STUDENT_PDF = '/assets/docs/platby_student.pdf';
const BANK_ACCOUNT_PDF = '/assets/docs/student_pridanie_bankoveho_uctu.pdf';
const GDPR_PDF = '/assets/docs/gdpr.pdf';

const WelcomeInner = () => {
    const [activeNews, setActiveNews] = useState(null);
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isBlocked } = useGlobalLoaderBlocking();
    const STEP = 90;
    const { notify } = useToasts();

    useEffect(() => {
        loadNews();
    }, []);

    const loadNews = async () => {
        try {
            setLoading(true);
            const response = await listNews({ published: true, pageSize: 10 });
            setNews(response?.items || []);
        } catch (error) {
            // Silent fail - news are optional on welcome page
            console.warn('News unavailable:', error?.message || error);
            setNews([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!document.getElementById('keycap-anim-styles')) {
            const s = document.createElement('style');
            s.id = 'keycap-anim-styles';
            s.textContent = KEYCAP_CSS;
            document.head.appendChild(s);
        }
    }, []);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    const helpEmail = '';
    const gridCols = activeNews ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)_420px]';

    const renderNewsDetail = () => {
        const newsItem = news.find(n => n.id === activeNews);
        if (!newsItem) return null;
        
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        };

        const renderAttachments = (attachments) => {
            if (!attachments) return null;
            try {
                const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments;
                if (!Array.isArray(parsed) || parsed.length === 0) return null;
                
                return (
                    <div className="mt-4 space-y-2">
                        <div className="text-xs font-semibold text-white/70">Attachments:</div>
                        {parsed.map((att, idx) => (
                            <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-sm text-sky-300 hover:text-sky-200 underline"
                            >
                                <Icon name="Paperclip" size={14} />
                                {att.fileName || 'Download'}
                            </a>
                        ))}
                    </div>
                );
            } catch {
                return null;
            }
        };

        return (
            <Kcap delay={2 * STEP} dur={760}>
                <div className="rounded-2xl border border-white/12 bg-white/12 backdrop-blur-xl glass-edge p-5 sm:p-7 keycap-pressable">
                    <div className="text-[12px] text-white/70">{formatDate(newsItem.publishedAt)}</div>
                    <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-white">{newsItem.title}</h1>
                    
                    {newsItem.coverImageUrl && (
                        <div className="mt-4 rounded-lg overflow-hidden">
                            <img src={newsItem.coverImageUrl} alt={newsItem.title} className="w-full h-auto" />
                        </div>
                    )}
                    
                    <div className="mt-4 text-sm text-white/85 space-y-3">
                        {newsItem.contentHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: newsItem.contentHtml }} />
                        ) : (
                            <p className="whitespace-pre-wrap">{newsItem.content}</p>
                        )}
                    </div>

                    {renderAttachments(newsItem.attachments)}
                    
                    <div className="mt-6">
                        <button
                            onClick={() => setActiveNews(null)}
                            className="inline-flex items-center gap-2 text-[13px] rounded border border-white/20 bg-white/10 px-3 py-1 hover:bg-white/15"
                        >
                            <Icon name="ArrowLeft" size={14} />
                            Back
                        </button>
                    </div>
                </div>
            </Kcap>
        );
    };

    const renderHero = () => (
        <Kcap delay={2 * STEP} dur={760}>
            <div className="rounded-2xl border border-white/12 bg-white/12 backdrop-blur-xl glass-edge p-6 sm:p-8 keycap-pressable text-center">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                        <Icon name="University" size={18} color="#fff" />
                    </div>
                    <div className="text-left">
                        <div className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-indigo-300 tracking-tight">
                            Technical University of Košice
                        </div>
                        <div className="text-[12px] text-white/70">Modular Academic Information System</div>
                    </div>
                </div>
                <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight text-white">Welcome to the MAIS Information System</h1>
                <p className="mt-2 text-sm text-white/70 max-w-2xl mx-auto">This solution processes university data with an emphasis on security, accessibility, and stability.</p>
                <div className="mt-6">
                    <Link to="/login">
                        <Button size="lg" iconName="LogIn">Log in</Button>
                    </Link>
                </div>
                <div className="mt-6 text-[13px] text-white/75">
                    For issues and questions, contact:{' '}
                    <a href="mailto:mais@helpdesk.tuke.sk" className="text-sky-300 hover:text-sky-200 underline underline-offset-4">
                        mais@helpdesk.tuke.sk
                    </a>
                </div>
            </div>
        </Kcap>
    );

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-background">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute inset-x-0 -top-1/3 h-2/3 bg-gradient-to-b from-sky-500/14 via-transparent to-transparent blur-2xl" />
                <div className="absolute inset-x-0 -bottom-1/3 h-2/3 bg-gradient-to-t from-indigo-500/16 via-transparent to-transparent blur-2xl" />
                <div className="absolute inset-0 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:22px_22px]" />
            </div>

            <div className="relative z-[2] flex min-h-screen flex-col">
                <Reveal variant="keycap" waitForLoaders={true}>
                    <SiteHeader mode="home" />
                </Reveal>

                <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-8">
                    <div className={cx('grid grid-cols-1 gap-6', gridCols)}>
                        <Reveal delay={ANIMATION_DELAYS.HERO} variant="keycap" waitForLoaders={true} as={motion.aside} className="keycap-scene">
                            <Kcap delay={STEP} dur={720}>
                                <div className="rounded-2xl border border-white/12 bg-white/12 backdrop-blur-xl glass-edge p-4 keycap-pressable">
                                    <div className="flex items-center gap-2">
                                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                                            <Icon name="Info" size={16} color="#fff" />
                                        </div>
                                        <h2 className="text-base font-semibold text-white">About MAIS</h2>
                                    </div>
                                    <p className="text-sm text-white/70 mt-2">On this page you can find:</p>
                                    <ul className="mt-2 space-y-2 text-sm text-white/80">
                                        <li className="flex items-start gap-2"><Icon name="Dot" size={18} className="text-sky-300 mt-[2px]" />current information about your studies</li>
                                        <li className="flex items-start gap-2"><Icon name="Dot" size={18} className="text-sky-300 mt-[2px]" />course enrollment for the next semester</li>
                                        <li className="flex items-start gap-2"><Icon name="Dot" size={18} className="text-sky-300 mt-[2px]" />sign-ups for final assessment dates</li>
                                        <li className="flex items-start gap-2"><Icon name="Dot" size={18} className="text-sky-300 mt-[2px]" />an overview of your timetable</li>
                                    </ul>
                                </div>
                            </Kcap>
                        </Reveal>

                        <Reveal delay={ANIMATION_DELAYS.SUMMARY_CARDS} variant="keycap" waitForLoaders={true} as={motion.main} className="keycap-scene">
                            {activeNews ? renderNewsDetail() : renderHero()}
                        </Reveal>

                        {!activeNews && (
                            <Reveal delay={ANIMATION_DELAYS.FILTERS} variant="keycap" waitForLoaders={true} as={motion.section} className="keycap-scenes">
                                <Kcap delay={3 * STEP} dur={740}>
                                    <div className="rounded-2xl border border-white/12 bg-white/12 backdrop-blur-xl glass-edge p-4 keycap-pressable">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-base font-semibold text-white">News</h2>
                                        </div>
                                        <div className="mt-3 space-y-3">
                                            {loading ? (
                                                <div className="text-center py-4 text-white/60 text-sm">Loading news...</div>
                                            ) : news.length === 0 ? (
                                                <div className="text-center py-4 text-white/60 text-sm">No news available</div>
                                            ) : (
                                                news.map((n, i) => {
                                                    const formatDate = (dateStr) => {
                                                        const date = new Date(dateStr);
                                                        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'numeric', year: 'numeric' });
                                                    };
                                                    
                                                    return (
                                                        <Kcap key={n.id} delay={(3.2 + i) * STEP} dur={700}>
                                                            <button
                                                                onClick={() => setActiveNews(n.id)}
                                                                className="w-full text-left rounded-lg border border-white/10 bg-white/10 p-3 hover:bg-white/15"
                                                            >
                                                                <div className="text-sm font-medium text-white leading-snug">{n.title}</div>
                                                                <div className="text-[11px] text-white/60 mt-1">{formatDate(n.publishedAt)}</div>
                                                                {n.category && (
                                                                    <div className="mt-1">
                                                                        <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-white/10 text-white/70">
                                                                            {n.category}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </Kcap>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </Kcap>
                            </Reveal>
                        )}
                    </div>
                </div>

                <Reveal delay={ANIMATION_DELAYS.MAIN_CONTENT} variant="keycap" waitForLoaders={true}>
                    <SiteFooter />
                </Reveal>
            </div>
        </div>
    );
};

const Welcome = () => {
    return (
        <ToastsProvider>
            <WelcomeInner />
            <ToastViewport position="top-right" />
        </ToastsProvider>
    );
};

export default Welcome;