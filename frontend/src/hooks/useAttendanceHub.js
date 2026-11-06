// src/hooks/useAttendanceHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('AttendanceHub');

/**
 * Custom hook for connecting to the Attendance SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onAttendanceUpdated - Callback when attendance is updated
 * @param {Function} options.onAttendanceMarked - Callback when attendance is marked
 * @param {Function} options.onBulkAttendanceUpdated - Callback when bulk attendance is updated
 * @param {string[]} options.courseCodes - Optional array of course codes to subscribe to
 * @returns {Object} Hub connection utilities
 */
export default function useAttendanceHub({
  onAttendanceUpdated,
  onAttendanceMarked,
  onBulkAttendanceUpdated,
  courseCodes = []
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onAttendanceUpdated, onAttendanceMarked, onBulkAttendanceUpdated });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { onAttendanceUpdated, onAttendanceMarked, onBulkAttendanceUpdated };
  }, [onAttendanceUpdated, onAttendanceMarked, onBulkAttendanceUpdated]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/attendance`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Register event handlers
    connection.on('AttendanceUpdated', (payload) => {
      logger.debug('AttendanceUpdated received:', payload);
      handlersRef.current.onAttendanceUpdated?.(payload);
    });

    connection.on('AttendanceMarked', (payload) => {
      logger.debug('AttendanceMarked received:', payload);
      handlersRef.current.onAttendanceMarked?.(payload);
    });

    connection.on('BulkAttendanceUpdated', (payload) => {
      logger.debug('BulkAttendanceUpdated received:', payload);
      handlersRef.current.onBulkAttendanceUpdated?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('AttendanceHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('AttendanceHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('AttendanceHub reconnected:', connId);
      // Rejoin course groups after reconnection
      if (courseCodes.length > 0) {
        courseCodes.forEach(courseCode => {
          connection.invoke('JoinCourse', courseCode).catch(err => {
            logger.error(`Failed to rejoin course ${courseCode}:`, err);
          });
        });
      }
    });

    connection.start()
      .then(() => {
        logger.info('AttendanceHub connected successfully');
        // Join course-specific groups if provided
        if (courseCodes.length > 0) {
          courseCodes.forEach(courseCode => {
            connection.invoke('JoinCourse', courseCode).catch(err => {
              logger.error(`Failed to join course ${courseCode}:`, err);
            });
          });
        }
      })
      .catch((err) => {
        logger.error('AttendanceHub connection failed:', err);
      });

    connectionRef.current = connection;

    return () => {
      logger.debug('Cleaning up AttendanceHub connection');
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
    };
  }, [user?.email, courseCodes.join(',')]);

  const joinCourse = useCallback(async (courseCode) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot join course - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('JoinCourse', courseCode);
      logger.debug('Joined course:', courseCode);
    } catch (err) {
      logger.error('Failed to join course:', err);
    }
  }, []);

  const leaveCourse = useCallback(async (courseCode) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot leave course - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('LeaveCourse', courseCode);
      logger.debug('Left course:', courseCode);
    } catch (err) {
      logger.error('Failed to leave course:', err);
    }
  }, []);

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
    joinCourse,
    leaveCourse,
    joinGroup,
    leaveGroup
  };
}
