// src/utils/globalErrorHandler.js
import { extractApiErrorMessage } from './apiErrors';

let toastNotifier = null;
const errorCache = new Map();
const CACHE_DURATION = 3000; // Don't show same error within 3 seconds

export function setGlobalToastNotifier(notifyFn) {
  toastNotifier = notifyFn;
}

function getCacheKey(error) {
  if (!error) return '';
  const status = error.status || 0;
  const path = error.path || '';
  const message = error.message || '';
  return `${status}:${path}:${message}`;
}

function isRecentlyShown(key) {
  if (!key) return false;
  const lastShown = errorCache.get(key);
  if (!lastShown) return false;
  return Date.now() - lastShown < CACHE_DURATION;
}

function markAsShown(key) {
  if (!key) return;
  errorCache.set(key, Date.now());
  // Clean old entries
  setTimeout(() => {
    errorCache.delete(key);
  }, CACHE_DURATION + 1000);
}

export function handleApiError(error, options = {}) {
  const {
    silent = false,
    fallbackMessage = 'An error occurred',
    logToConsole = true,
  } = options;

  // Skip if error is marked as silent (e.g., session check when not logged in)
  if (error?.silent) {
    return;
  }

  // Skip network errors for silent endpoints
  if (error?.networkError && error?.path && (
    error.path.includes('/auth/session') ||
    error.path.includes('/status/ping')
  )) {
    return;
  }

  const cacheKey = getCacheKey(error);
  
  // Don't show duplicate errors too quickly
  if (isRecentlyShown(cacheKey)) {
    return;
  }

  const message = extractApiErrorMessage(error, fallbackMessage);

  // Log to console for debugging (except for expected errors)
  if (logToConsole && !error?.silent) {
    const status = error?.status || 'unknown';
    const method = error?.method || 'REQUEST';
    const path = error?.path || '';
    
    if (error?.networkError) {
      console.error(`[API] Network Error: ${method} ${path}`, error.originalError || error);
    } else if (status >= 500) {
      console.error(`[API] Server Error ${status}: ${method} ${path}`, message, error);
    } else if (status >= 400 && status !== 401 && status !== 404) {
      console.warn(`[API] Client Error ${status}: ${method} ${path}`, message);
    }
  }

  // Show toast notification if notifier is set and error is not silent
  if (!silent && toastNotifier && typeof toastNotifier === 'function') {
    const severity = error?.networkError ? 'error' :
                     error?.status >= 500 ? 'error' :
                     error?.status === 403 ? 'warning' :
                     error?.status === 401 ? 'warning' :
                     'error';

    toastNotifier(severity, message, {
      duration: error?.networkError ? 8000 : 5000,
    });

    markAsShown(cacheKey);
  }

  return message;
}

// Global error event listener for unhandled promise rejections
export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Only handle API errors with this global handler
    if (error && (error.status !== undefined || error.networkError)) {
      // Don't prevent default - let it bubble
      // But log it appropriately
      handleApiError(error, { 
        silent: false,
        logToConsole: true,
      });
    }
  });
}
