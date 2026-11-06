// src/contexts/SignalRContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('SignalR');
const SignalRContext = createContext(null);

export const useSignalR = () => {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalR must be used within SignalRProvider');
  }
  return context;
};

export const SignalRProvider = ({ children }) => {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const listenersRef = useRef(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!user?.email) {
      // User logged out - cleanup
      if (connectionRef.current) {
        logger.debug('User logged out, cleaning up connection');
        connectionRef.current.stop().catch((err) => logger.error('Error stopping connection:', err));
        connectionRef.current = null;
        listenersRef.current.clear();
        setIsConnected(false);
        setConnectionId(null);
        isInitializedRef.current = false;
      }
      return undefined;
    }

    // Don't create multiple connections
    if (isInitializedRef.current) {
      logger.debug('Connection already initialized, skipping');
      return undefined;
    }

    let isMounted = true;

    const connectHub = async () => {
      try {
        // Check if token needs refresh before connecting
        const token = apiClient.getAccessToken();
        if (token) {
          const parts = token.split('.');
          if (parts.length >= 2) {
            try {
              let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              while (base64.length % 4 !== 0) base64 += '=';
              const payload = JSON.parse(window.atob(base64));
              const expMs = payload?.exp * 1000;
              const now = Date.now();
              // If token expires in less than 2 minutes, refresh it
              if (expMs && (expMs - now) < 2 * 60 * 1000) {
                logger.debug('Token expiring soon, refreshing before connecting');
                try {
                  await apiClient.refreshTokens();
                } catch (refreshErr) {
                  logger.warn('Token refresh failed:', refreshErr);
                }
              }
            } catch (e) {
              // Ignore token parsing errors
            }
          }
        }

        const apiBase = import.meta.env.VITE_API_BASE || '/api';
        const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
        const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
        const hubUrl = `${withoutApi || ''}/hubs/data`;
        
        const connection = new HubConnectionBuilder()
          .withUrl(hubUrl, {
            accessTokenFactory: async () => {
              let currentToken = apiClient.getAccessToken();
              if (!currentToken) return '';
              
              // Check expiry on each connection attempt
              try {
                const parts = currentToken.split('.');
                if (parts.length >= 2) {
                  let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  while (base64.length % 4 !== 0) base64 += '=';
                  const payload = JSON.parse(window.atob(base64));
                  const expMs = payload?.exp * 1000;
                  if (expMs && Date.now() >= expMs) {
                    logger.debug('Token expired, refreshing');
                    await apiClient.refreshTokens();
                    currentToken = apiClient.getAccessToken() || '';
                  }
                }
              } catch (e) {
                // Ignore
              }
              return currentToken || '';
            }
          })
          .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
              // Exponential backoff: 0s, 2s, 10s, 30s
              if (retryContext.previousRetryCount === 0) return 0;
              if (retryContext.previousRetryCount === 1) return 2000;
              if (retryContext.previousRetryCount === 2) return 10000;
              return 30000;
            }
          })
          .configureLogging(LogLevel.Information)
          .build();

        connection.on('DataUpdated', (payload) => {
          logger.debug('DataUpdated received:', payload);
          
          // Notify all registered listeners
          listenersRef.current.forEach((callback, id) => {
            try {
              callback(payload);
            } catch (err) {
              logger.error(`Error in listener ${id}:`, err);
            }
          });
        });

        connection.onclose((error) => {
          logger.warn('SignalR connection closed', error);
          setIsConnected(false);
          setConnectionId(null);
        });
        
        connection.onreconnecting((error) => {
          logger.info('SignalR reconnecting...', error);
          setIsConnected(false);
        });
        
        connection.onreconnected((connId) => {
          logger.info('SignalR reconnected with ID:', connId);
          setIsConnected(true);
          setConnectionId(connId);
        });

        if (!isMounted) return;

        await connection.start();
        logger.info('SignalR connected successfully');
        logger.debug('Connection ID:', connection.connectionId);
        
        if (!isMounted) {
          connection.stop().catch((err) => logger.error('Error stopping connection:', err));
          return;
        }
        
        setIsConnected(true);
        setConnectionId(connection.connectionId);
        isInitializedRef.current = true;
        connectionRef.current = connection;
      } catch (err) {
        logger.error('SignalR connection failed:', err);
        setIsConnected(false);
        isInitializedRef.current = false;
        
        if (isMounted) {
          // Retry after delay
          setTimeout(() => {
            if (isMounted) connectHub();
          }, 5000);
        }
      }
    };

    connectHub();

    return () => {
      logger.debug('Cleaning up SignalR connection');
      isMounted = false;
      if (connectionRef.current && connectionRef.current.state === HubConnectionState.Connected) {
        connectionRef.current.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
      connectionRef.current = null;
      listenersRef.current.clear();
      setIsConnected(false);
      setConnectionId(null);
      isInitializedRef.current = false;
    };
  }, [user?.email]);

  const subscribe = (id, callback) => {
    logger.debug(`Subscribing listener: ${id}`);
    listenersRef.current.set(id, callback);
    
    return () => {
      logger.debug(`Unsubscribing listener: ${id}`);
      listenersRef.current.delete(id);
    };
  };

  const joinGroup = async (groupName) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot join group - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('JoinGroup', groupName);
      logger.debug('Joined group:', groupName);
    } catch (err) {
      logger.error('Failed to join group:', err);
    }
  };

  const leaveGroup = async (groupName) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot leave group - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('LeaveGroup', groupName);
      logger.debug('Left group:', groupName);
    } catch (err) {
      logger.error('Failed to leave group:', err);
    }
  };

  const value = {
    connection: connectionRef.current,
    isConnected,
    connectionId,
    subscribe,
    joinGroup,
    leaveGroup
  };

  return (
    <SignalRContext.Provider value={value}>
      {children}
    </SignalRContext.Provider>
  );
};

export default SignalRContext;
