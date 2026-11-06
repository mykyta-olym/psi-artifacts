// src/hooks/useGradesHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('GradesHub');

/**
 * Custom hook for connecting to the Grades SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onGradeUpdated - Callback when a grade is updated
 * @param {Function} options.onGradeCreated - Callback when a grade is created
 * @param {Function} options.onGradeDeleted - Callback when a grade is deleted
 * @param {Function} options.onBulkGradesUpdated - Callback when multiple grades are updated
 * @param {string[]} options.courseIds - Optional array of course IDs to subscribe to
 * @returns {Object} Hub connection utilities
 */
export default function useGradesHub({
  onGradeUpdated,
  onGradeCreated,
  onGradeDeleted,
  onBulkGradesUpdated,
  courseIds = []
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onGradeUpdated, onGradeCreated, onGradeDeleted, onBulkGradesUpdated });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { onGradeUpdated, onGradeCreated, onGradeDeleted, onBulkGradesUpdated };
  }, [onGradeUpdated, onGradeCreated, onGradeDeleted, onBulkGradesUpdated]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/grades`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Register event handlers
    connection.on('GradeUpdated', (payload) => {
      logger.debug('GradeUpdated received:', payload);
      handlersRef.current.onGradeUpdated?.(payload);
    });

    connection.on('GradeCreated', (payload) => {
      logger.debug('GradeCreated received:', payload);
      handlersRef.current.onGradeCreated?.(payload);
    });

    connection.on('GradeDeleted', (payload) => {
      logger.debug('GradeDeleted received:', payload);
      handlersRef.current.onGradeDeleted?.(payload);
    });

    connection.on('BulkGradesUpdated', (payload) => {
      logger.debug('BulkGradesUpdated received:', payload);
      handlersRef.current.onBulkGradesUpdated?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('GradesHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('GradesHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('GradesHub reconnected:', connId);
      // Rejoin course groups after reconnection
      if (courseIds.length > 0) {
        courseIds.forEach(courseId => {
          connection.invoke('JoinCourse', courseId).catch(err => {
            logger.error(`Failed to rejoin course ${courseId}:`, err);
          });
        });
      }
    });

    connection.start()
      .then(() => {
        logger.info('GradesHub connected successfully');
        // Join course-specific groups if provided
        if (courseIds.length > 0) {
          courseIds.forEach(courseId => {
            connection.invoke('JoinCourse', courseId).catch(err => {
              logger.error(`Failed to join course ${courseId}:`, err);
            });
          });
        }
      })
      .catch((err) => {
        logger.error('GradesHub connection failed:', err);
      });

    connectionRef.current = connection;

    return () => {
      logger.debug('Cleaning up GradesHub connection');
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
    };
  }, [user?.email, courseIds.join(',')]);

  const joinCourse = useCallback(async (courseId) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot join course - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('JoinCourse', courseId);
      logger.debug('Joined course:', courseId);
    } catch (err) {
      logger.error('Failed to join course:', err);
    }
  }, []);

  const leaveCourse = useCallback(async (courseId) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot leave course - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('LeaveCourse', courseId);
      logger.debug('Left course:', courseId);
    } catch (err) {
      logger.error('Failed to leave course:', err);
    }
  }, []);

  return {
    connection: connectionRef.current,
    isConnected: connectionRef.current?.state === HubConnectionState.Connected,
    joinCourse,
    leaveCourse
  };
}
