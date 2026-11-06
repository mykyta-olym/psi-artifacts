// src/hooks/useResourcesHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('ResourcesHub');

/**
 * Custom hook for connecting to the Resources SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onResourceAdded - Callback when a resource is added
 * @param {Function} options.onResourceUpdated - Callback when a resource is updated
 * @param {Function} options.onResourceRemoved - Callback when a resource is removed
 * @param {Function} options.onResourceBooked - Callback when a resource is booked
 * @returns {Object} Hub connection utilities
 */
export default function useResourcesHub({
  onResourceAdded,
  onResourceUpdated,
  onResourceRemoved,
  onResourceBooked
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onResourceAdded, onResourceUpdated, onResourceRemoved, onResourceBooked });

  useEffect(() => {
    handlersRef.current = { onResourceAdded, onResourceUpdated, onResourceRemoved, onResourceBooked };
  }, [onResourceAdded, onResourceUpdated, onResourceRemoved, onResourceBooked]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/resources`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('ResourceAdded', (payload) => {
      logger.debug('ResourceAdded received:', payload);
      handlersRef.current.onResourceAdded?.(payload);
    });

    connection.on('ResourceUpdated', (payload) => {
      logger.debug('ResourceUpdated received:', payload);
      handlersRef.current.onResourceUpdated?.(payload);
    });

    connection.on('ResourceRemoved', (payload) => {
      logger.debug('ResourceRemoved received:', payload);
      handlersRef.current.onResourceRemoved?.(payload);
    });

    connection.on('ResourceBooked', (payload) => {
      logger.debug('ResourceBooked received:', payload);
      handlersRef.current.onResourceBooked?.(payload);
    });

    connection.start()
      .then(() => logger.info('ResourcesHub connected successfully'))
      .catch((err) => logger.error('ResourcesHub connection failed:', err));

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
