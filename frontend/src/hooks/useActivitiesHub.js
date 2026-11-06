// src/hooks/useActivitiesHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('ActivitiesHub');

/**
 * Custom hook for connecting to the Activities SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onActivityCreated - Callback when an activity is created
 * @param {Function} options.onActivityUpdated - Callback when an activity is updated
 * @param {Function} options.onActivityDeleted - Callback when an activity is deleted
 * @param {Function} options.onActivityPinned - Callback when an activity is pinned/unpinned
 * @returns {Object} Hub connection utilities
 */
export default function useActivitiesHub({
  onActivityCreated,
  onActivityUpdated,
  onActivityDeleted,
  onActivityPinned
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onActivityCreated, onActivityUpdated, onActivityDeleted, onActivityPinned });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { onActivityCreated, onActivityUpdated, onActivityDeleted, onActivityPinned };
  }, [onActivityCreated, onActivityUpdated, onActivityDeleted, onActivityPinned]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    let isMounted = true;
    let connection = null;

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
        const hubUrl = `${withoutApi || ''}/hubs/activities`;

        connection = new HubConnectionBuilder()
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
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Information)
          .build();

    // Register event handlers
    connection.on('ActivityCreated', (payload) => {
      logger.debug('ActivityCreated received:', payload);
      handlersRef.current.onActivityCreated?.(payload);
    });

    connection.on('ActivityUpdated', (payload) => {
      logger.debug('ActivityUpdated received:', payload);
      handlersRef.current.onActivityUpdated?.(payload);
    });

    connection.on('ActivityDeleted', (payload) => {
      logger.debug('ActivityDeleted received:', payload);
      handlersRef.current.onActivityDeleted?.(payload);
    });

    connection.on('ActivityPinned', (payload) => {
      logger.debug('ActivityPinned received:', payload);
      handlersRef.current.onActivityPinned?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('ActivitiesHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('ActivitiesHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('ActivitiesHub reconnected:', connId);
    });

        if (!isMounted) return;

        await connection.start();
        logger.info('ActivitiesHub connected successfully');
        
        if (!isMounted) {
          connection.stop().catch((err) => logger.error('Error stopping connection:', err));
          return;
        }
        
        connectionRef.current = connection;
      } catch (err) {
        logger.error('ActivitiesHub connection failed:', err);
        if (isMounted) {
          // Retry after delay if token was the issue
          setTimeout(() => {
            if (isMounted) connectHub();
          }, 5000);
        }
      }
    };

    connectHub();

    return () => {
      logger.debug('Cleaning up ActivitiesHub connection');
      isMounted = false;
      if (connection && connection.state === HubConnectionState.Connected) {
        connection.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
    };
  }, [user?.email]);

  const joinGroup = useCallback(async (groupName) => {
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
  }, []);

  const leaveGroup = useCallback(async (groupName) => {
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
  }, []);

  return {
    connection: connectionRef.current,
    isConnected: connectionRef.current?.state === HubConnectionState.Connected,
    joinGroup,
    leaveGroup
  };
}
