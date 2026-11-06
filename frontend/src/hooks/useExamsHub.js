// src/hooks/useExamsHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('ExamsHub');

/**
 * Custom hook for connecting to the Exams SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onExamTermCreated - Callback when an exam term is created
 * @param {Function} options.onExamTermUpdated - Callback when an exam term is updated
 * @param {Function} options.onExamTermDeleted - Callback when an exam term is deleted
 * @param {Function} options.onExamRegistered - Callback when a student registers for an exam
 * @param {Function} options.onExamUnregistered - Callback when a student unregisters from an exam
 * @returns {Object} Hub connection utilities
 */
export default function useExamsHub({
  onExamTermCreated,
  onExamTermUpdated,
  onExamTermDeleted,
  onExamRegistered,
  onExamUnregistered
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ 
    onExamTermCreated, 
    onExamTermUpdated, 
    onExamTermDeleted, 
    onExamRegistered, 
    onExamUnregistered 
  });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { 
      onExamTermCreated, 
      onExamTermUpdated, 
      onExamTermDeleted, 
      onExamRegistered, 
      onExamUnregistered 
    };
  }, [onExamTermCreated, onExamTermUpdated, onExamTermDeleted, onExamRegistered, onExamUnregistered]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/exams`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Register event handlers
    connection.on('ExamTermCreated', (payload) => {
      logger.debug('ExamTermCreated received:', payload);
      handlersRef.current.onExamTermCreated?.(payload);
    });

    connection.on('ExamTermUpdated', (payload) => {
      logger.debug('ExamTermUpdated received:', payload);
      handlersRef.current.onExamTermUpdated?.(payload);
    });

    connection.on('ExamTermDeleted', (payload) => {
      logger.debug('ExamTermDeleted received:', payload);
      handlersRef.current.onExamTermDeleted?.(payload);
    });

    connection.on('ExamRegistered', (payload) => {
      logger.debug('ExamRegistered received:', payload);
      handlersRef.current.onExamRegistered?.(payload);
    });

    connection.on('ExamUnregistered', (payload) => {
      logger.debug('ExamUnregistered received:', payload);
      handlersRef.current.onExamUnregistered?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('ExamsHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('ExamsHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('ExamsHub reconnected:', connId);
    });

    connection.start()
      .then(() => {
        logger.info('ExamsHub connected successfully');
      })
      .catch((err) => {
        logger.error('ExamsHub connection failed:', err);
      });

    connectionRef.current = connection;

    return () => {
      logger.debug('Cleaning up ExamsHub connection');
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
