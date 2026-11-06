// src/hooks/useDataUpdates.js
import { useEffect, useRef, useId } from 'react';
import { useSignalR } from '../contexts/SignalRContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('useDataUpdates');

export default function useDataUpdates(onUpdate) {
  const { subscribe, isConnected } = useSignalR();
  const onUpdateRef = useRef(onUpdate);
  const listenerId = useId();

  // Keep callback ref up to date
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!isConnected || !onUpdateRef.current) {
      return undefined;
    }

    logger.debug(`Component ${listenerId} subscribing to SignalR updates`);

    const unsubscribe = subscribe(listenerId, (payload) => {
      if (onUpdateRef.current) {
        try {
          onUpdateRef.current(payload);
        } catch (err) {
          logger.error(`Error in callback for ${listenerId}:`, err);
        }
      }
    });

    return () => {
      logger.debug(`Component ${listenerId} unsubscribing from SignalR updates`);
      unsubscribe();
    };
  }, [subscribe, isConnected, listenerId]);
}

