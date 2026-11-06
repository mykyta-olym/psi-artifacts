// src/components/ui/GlobalRequestLoader.jsx
import React, { useEffect, useLayoutEffect, useState } from 'react';
import api from '../../utils/apiClient';
import { cn } from '../../utils/cn';

export default function GlobalRequestLoader({
  className,
  minShowMs = 320,
}) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const unsubscribe = api.subscribe((count) => {
      setActive(count);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  // Update global loader blocking count when loader is visible - use useLayoutEffect to avoid render warnings
  useLayoutEffect(() => {
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

    const shouldBlock = visible && active > 0;
    const currentBlocking = window.__maisGlobalRequestLoaderBlocking || false;

    if (shouldBlock && !currentBlocking) {
      window.__maisGlobalRequestLoaderBlocking = true;
      window.__maisLoaderBlockingCount = (window.__maisLoaderBlockingCount || 0) + 1;
      update();
      
      return () => {
        window.__maisGlobalRequestLoaderBlocking = false;
        window.__maisLoaderBlockingCount = Math.max(0, (window.__maisLoaderBlockingCount || 1) - 1);
        update();
      };
    } else if (!shouldBlock && currentBlocking) {
      window.__maisGlobalRequestLoaderBlocking = false;
      window.__maisLoaderBlockingCount = Math.max(0, (window.__maisLoaderBlockingCount || 1) - 1);
      update();
    }
  }, [visible, active]);

  useEffect(() => {
    let finishTimer;
    if (active > 0) {
      setVisible(true);
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return Math.min(90, prev + Math.random() * 18);
      });
    } else if (visible) {
      finishTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 180);
      }, minShowMs);
    }
    return () => clearTimeout(finishTimer);
  }, [active, visible, minShowMs]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-6',
        className
      )}
    >
      <div className="relative mt-1 h-[3px] w-full max-w-[680px]">
        <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full">
          <div
            className="h-full w-full origin-left rounded-full bg-gradient-to-r from-white/65 via-sky-200/80 to-cyan-100/80 shadow-[0_0_18px_rgba(173,216,255,0.55)] transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${Math.max(0.06, progress / 100)})` }}
          />
        </div>
      </div>
    </div>
  );
}

