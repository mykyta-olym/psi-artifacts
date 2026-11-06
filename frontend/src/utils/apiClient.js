// src/utils/apiClient.js

// Default to relative '/api' so dev proxy can remove CORS entirely
const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const DEFAULT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const cacheStore = new Map();
const listeners = new Set();
let inFlightRequests = 0;
let refreshPromise = null;
let accessToken = null;
let refreshToken = null;

function broadcast(active) {
  for (const fn of listeners) {
    try {
      fn(active);
    } catch {
      /* ignore listener errors */
    }
  }
}

function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(inFlightRequests);
  return () => listeners.delete(listener);
}

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* fall back */ }
  }
  // primitives or JSON-compatible objects
  if (typeof value === 'object') {
    try { return JSON.parse(JSON.stringify(value)); } catch { /* ignore */ }
  }
  return value;
}

function buildCacheKey(method, path, body, customKey) {
  if (customKey) return customKey;
  const raw = body ? JSON.stringify(body) : '';
  return `${method.toUpperCase()}:${path}${raw ? `:${raw}` : ''}`;
}

const GENERIC_HTTP_LABELS = new Set(['unauthorized', 'forbidden', 'not found', 'conflict', 'bad request', 'error']);

function tryParseJson(str) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed || !(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function mapStatusToFriendly(status, fallback) {
  switch (status) {
    case 400:
      return 'Invalid request. Please review the entered data and try again.';
    case 401:
      return 'Authentication required. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested item could not be found.';
    case 409:
      return 'This action conflicts with existing data. Please refresh and retry.';
    case 422:
      return 'Submitted data is invalid. Please fix the highlighted issues.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The server encountered an error. Please try again later.';
    default:
      return fallback;
  }
}

function deriveErrorMessage(payload, fallback, status) {
  if (!payload) return fallback;
  if (typeof payload === 'string') {
    const parsed = tryParseJson(payload);
    if (parsed) return deriveErrorMessage(parsed, fallback, status);
    const trimmed = payload.trim();
    if (!trimmed.length) return fallback;
    if (GENERIC_HTTP_LABELS.has(trimmed.toLowerCase())) {
      return mapStatusToFriendly(status, trimmed);
    }
    return trimmed;
  }
  if (typeof payload === 'object') {
    const candidates = [payload.message, payload.error, payload.detail, payload.title];
    const found = candidates.find((val) => typeof val === 'string' && val.trim().length);
    if (found) {
      const trimmed = found.trim();
      if (GENERIC_HTTP_LABELS.has(trimmed.toLowerCase())) {
        return mapStatusToFriendly(status, trimmed);
      }
      return trimmed;
    }
    if (Array.isArray(payload.errors) && payload.errors.length) {
      const first = payload.errors[0];
      if (typeof first === 'string' && first.trim().length) return first.trim();
      if (typeof first === 'object') {
        const nested = deriveErrorMessage(first, '', status);
        if (nested) return nested;
      }
    }
  }
  return fallback;
}

async function readErrorPayload(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await res.text();
    return text;
  } catch {
    return null;
  }
}

function readCache(key, ttl) {
  const entry = cacheStore.get(key);
  if (!entry) return undefined;
  const isExpired = ttl > 0 && Date.now() - entry.ts > ttl;
  if (isExpired) {
    cacheStore.delete(key);
    return undefined;
  }
  return cloneValue(entry.payload);
}

function writeCache(key, payload) {
  cacheStore.set(key, { payload: cloneValue(payload), ts: Date.now() });
}

function invalidateCache(match) {
  if (!match) {
    cacheStore.clear();
    return;
  }
  const matcher =
      typeof match === 'function'
          ? match
          : (key) => String(key).includes(String(match));
  for (const key of cacheStore.keys()) {
    if (matcher(key)) {
      cacheStore.delete(key);
    }
}
}

function getAccessToken() {
  return accessToken;
}
function getRefreshToken() {
  return refreshToken;
}

