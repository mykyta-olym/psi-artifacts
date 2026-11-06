// src/hooks/useFacultyHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('FacultyHub');

/**
 * Custom hook for connecting to the Faculty SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onFacultyAdded - Callback when a faculty member is added
 * @param {Function} options.onFacultyUpdated - Callback when a faculty member is updated
 * @param {Function} options.onFacultyRemoved - Callback when a faculty member is removed
 * @param {Function} options.onScheduleAssigned - Callback when schedule is assigned to faculty
 * @returns {Object} Hub connection utilities
 */
export default function useFacultyHub({
  onFacultyAdded,
  onFacultyUpdated,
  onFacultyRemoved,
  onScheduleAssigned
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onFacultyAdded, onFacultyUpdated, onFacultyRemoved, onScheduleAssigned });

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = { onFacultyAdded, onFacultyUpdated, onFacultyRemoved, onScheduleAssigned };
  }, [onFacultyAdded, onFacultyUpdated, onFacultyRemoved, onScheduleAssigned]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/faculty`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Register event handlers
    connection.on('FacultyAdded', (payload) => {
      logger.debug('FacultyAdded received:', payload);
      handlersRef.current.onFacultyAdded?.(payload);
    });

    connection.on('FacultyUpdated', (payload) => {
      logger.debug('FacultyUpdated received:', payload);
      handlersRef.current.onFacultyUpdated?.(payload);
    });

    connection.on('FacultyRemoved', (payload) => {
      logger.debug('FacultyRemoved received:', payload);
      handlersRef.current.onFacultyRemoved?.(payload);
    });

    connection.on('ScheduleAssigned', (payload) => {
      logger.debug('ScheduleAssigned received:', payload);
      handlersRef.current.onScheduleAssigned?.(payload);
    });

    connection.onclose((error) => {
      logger.warn('FacultyHub connection closed', error);
    });

    connection.onreconnecting((error) => {
      logger.info('FacultyHub reconnecting...', error);
    });

    connection.onreconnected((connId) => {
      logger.info('FacultyHub reconnected:', connId);
    });

    connection.start()
      .then(() => {
        logger.info('FacultyHub connected successfully');
      })
      .catch((err) => {
        logger.error('FacultyHub connection failed:', err);
      });

    connectionRef.current = connection;

    return () => {
      logger.debug('Cleaning up FacultyHub connection');
      if (connection.state === HubConnectionState.Connected) {
        connection.stop().catch((err) => logger.error('Error stopping connection:', err));
      }
    };
  }, [user?.email]);

  const joinDepartment = useCallback(async (departmentCode) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot join department - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('JoinDepartment', departmentCode);
      logger.debug('Joined department:', departmentCode);
    } catch (err) {
      logger.error('Failed to join department:', err);
    }
  }, []);

  const leaveDepartment = useCallback(async (departmentCode) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      logger.warn('Cannot leave department - not connected');
      return;
    }
    try {
      await connectionRef.current.invoke('LeaveDepartment', departmentCode);
      logger.debug('Left department:', departmentCode);
    } catch (err) {
      logger.error('Failed to leave department:', err);
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
    joinDepartment,
    leaveDepartment,
    joinGroup,
    leaveGroup
  };
}
