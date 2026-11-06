// src/hooks/useStudentsHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('StudentsHub');

/**
 * Custom hook for connecting to the Students SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onStudentAdded - Callback when a student is added
 * @param {Function} options.onStudentUpdated - Callback when a student is updated
 * @param {Function} options.onStudentRemoved - Callback when a student is removed
 * @param {Function} options.onStudentEnrolled - Callback when a student enrolls in a course
 * @returns {Object} Hub connection utilities
 */
export default function useStudentsHub({
  onStudentAdded,
  onStudentUpdated,
  onStudentRemoved,
  onStudentEnrolled
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onStudentAdded, onStudentUpdated, onStudentRemoved, onStudentEnrolled });

  useEffect(() => {
    handlersRef.current = { onStudentAdded, onStudentUpdated, onStudentRemoved, onStudentEnrolled };
  }, [onStudentAdded, onStudentUpdated, onStudentRemoved, onStudentEnrolled]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/students`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('StudentAdded', (payload) => {
      logger.debug('StudentAdded received:', payload);
      handlersRef.current.onStudentAdded?.(payload);
    });

    connection.on('StudentUpdated', (payload) => {
      logger.debug('StudentUpdated received:', payload);
      handlersRef.current.onStudentUpdated?.(payload);
    });

    connection.on('StudentRemoved', (payload) => {
      logger.debug('StudentRemoved received:', payload);
      handlersRef.current.onStudentRemoved?.(payload);
    });

    connection.on('StudentEnrolled', (payload) => {
      logger.debug('StudentEnrolled received:', payload);
      handlersRef.current.onStudentEnrolled?.(payload);
    });

    connection.start()
      .then(() => logger.info('StudentsHub connected successfully'))
      .catch((err) => logger.error('StudentsHub connection failed:', err));

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