function emitAuthEvent(name, detail) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* noop */ }
}
function setTokens({ accessToken: nextAccess, refreshToken: nextRefresh }) {
  let updated = false;
  if (typeof nextAccess === 'string' && nextAccess.length) {
    accessToken = nextAccess;
    updated = true;
  }
  if (typeof nextRefresh === 'string' && nextRefresh.length) {
    refreshToken = nextRefresh;
    updated = true;
  }
  if (updated) {
    emitAuthEvent('mais:auth:tokens', { accessToken: accessToken || null, refreshToken: refreshToken || null });
  }
}
function clearTokens() {
  accessToken = null;
  refreshToken = null;
  emitAuthEvent('mais:auth:logout');
}

function normalizeCacheOption(cacheOpt, method) {
  if (method === 'GET') {
    if (cacheOpt === false) return null;
    if (cacheOpt === true || cacheOpt == null) {
      return { ttl: DEFAULT_CACHE_TTL, strategy: 'cache-first' };
    }
    return {
      ttl: typeof cacheOpt.ttl === 'number' ? cacheOpt.ttl : DEFAULT_CACHE_TTL,
      key: cacheOpt.key,
      strategy: cacheOpt.strategy || 'cache-first',
    };
  }

  if (!cacheOpt) return null;
  if (typeof cacheOpt.invalidate === 'undefined') return null;
  return {
    invalidate: cacheOpt.invalidate,
  };
}

