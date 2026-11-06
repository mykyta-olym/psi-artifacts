// src/components/ui/DataLoader.jsx
import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InfinitySpin } from 'react-loader-spinner';
import { cn } from '../../utils/cn';

export default function DataLoader({
  label = 'Loading data…',
  subtle = false,
  cover = true,
  description,
  details,
  fullScreen = false,
  className,
  spinnerClassName,
  labelClassName,
}) {
  useEffect(() => {
    if (!fullScreen || typeof window === 'undefined' || typeof document === 'undefined') return;

    const update = () => {
      const count = window.__maisLoaderBlockingCount || 0;
      if (count > 0) {
        document.documentElement.dataset.loaderBlocking = 'true';
      } else {
        delete document.documentElement.dataset.loaderBlocking;
      }
      window.dispatchEvent(new CustomEvent('mais:loader-change', { detail: count }));
    };

    window.__maisLoaderBlockingCount = (window.__maisLoaderBlockingCount || 0) + 1;
    update();

    return () => {
      window.__maisLoaderBlockingCount = Math.max(0, (window.__maisLoaderBlockingCount || 1) - 1);
      update();
    };
  }, [fullScreen]);

  const keyframes = useMemo(
    () => `
    @keyframes dlAuroraWave {
      0% { transform: translateY(8%) scaleX(1); opacity: 0.6; }
      50% { transform: translateY(-6%) scaleX(1.06); opacity: 0.88; }
      100% { transform: translateY(8%) scaleX(1); opacity: 0.6; }
    }
    @keyframes dlSnowfallPrimary {
      0% { transform: translate3d(-12%, -55%, 0); opacity: 0; }
      15% { opacity: 0.42; }
      85% { opacity: 0.42; }
      100% { transform: translate3d(12%, 70%, 0); opacity: 0; }
    }
    @keyframes dlSnowfallSecondary {
      0% { transform: translate3d(18%, -45%, 0); opacity: 0; }
      20% { opacity: 0.34; }
      80% { opacity: 0.34; }
      100% { transform: translate3d(-18%, 75%, 0); opacity: 0; }
    }
    @keyframes dlPulse {
      0%,100% { opacity: 0.5; }
      50% { opacity: 0.85; }
    }
    @keyframes dlCompassStroke {
      0% { stroke-dashoffset: 46; }
      100% { stroke-dashoffset: -46; }
    }
  `,
    []
  );

  const loaderContent = (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-5 text-center',
        fullScreen
          ? 'fixed inset-0 z-[9999] flex bg-[rgba(2,8,18,0.92)] backdrop-blur-[40px] px-6'
          : cover
            ? 'w-full rounded-none border border-white/12 bg-[rgba(3,12,22,0.85)] backdrop-blur-2xl shadow-[0_32px_68px_rgba(0,8,20,0.55)] px-6 py-14'
            : 'py-10',
        subtle && !fullScreen && 'py-8 bg-[rgba(3,10,20,0.72)]',
        fullScreen && 'pt-0',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <style>{keyframes}</style>

      {(cover || fullScreen) && (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_-8%,rgba(184,214,255,0.4),transparent_64%),radial-gradient(circle_at_78%_122%,rgba(162,197,236,0.3),transparent_70%),linear-gradient(180deg,rgba(18,36,52,0.96),rgba(9,22,32,0.9))] backdrop-blur-[40px]" />
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-[210%] bg-gradient-to-b from-white/48 via-transparent to-transparent"
              style={{ filter: 'blur(24px)', animation: 'dlAuroraWave 18s ease-in-out infinite' }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_6%,rgba(255,255,255,0.18),transparent_72%)] mix-blend-screen opacity-80" />
          </div>

          <div
            className="pointer-events-none absolute inset-0 bg-[rgba(203,226,255,0.22)] blur-[120px]"
            style={{ animation: 'dlPulse 6s ease-in-out infinite' }}
          />

          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -left-24 top-[-70%] h-[220%] w-[150%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_62%)] opacity-65"
              style={{ animation: 'dlSnowfallPrimary 26s linear infinite' }}
            />
            <div
              className="absolute right-[-20%] top-[-50%] h-[210%] w-[150%] bg-[radial-gradient(circle_at_center,rgba(231,243,255,0.12),transparent_66%)] opacity-60"
              style={{ animation: 'dlSnowfallSecondary 30s linear infinite', animationDelay: '6s' }}
            />
          </div>
        </>
      )}

      <div
        className={cn(
          'relative flex items-center justify-center rounded-full bg-white/10 p-3 backdrop-blur-sm shadow-[0_18px_32px_rgba(3,12,24,0.45)]',
          subtle ? 'h-20 w-20' : 'h-[110px] w-[110px] sm:h-[124px] sm:w-[124px]',
          spinnerClassName,
        )}
      >
        <InfinitySpin width={subtle ? '160' : '200'} color="#d8ecff" />
        <div className="pointer-events-none absolute inset-0 rounded-full border border-white/25" />
        <div className="pointer-events-none absolute inset-[6px] rounded-full border border-white/18" />
      </div>

      <p
        className={cn(
          'text-sm font-medium text-slate-100/95 tracking-[0.18em] uppercase',
          subtle && 'text-xs text-slate-200/78',
          labelClassName,
        )}
      >
        {label}
      </p>

      {description && (
        <p className="max-w-md text-sm text-slate-200/78">
          {description}
        </p>
      )}

      {Array.isArray(details) && details.length > 0 && (
        <div className="mt-4 w-full max-w-xl border border-white/14 bg-white/8 p-4 text-left text-xs sm:text-sm text-slate-100/84 backdrop-blur">
          <div className="mb-2 flex items-center gap-2 text-slate-200/86">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              className="text-slate-100/76"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="46"
                strokeDashoffset="0"
                style={{ animation: 'dlCompassStroke 12s linear infinite' }}
              />
              <path d="M12 7.5v3.9l2.2 2.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="uppercase tracking-[0.28em] text-[11px]">Process Log</span>
          </div>
          <ul className="space-y-1.5">
            {details.map((line, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-[4px] h-[6px] w-[6px] rounded-full bg-white/82 shadow-[0_0_6px_rgba(205,228,255,0.65)]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  // Use portal for fullScreen mode to render at document root
  if (fullScreen && typeof document !== 'undefined') {
    return createPortal(loaderContent, document.body);
  }

  return loaderContent;
}
