// src/hooks/useScheduleHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('ScheduleHub');

/**
 * Custom hook for connecting to the Schedule SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onScheduleUpdated - Callback when schedule is updated
 * @param {Function} options.onClassAdded - Callback when a class is added
 * @param {Function} options.onClassRemoved - Callback when a class is removed
 * @param {Function} options.onClassRescheduled - Callback when a class is rescheduled
 * @returns {Object} Hub connection utilities
 */
export default function useScheduleHub({
  onScheduleUpdated,
  onClassAdded,
  onClassRemoved,
  onClassRescheduled
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onScheduleUpdated, onClassAdded, onClassRemoved, onClassRescheduled });

  useEffect(() => {
    handlersRef.current = { onScheduleUpdated, onClassAdded, onClassRemoved, onClassRescheduled };
  }, [onScheduleUpdated, onClassAdded, onClassRemoved, onClassRescheduled]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/schedule`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('ScheduleUpdated', (payload) => {
      logger.debug('ScheduleUpdated received:', payload);
      handlersRef.current.onScheduleUpdated?.(payload);
    });

    connection.on('ClassAdded', (payload) => {
      logger.debug('ClassAdded received:', payload);
      handlersRef.current.onClassAdded?.(payload);
    });

    connection.on('ClassRemoved', (payload) => {
      logger.debug('ClassRemoved received:', payload);
      handlersRef.current.onClassRemoved?.(payload);
    });

    connection.on('ClassRescheduled', (payload) => {
      logger.debug('ClassRescheduled received:', payload);
      handlersRef.current.onClassRescheduled?.(payload);
    });

    connection.start()
      .then(() => logger.info('ScheduleHub connected successfully'))
      .catch((err) => logger.error('ScheduleHub connection failed:', err));

    connectionRef.current = connection;

    return () => {
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
    };
  }, [user?.email]);

  const joinGroup = useCallback(async (groupName) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      await connectionRef.current.invoke('JoinGroup', groupName);
      logger.debug('Joined group:', groupName);
    } catch (err) {
      logger.error('Failed to join group:', err);
    }
  }, []);

  return {
    connection: connectionRef.current,
    isConnected: connectionRef.current?.state === HubConnectionState.Connected,
    joinGroup
  };
}
