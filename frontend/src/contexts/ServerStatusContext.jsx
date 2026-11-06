import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Icon from '../components/AppIcon';

const ServerStatusContext = createContext({
  isOnline: true,
  serverReachable: true,
  checking: false,
  lastChecked: null,
  lastError: null,
  refresh: () => {},
});

export const useServerStatus = () => useContext(ServerStatusContext);

const ServerIssueOverlay = ({ isOnline, message, checking, onRetry, lastChecked }) => {
  const statusText = isOnline
    ? 'Unable to reach MAIS backend. We will keep retrying automatically.'
    : 'You appear to be offline. Check your network connection.';
  const detail = message || statusText;
  const checkedLabel = lastChecked ? `Last attempt: ${new Date(lastChecked).toLocaleTimeString()}` : '';

  return (
      <div className="fixed inset-0 z-[10000] bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 border border-destructive/50 flex items-center justify-center">
            <Icon name={isOnline ? 'ServerCrash' : 'WifiOff'} size={24} className="text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Connection problem</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{detail}</p>
            {checkedLabel && <p className="text-xs text-muted-foreground/80">{checkedLabel}</p>}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={checking}
                iconName="RefreshCcw"
            >
              {checking ? 'Checking…' : 'Retry now'}
            </Button>
          </div>
        </div>
      </div>
  );
};

export const ServerStatusProvider = ({ children }) => {
  const [state, setState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    serverReachable: true,
    checking: true,
    lastChecked: null,
    lastError: null,
  });
  const checkingRef = useRef(false);

  const checkServer = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      setState({
        isOnline: false,
        serverReachable: false,
        checking: false,
        lastChecked: Date.now(),
        lastError: 'offline',
      });
      checkingRef.current = false;
      return;
    }
    setState(prev => ({ ...prev, isOnline: true, checking: true }));
    try {
      const res = await fetch('/api/status/ping', { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      setState({
        isOnline: true,
        serverReachable: true,
        checking: false,
        lastChecked: Date.now(),
        lastError: null,
      });
    } catch (error) {
      setState({
        isOnline: true,
        serverReachable: false,
        checking: false,
        lastChecked: Date.now(),
        lastError: error?.message || 'Server unreachable',
      });
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      checkServer();
    };
    const handleOffline = () => {
      setState({
        isOnline: false,
        serverReachable: false,
        checking: false,
        lastChecked: Date.now(),
        lastError: 'offline',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check only - no periodic polling, updates via WebSockets/SignalR
    checkServer();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkServer]);

  const contextValue = useMemo(
      () => ({
        ...state,
        refresh: checkServer,
      }),
      [state, checkServer]
  );

  return (
      <ServerStatusContext.Provider value={contextValue}>
        {children}
        {!state.serverReachable && (
            <ServerIssueOverlay
                isOnline={state.isOnline}
                message={state.lastError}
                checking={state.checking}
                onRetry={checkServer}
                lastChecked={state.lastChecked}
            />
        )}
      </ServerStatusContext.Provider>
  );
};

export default ServerStatusProvider;