async function refreshAccessToken() {
  const storedRefresh = getRefreshToken();
  if (!storedRefresh && !refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
      credentials: 'include'
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await readErrorPayload(res);
          const defaultMessage = mapStatusToFriendly(res.status, 'Unable to refresh session.');
          const message = deriveErrorMessage(payload, defaultMessage, res.status);
          const err = new Error(message);
          err.status = res.status;
          err.body = payload;
          throw err;
        }
        const data = await res.json();
        if (data?.accessToken || data?.refreshToken) {
          setTokens({
            accessToken: data?.accessToken ?? null,
            refreshToken: data?.refreshToken ?? null,
          });
        }
        emitAuthEvent('mais:auth:refreshed', { user: data?.user ?? null });
        return data;
      })
      .catch((err) => {
        clearTokens();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  if (!storedRefresh) {
    throw new Error('No refresh token available');
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const hdrs = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ refreshToken: storedRefresh }),
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await readErrorPayload(res);
        const defaultMessage = mapStatusToFriendly(res.status, 'Unable to refresh session.');
        const message = deriveErrorMessage(payload, defaultMessage, res.status);
        const err = new Error(message);
        err.status = res.status;
        err.body = payload;
        throw err;
      }
      const data = await res.json();
      if (data?.accessToken || data?.refreshToken) {
        setTokens({
          accessToken: data?.accessToken,
          refreshToken: data?.refreshToken || storedRefresh,
        });
      }
      emitAuthEvent('mais:auth:refreshed', { user: data?.user ?? null });
      return data;
    })().catch((err) => {
      if (err && (err.status === 401 || err.status === 403)) {
        clearTokens();
      }
      throw err;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function shouldAttemptRefresh(path) {
  if (!path) return true;
  const lower = String(path).toLowerCase();
  if (lower.startsWith('/auth/login')) return false;
  if (lower.startsWith('/auth/refresh')) return false;
  if (lower.startsWith('/auth/logout')) return false;
  if (lower.startsWith('/auth/session')) return false; // Don't attempt refresh for session check
  return true;
}

function shouldSilentFail(path) {
  if (!path) return false;
  const lower = String(path).toLowerCase();
  // These endpoints are expected to return 401 when not authenticated
  if (lower.startsWith('/auth/session')) return true;
  if (lower.startsWith('/users/preferences')) return true;
  return false;
}

async function request(path, { method = 'GET', headers = {}, body, cache, signal, skipAuthRetry = false } = {}) {
  const cacheCfg = normalizeCacheOption(cache, method);
  const cacheKey = cacheCfg ? buildCacheKey(method, path, body, cacheCfg.key) : null;
  if (cacheKey && cacheCfg.strategy !== 'network-first') {
    const cached = readCache(cacheKey, cacheCfg.ttl);
    if (cached !== undefined) return cached;
  }

  const token = getAccessToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const hdrs = {
    Accept: 'application/json',
    ...(!isFormData && body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  inFlightRequests += 1;
  broadcast(inFlightRequests);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: hdrs,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      credentials: 'include',
      signal,
    }).catch((fetchErr) => {
      // Handle network errors (server offline, CORS, timeout, etc.)
      const err = new Error('Unable to connect to the server. Please check your connection and try again.');
      err.status = 0;
      err.body = null;
      err.method = method;
      err.path = path;
      err.networkError = true;
      err.originalError = fetchErr;
      
      // Don't log for silent endpoints
      if (!shouldSilentFail(path)) {
        console.error(`[API] Network error: ${method} ${path}`, fetchErr);
      }
      
      throw err;
    });

  if (!res.ok) {
    // For endpoints that are expected to return 401 when not authenticated, handle silently
    if (res.status === 401 && shouldSilentFail(path)) {
      const err = new Error('Not authenticated');
      err.status = 401;
      err.body = null;
      err.method = method;
      err.path = path;
      err.silent = true; // Mark as silent to prevent console logging
      throw err;
    }
    
    if (res.status === 401 && !skipAuthRetry && shouldAttemptRefresh(path) && getRefreshToken()) {
      try {
        await refreshAccessToken();
        return request(path, { method, headers, body, cache, signal, skipAuthRetry: true });
      } catch (refreshErr) {
        const err = new Error(refreshErr?.message || 'Authentication required. Please sign in again.');
        err.status = refreshErr?.status || res.status;
        err.body = refreshErr?.body;
        err.method = method;
        err.path = path;
        throw err;
      }
    }
    const payload = await readErrorPayload(res);
    const defaultMessage = mapStatusToFriendly(res.status, `Request failed with status ${res.status}`);
    let message = deriveErrorMessage(payload, defaultMessage, res.status);
    if (GENERIC_HTTP_LABELS.has(String(message).toLowerCase())) {
      message = mapStatusToFriendly(res.status, message);
    }
    const err = new Error(message);
    err.status = res.status;
    err.body = payload;
    err.method = method;
    err.path = path;
    
    // Log non-silent errors to console for debugging
    if (!shouldSilentFail(path) && !err.silent) {
      console.error(`[API] ${res.status} ${method} ${path}:`, message, payload);
    }
    
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
    const result = ct.includes('application/json') ? await res.json() : await res.text();
    
    // Attach X-Total-Count header if present (for pagination)
    if (res.headers.has('X-Total-Count')) {
      const totalCount = parseInt(res.headers.get('X-Total-Count'), 10);
      if (Number.isFinite(totalCount)) {
        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
          result._totalCount = totalCount;
        } else if (Array.isArray(result)) {
          // For arrays, attach as a property on a wrapper object if includeTotal is requested
          // Otherwise, just return the array (backward compatible)
        }
      }
    }

    if (cacheKey && method === 'GET') {
      writeCache(cacheKey, result);
    }
    if (method !== 'GET' && cacheCfg?.invalidate) {
      invalidateCache(cacheCfg.invalidate);
    }
    return result;
  } finally {
    inFlightRequests = Math.max(0, inFlightRequests - 1);
    broadcast(inFlightRequests);
  }
}

export const api = {
  baseUrl: API_BASE,
  get: (p, options = {}) => request(p, { method: 'GET', ...options }),
  post: (p, body, options = {}) => request(p, { method: 'POST', body, ...options }),
  postWithHeaders: (p, body, headers = {}, options = {}) => request(p, { method: 'POST', body, headers, ...options }),
  put: (p, body, options = {}) => request(p, { method: 'PUT', body, ...options }),
  patch: (p, body, options = {}) => request(p, { method: 'PATCH', body, ...options }),
  del: (p, options = {}) => request(p, { method: 'DELETE', ...options }),
  delete: (p, options = {}) => request(p, { method: 'DELETE', ...options }),
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  refreshTokens: () => refreshAccessToken(),
  invalidateCache,
  subscribe,
  peekCache(key, ttl = DEFAULT_CACHE_TTL) {
    return key ? readCache(key, ttl) : undefined;
  },
  DEFAULT_CACHE_TTL,
};

export default api;
