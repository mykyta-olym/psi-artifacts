// src/utils/apiErrors.js

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

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

function pickString(values) {
  for (const val of values) {
    if (isNonEmptyString(val)) return String(val).trim();
  }
  return null;
}

function extractFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const direct = pickString([obj.message, obj.error, obj.detail, obj.title, obj.description]);
  if (direct) return direct;
  if (Array.isArray(obj.errors) && obj.errors.length) {
    const first = obj.errors[0];
    if (isNonEmptyString(first)) return first.trim();
    if (typeof first === 'object') {
      const nested = extractFromObject(first);
      if (nested) return nested;
    }
  }
  if (Array.isArray(obj.messages) && obj.messages.length) {
    const firstMsg = pickString(obj.messages);
    if (firstMsg) return firstMsg;
  }
  return null;
}

export function extractApiErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  if (typeof error === 'string') {
    const parsed = tryParseJson(error);
    if (parsed) return extractApiErrorMessage({ body: parsed }, fallback);
    return error.trim() || fallback;
  }

  const { body } = error;
  const status = typeof error.status === 'number' ? error.status : (body && typeof body.status === 'number' ? body.status : null);
  if (isNonEmptyString(body)) {
    const parsed = tryParseJson(body);
    if (parsed) return extractApiErrorMessage({ body: parsed, status }, fallback);
    const trimmed = body.trim();
    if (isGenericHttpLabel(trimmed)) return mapStatusToFriendly(status, trimmed) || fallback;
    return trimmed;
  }
  const fromObj = extractFromObject(body);
  if (fromObj) {
    if (!isGenericHttpLabel(fromObj)) {
      return fromObj;
    }
    const friendly = mapStatusToFriendly(status, null);
    return friendly || fromObj;
  }

  if (isNonEmptyString(error.message)) {
    const trimmed = error.message.trim();
    if (isGenericHttpLabel(trimmed)) return mapStatusToFriendly(status, trimmed) || fallback;
    return trimmed;
  }
  if (isNonEmptyString(error.statusText)) {
    const trimmed = error.statusText.trim();
    if (isGenericHttpLabel(trimmed)) return mapStatusToFriendly(status, trimmed) || fallback;
    return trimmed;
  }

  const mapped = mapStatusToFriendly(status, null);
  if (mapped) return mapped;

  return fallback;
}

export function extractApiErrorDetails(error) {
  if (!error) return null;
  if (typeof error === 'object' && error.body && typeof error.body === 'object') {
    return error.body;
  }
  return null;
}

function isGenericHttpLabel(value) {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.trim().toLowerCase();
  return GENERIC_HTTP_LABELS.has(normalized);
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
