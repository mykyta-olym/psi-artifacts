// Security utilities for input validation and sanitization

/**
 * Sanitize HTML to prevent XSS attacks
 */
export const sanitizeHtml = (input) => {
  if (!input) return '';
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validate student ID format
 */
export const isValidStudentId = (id) => {
  if (!id) return false;
  // Allow alphanumeric and common separators
  return /^[a-zA-Z0-9_-]+$/.test(String(id));
};

/**
 * Validate course code format
 */
export const isValidCourseCode = (code) => {
  if (!code) return false;
  // Allow alphanumeric and common separators
  return /^[a-zA-Z0-9_-]+$/.test(String(code));
};

/**
 * Sanitize string input (trim and limit length)
 */
export const sanitizeString = (input, maxLength = 500) => {
  if (!input) return '';
  const str = String(input).trim();
  return str.length > maxLength ? str.substring(0, maxLength) : str;
};

/**
 * Validate numeric input
 */
export const isValidNumber = (value, min = -Infinity, max = Infinity) => {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
};

/**
 * Validate date string
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Sanitize object keys to prevent prototype pollution
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip dangerous keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

/**
 * Rate limiting helper
 */
export class RateLimiter {
  constructor(maxCalls = 5, windowMs = 1000) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
    this.calls = [];
  }

  isAllowed() {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < this.windowMs);
    
    if (this.calls.length >= this.maxCalls) {
      return false;
    }
    
    this.calls.push(now);
    return true;
  }

  reset() {
    this.calls = [];
  }
}

/**
 * Generate CSRF token
 */
export const generateCsrfToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate file upload
 */
export const validateFileUpload = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
  } = options;

  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }

  return { valid: true };
};

/**
 * Escape special characters for use in RegExp
 */
export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Check if string contains potential SQL injection
 */
export const hasSqlInjection = (input) => {
  if (!input || typeof input !== 'string') return false;
  
  const sqlPatterns = [
    /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /('|"|;|--|\*|\/\*)/
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Validate and sanitize URL
 */
export const sanitizeUrl = (url) => {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
};
