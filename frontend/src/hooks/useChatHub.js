// src/hooks/useChatHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChatHub');

/**
 * Custom hook for connecting to the Chat SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onMessageCreated - Callback when a message is created
 * @param {Function} options.onMessageUpdated - Callback when a message is updated
 * @param {Function} options.onMessageDeleted - Callback when a message is deleted
 * @param {Function} options.onThreadCreated - Callback when a thread is created
 * @param {Function} options.onThreadUpdated - Callback when a thread is updated
 * @param {Function} options.onThreadDeleted - Callback when a thread is deleted
 * @param {Function} options.onThreadCleared - Callback when a thread is cleared
 * @param {Function} options.onMessageReactionsUpdated - Callback when message reactions are updated
 * @param {Function} options.onReadReceiptUpdated - Callback when read receipt is updated
 * @returns {Object} Hub connection utilities
 */
export default function useChatHub({
  onMessageCreated,
  onMessageUpdated,
  onMessageDeleted,
  onThreadCreated,
  onThreadUpdated,
  onThreadDeleted,
  onThreadCleared,
  onMessageReactionsUpdated,
  onReadReceiptUpdated
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ 
    onMessageCreated, 
    onMessageUpdated, 
    onMessageDeleted,
    onThreadCreated,
    onThreadUpdated,
    onThreadDeleted,
    onThreadCleared,
    onMessageReactionsUpdated,
    onReadReceiptUpdated
  });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { 
      onMessageCreated, 
      onMessageUpdated, 
      onMessageDeleted,
      onThreadCreated,
      onThreadUpdated,
      onThreadDeleted,
      onThreadCleared,
      onMessageReactionsUpdated,
      onReadReceiptUpdated
    };
  }, [onMessageCreated, onMessageUpdated, onMessageDeleted, onThreadCreated, onThreadUpdated, onThreadDeleted, onThreadCleared, onMessageReactionsUpdated, onReadReceiptUpdated]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/chat`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Register event handlers
    connection.on('MessageCreated', (payload) => {
      logger.debug('MessageCreated received:', payload);
      handlersRef.current.onMessageCreated?.(payload);
    });

    connection.on('MessageUpdated', (payload) => {
      logger.debug('MessageUpdated received:', payload);
      handlersRef.current.onMessageUpdated?.(payload);
    });

    connection.on('MessageDeleted', (payload) => {
      logger.debug('MessageDeleted received:', payload);
      handlersRef.current.onMessageDeleted?.(payload);
    });

    connection.on('ThreadCreated', (payload) => {
      logger.debug('ThreadCreated received:', payload);
      handlersRef.current.onThreadCreated?.(payload);
    });

    connection.on('ThreadUpdated', (payload) => {
      logger.debug('ThreadUpdated received:', payload);
      handlersRef.current.onThreadUpdated?.(payload);
    });

    connection.on('ThreadDeleted', (payload) => {
      logger.debug('ThreadDeleted received:', payload);
      handlersRef.current.onThreadDeleted?.(payload);
    });

    connection.on('ThreadCleared', (payload) => {
      logger.debug('ThreadCleared received:', payload);
      handlersRef.current.onThreadCleared?.(payload);
    });

    connection.on('MessageReactionsUpdated', (payload) => {
      logger.debug('MessageReactionsUpdated received:', payload);
      handlersRef.current.onMessageReactionsUpdated?.(payload);
    });

    connection.on('ReadReceiptUpdated', (payload) => {
      logger.debug('ReadReceiptUpdated received:', payload);
      handlersRef.current.onReadReceiptUpdated?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('ChatHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('ChatHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('ChatHub reconnected:', connId);
    });

    connection.start()
      .then(() => {
        logger.info('ChatHub connected successfully');
      })
      .catch((err) => {
        logger.error('ChatHub connection failed:', err);
      });

    connectionRef.current = connection;

    return () => {
      logger.debug('Cleaning up ChatHub connection');
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
    };
  }, [user?.email]);

  const joinThread = useCallback(async (threadId) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot join thread - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('JoinThread', threadId);
      logger.debug('Joined thread:', threadId);
    } catch (err) {
      logger.error('Failed to join thread:', err);
    }
  }, []);

  const leaveThread = useCallback(async (threadId) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot leave thread - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('LeaveThread', threadId);
      logger.debug('Left thread:', threadId);
    } catch (err) {
      logger.error('Failed to leave thread:', err);
    }
  }, []);

  return {
    connection: connectionRef.current,
    isConnected: connectionRef.current?.state === HubConnectionState.Connected,
    joinThread,
    leaveThread
  };
}
