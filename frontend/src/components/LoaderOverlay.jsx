// src/components/LoaderOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LazyMotion, domAnimation, m, MotionConfig, useAnimationControls, useReducedMotion } from "framer-motion";
import LoaderBeamCanvas from "./ui/LoaderBeamCanvas";

export default function LoaderOverlay({
                                          progress: externalProgress,
                                          minShowMs = 900,
                                          readyHoldMs = 650,
                                          label = "Loading…",
                                          onFinish,
                                          afterglowMs = 1000,
                                          lockScroll = true,
                                      }) {
    const prefersReduced = useReducedMotion();
    const [internalProgress, setInternalProgress] = useState(0);
    const [phase, setPhase] = useState("loading");
    const [beamMounted, setBeamMounted] = useState(false);
    const [beamSpan, setBeamSpan] = useState(0);
    const [afterglow, setAfterglow] = useState(0);
    const startedAtRef = useRef(performance.now());
    const finishStartedRef = useRef(false);

    const uiCtrls = useAnimationControls();
    const veilCtrls = useAnimationControls();
    const topCurtainCtrls = useAnimationControls();
    const botCurtainCtrls = useAnimationControls();

    const progress = Math.min(100, Math.max(0, externalProgress ?? internalProgress));

    useEffect(() => {
        if (externalProgress != null) return;
        let raf = 0;
        const totalMs = 1800;
        const ease = (t) => 1 - Math.pow(1 - t, 2);
        const tick = () => {
            const t = Math.min(1, (performance.now() - startedAtRef.current) / totalMs);
            setInternalProgress(Math.round(ease(t) * 100));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [externalProgress]);

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const animateValue = (from, to, ms, easeFn, onUpdate) =>
        new Promise((resolve) => {
            const s = performance.now();
            const step = () => {
                const t = Math.min(1, (performance.now() - s) / ms);
                const v = from + (to - from) * easeFn(t);
                onUpdate(v);
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });

    useEffect(() => {
        const enoughTime = performance.now() - startedAtRef.current >= minShowMs;
        if (progress >= 100 && enoughTime && !finishStartedRef.current) {
            finishStartedRef.current = true;
            (async () => {
                setPhase("arming");
                await uiCtrls.start({ opacity: 1, y: 0, scale: 1, transition: { duration: 0 } });
                if (readyHoldMs > 0) await new Promise((r) => setTimeout(r, readyHoldMs));
                await uiCtrls.start({
                    opacity: 0,
                    y: prefersReduced ? 0 : 6,
                    scale: prefersReduced ? 1 : 0.985,
                    transition: { duration: prefersReduced ? 0.2 : 0.4, ease: [0.22, 1, 0.36, 1] },
                });

                setBeamMounted(true);
                await new Promise((r) => setTimeout(r, 0));

                setPhase("expand");
                await animateValue(beamSpan, 1, prefersReduced ? 500 : 1200, easeOutCubic, (v) => setBeamSpan(v));

                setPhase("curtains");
                await Promise.all([
                    topCurtainCtrls.start({
                        y: "-100%",
                        transition: prefersReduced ? { duration: 0.5 } : { type: "spring", stiffness: 80, damping: 22, mass: 1.1 },
                    }),
                    botCurtainCtrls.start({
                        y: "100%",
                        transition: prefersReduced ? { duration: 0.5 } : { type: "spring", stiffness: 80, damping: 22, mass: 1.1 },
                    }),
                ]);

                setPhase("retract");
                setAfterglow(1);
                await Promise.all([
                    animateValue(1, 0, prefersReduced ? 500 : 1000, easeInOutCubic, (v) => setBeamSpan(v)),
                    animateValue(1, 0, prefersReduced ? Math.max(600, Math.floor(afterglowMs * 0.6)) : afterglowMs, easeOutCubic, (v) => setAfterglow(v)),
                ]);

                await veilCtrls.start({ opacity: 0, transition: { duration: prefersReduced ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] } });

                setPhase("off");
                onFinish?.();
            })();
        }
    }, [
        progress,
        minShowMs,
        readyHoldMs,
        prefersReduced,
        uiCtrls,
        veilCtrls,
        topCurtainCtrls,
        botCurtainCtrls,
        beamSpan,
        afterglowMs,
    ]);

    const veilCls =
        "fixed inset-0 flex items-center justify-center pointer-events-auto " +
        "bg-[radial-gradient(1000px_480px_at_50%_-10%,rgba(96,165,250,0.10),transparent_60%),rgba(3,10,18,0.58)] " +
        "backdrop-blur-md backdrop-saturate-150 z-[2147483647] isolate";

    const labelText = useMemo(() => (progress < 100 ? label : "Ready"), [progress, label]);
    const hidden = phase === "off";
    const target = typeof document !== "undefined" ? document.body : null;

    // Update global loader blocking count
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const update = () => {
            const count = window.__maisLoaderBlockingCount || 0;
            if (count > 0) {
                document.documentElement.dataset.loaderBlocking = 'true';
            } else {
                delete document.documentElement.dataset.loaderBlocking;
            }
            window.dispatchEvent(new CustomEvent('mais:loader-change', { detail: count }));
        };

        const wasBlocking = window.__maisLoaderOverlayBlocking || false;
        const shouldBlock = !hidden;

        if (shouldBlock && !wasBlocking) {
            window.__maisLoaderOverlayBlocking = true;
            window.__maisLoaderBlockingCount = (window.__maisLoaderBlockingCount || 0) + 1;
            update();
        } else if (!shouldBlock && wasBlocking) {
            window.__maisLoaderOverlayBlocking = false;
            window.__maisLoaderBlockingCount = Math.max(0, (window.__maisLoaderBlockingCount || 1) - 1);
            update();
        }

        return () => {
            if (wasBlocking) {
                window.__maisLoaderOverlayBlocking = false;
                window.__maisLoaderBlockingCount = Math.max(0, (window.__maisLoaderBlockingCount || 1) - 1);
                update();
            }
        };
    }, [hidden]);

    // Lock scroll without deprecated pageYOffset + no parseInt(number)
    useEffect(() => {
        if (!lockScroll || !target) return;
        let savedY = 0;
        const prevent = (e) => e.preventDefault();

        if (!hidden) {
            // use modern scrollY, fall back to documentElement scrollTop
            savedY = (typeof window !== "undefined" && typeof window.scrollY === "number" ? window.scrollY : 0) ||
                (document.documentElement ? document.documentElement.scrollTop : 0) ||
                0;

            target.style.position = "fixed";
            target.style.top = `-${savedY}px`;
            target.style.left = "0";
            target.style.right = "0";
            target.style.width = "100%";
            document.documentElement.style.overflow = "hidden";
            window.addEventListener("touchmove", prevent, { passive: false });
            window.addEventListener("wheel", prevent, { passive: false });
        }

        return () => {
            if (!lockScroll) return;
            document.documentElement.style.overflow = "";
            target.style.position = "";
            target.style.top = "";
            target.style.left = "";
            target.style.right = "";
            target.style.width = "";
            window.removeEventListener("touchmove", prevent);
            window.removeEventListener("wheel", prevent);

            if (!hidden) return;
            const y = Math.max(0, Math.floor(savedY || 0));
            window.scrollTo(0, y);
        };
    }, [hidden, lockScroll, target]);

    if (!target) return null;

    return createPortal(
        <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user">
                <m.div
                    className={`${veilCls} ${hidden ? "opacity-0 pointer-events-none" : ""}`}
                    initial={{ opacity: 1 }}
                    animate={veilCtrls}
                    aria-busy={!hidden}
                    role="status"
                    data-loader-root
                >
                    <m.div className="absolute left-0 top-0 h-1/2 w-full bg-[#0b1724] z-0" initial={{ y: "0%" }} animate={topCurtainCtrls} />
                    <m.div className="absolute left-0 bottom-0 h-1/2 w-full bg-[#0b1724] z-0" initial={{ y: "0%" }} animate={botCurtainCtrls} />

                    {beamMounted && <LoaderBeamCanvas active={!hidden} span={beamSpan} afterglow={afterglow} className="z-10" />}

                    <m.div
                        className="relative z-20 w-[min(86vw,460px)] rounded-2xl border border-white/10 bg-[rgba(7,16,26,0.82)] shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-5"
                        initial={{ opacity: 1, y: 0, scale: 1 }}
                        animate={uiCtrls}
                    >
                        <div className="flex items-end justify-between">
                            <div className="text-[12px] tracking-[0.18em] uppercase text-white/70">{labelText}</div>
                            <div className="text-white/90 font-semibold tabular-nums">{progress}%</div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                            <m.div
                                className="h-full origin-left bg-gradient-to-r from-blue-400 via-cyan-300 to-violet-400 will-change-[transform]"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: progress / 100 }}
                                transition={{ type: "tween", duration: prefersReduced ? 0.1 : 0.28, ease: "easeOut" }}
                            />
                        </div>
                    </m.div>
                </m.div>
            </MotionConfig>
        </LazyMotion>,
        target
    );
}