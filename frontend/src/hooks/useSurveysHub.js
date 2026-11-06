// src/hooks/useSurveysHub.js
import { useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/apiClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('SurveysHub');

/**
 * Custom hook for connecting to the Surveys SignalR hub
 * @param {Object} options - Configuration options
 * @param {Function} options.onSurveyCreated - Callback when a survey is created
 * @param {Function} options.onSurveyUpdated - Callback when a survey is updated
 * @param {Function} options.onSurveyDeleted - Callback when a survey is deleted
 * @param {Function} options.onSurveyResponseReceived - Callback when a survey response is received
 * @returns {Object} Hub connection utilities
 */
export default function useSurveysHub({
  onSurveyCreated,
  onSurveyUpdated,
  onSurveyDeleted,
  onSurveyResponseReceived
} = {}) {
  const { user } = useAuth();
  const connectionRef = useRef(null);
  const handlersRef = useRef({ onSurveyCreated, onSurveyUpdated, onSurveyDeleted, onSurveyResponseReceived });

  useEffect(() => {
    handlersRef.current = { onSurveyCreated, onSurveyUpdated, onSurveyDeleted, onSurveyResponseReceived };
  }, [onSurveyCreated, onSurveyUpdated, onSurveyDeleted, onSurveyResponseReceived]);

  useEffect(() => {
    if (!user?.email) {
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_BASE || '/api';
    const trimmed = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const withoutApi = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const hubUrl = `${withoutApi || ''}/hubs/surveys`;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => apiClient.getAccessToken() || ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on('SurveyCreated', (payload) => {
      logger.debug('SurveyCreated received:', payload);
      handlersRef.current.onSurveyCreated?.(payload);
    });

    connection.on('SurveyUpdated', (payload) => {
      logger.debug('SurveyUpdated received:', payload);
      handlersRef.current.onSurveyUpdated?.(payload);
    });

    connection.on('SurveyDeleted', (payload) => {
      logger.debug('SurveyDeleted received:', payload);
      handlersRef.current.onSurveyDeleted?.(payload);
    });

    connection.on('SurveyResponseReceived', (payload) => {
      logger.debug('SurveyResponseReceived received:', payload);
      handlersRef.current.onSurveyResponseReceived?.(payload);
    });

    connection.start()
      .then(() => logger.info('SurveysHub connected successfully'))
      .catch((err) => logger.error('SurveysHub connection failed:', err));

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
