// src/hooks/useEnrollmentHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('EnrollmentHub');

/**
 * Custom hook for connecting to the Enrollment SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onEnrollmentCreated - Callback when an enrollment is created
 * @param {Function} options.onEnrollmentUpdated - Callback when an enrollment is updated
 * @param {Function} options.onEnrollmentCancelled - Callback when an enrollment is cancelled
 * @param {Function} options.onEnrollmentConfirmed - Callback when an enrollment is confirmed
 * @returns {Object} Hub connection utilities
 */
export default function useEnrollmentHub({
  onEnrollmentCreated,
  onEnrollmentUpdated,
  onEnrollmentCancelled,
  onEnrollmentConfirmed
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onEnrollmentCreated, onEnrollmentUpdated, onEnrollmentCancelled, onEnrollmentConfirmed });

  useEffect(() => {
    handlersRef.current = { onEnrollmentCreated, onEnrollmentUpdated, onEnrollmentCancelled, onEnrollmentConfirmed };
  }, [onEnrollmentCreated, onEnrollmentUpdated, onEnrollmentCancelled, onEnrollmentConfirmed]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/enrollment`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('EnrollmentCreated', (payload) => {
      logger.debug('EnrollmentCreated received:', payload);
      handlersRef.current.onEnrollmentCreated?.(payload);
    });

    connection.on('EnrollmentUpdated', (payload) => {
      logger.debug('EnrollmentUpdated received:', payload);
      handlersRef.current.onEnrollmentUpdated?.(payload);
    });

    connection.on('EnrollmentCancelled', (payload) => {
      logger.debug('EnrollmentCancelled received:', payload);
      handlersRef.current.onEnrollmentCancelled?.(payload);
    });

    connection.on('EnrollmentConfirmed', (payload) => {
      logger.debug('EnrollmentConfirmed received:', payload);
      handlersRef.current.onEnrollmentConfirmed?.(payload);
    });

    connection.start()
      .then(() => logger.info('EnrollmentHub connected successfully'))
      .catch((err) => logger.error('EnrollmentHub connection failed:', err));

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
