// src/hooks/useThesisHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('ThesisHub');

/**
 * Custom hook for connecting to the Thesis SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onThesisCreated - Callback when a thesis is created
 * @param {Function} options.onThesisUpdated - Callback when a thesis is updated
 * @param {Function} options.onThesisDeleted - Callback when a thesis is deleted
 * @param {Function} options.onThesisRequestCreated - Callback when a thesis request is created
 * @param {Function} options.onThesisRequestUpdated - Callback when a thesis request is updated
 * @param {Function} options.onThesisAssigned - Callback when a thesis is assigned to a student
 * @returns {Object} Hub connection utilities
 */
export default function useThesisHub({
  onThesisCreated,
  onThesisUpdated,
  onThesisDeleted,
  onThesisRequestCreated,
  onThesisRequestUpdated,
  onThesisAssigned
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ 
    onThesisCreated, 
    onThesisUpdated, 
    onThesisDeleted,
    onThesisRequestCreated,
    onThesisRequestUpdated,
    onThesisAssigned
  });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { 
      onThesisCreated, 
      onThesisUpdated, 
      onThesisDeleted,
      onThesisRequestCreated,
      onThesisRequestUpdated,
      onThesisAssigned
    };
  }, [onThesisCreated, onThesisUpdated, onThesisDeleted, onThesisRequestCreated, onThesisRequestUpdated, onThesisAssigned]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/thesis`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Register event handlers
    connection.on('ThesisCreated', (payload) => {
      logger.debug('ThesisCreated received:', payload);
      handlersRef.current.onThesisCreated?.(payload);
    });

    connection.on('ThesisUpdated', (payload) => {
      logger.debug('ThesisUpdated received:', payload);
      handlersRef.current.onThesisUpdated?.(payload);
    });

    connection.on('ThesisDeleted', (payload) => {
      logger.debug('ThesisDeleted received:', payload);
      handlersRef.current.onThesisDeleted?.(payload);
    });

    connection.on('ThesisRequestCreated', (payload) => {
      logger.debug('ThesisRequestCreated received:', payload);
      handlersRef.current.onThesisRequestCreated?.(payload);
    });

    connection.on('ThesisRequestUpdated', (payload) => {
      logger.debug('ThesisRequestUpdated received:', payload);
      handlersRef.current.onThesisRequestUpdated?.(payload);
    });

    connection.on('ThesisAssigned', (payload) => {
      logger.debug('ThesisAssigned received:', payload);
      handlersRef.current.onThesisAssigned?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('ThesisHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('ThesisHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('ThesisHub reconnected:', connId);
    });

    connection.start()
      .then(() => {
        logger.info('ThesisHub connected successfully');
      })
      .catch((err) => {
        logger.error('ThesisHub connection failed:', err);
      });

    connectionRef.current = connection;

    return () => {
      logger.debug('Cleaning up ThesisHub connection');
      if (connection.state === HubConnectionState.Connected) {
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
