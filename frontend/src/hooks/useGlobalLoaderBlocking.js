import { useEffect, useState } from 'react';

const LOADER_EVENT = 'mais:loader-change';

export default function useGlobalLoaderBlocking(enabled = true) {
  const [blocking, setBlocking] = useState(() => {
    if (!enabled || typeof window === 'undefined') return false;
    return (window.__maisLoaderBlockingCount || 0) > 0;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const handler = (event) => {
      const detail = event?.detail;
      let count;
      if (typeof detail === 'number') {
        count = detail;
      } else if (detail && typeof detail.count === 'number') {
        count = detail.count;
      } else {
        count = window.__maisLoaderBlockingCount || 0;
      }
      setBlocking(count > 0);
    };

    setBlocking((window.__maisLoaderBlockingCount || 0) > 0);
    window.addEventListener(LOADER_EVENT, handler);

    return () => {
      window.removeEventListener(LOADER_EVENT, handler);
    };
  }, [enabled]);

  return enabled ? blocking : false;
}
