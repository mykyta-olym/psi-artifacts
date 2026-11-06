// src/utils/cookieConsent.js
// Comprehensive cookie consent management with GDPR compliance

import { createLogger } from './logger';
const logger = createLogger('CookieConsent');

const COOKIE_CONSENT_STORAGE_KEY = 'mais_cookie_consent';
const COOKIE_CONSENT_KEY = 'cookie_consent';
const CONSENT_VERSION = '1.1'; // Increment when cookie policy changes
const CONSENT_EXPIRY_DAYS = 365; // Consent expires after 1 year (GDPR requirement)

/**
 * Validate consent object structure
 * @param {Object} consent - Consent object to validate
 * @returns {boolean} True if valid
 */
function isValidConsentObject(consent) {
  if (!consent || typeof consent !== 'object') return false;
  if (!consent.timestamp || !consent.version) return false;
  if (typeof consent.necessary !== 'boolean') return false;
  if (typeof consent.functional !== 'boolean') return false;
  if (typeof consent.analytics !== 'boolean') return false;
  return true;
}

/**
 * Check if consent has expired
 * @param {Object} consent - Consent object
 * @returns {boolean} True if expired
 */
function isConsentExpired(consent) {
  if (!consent?.timestamp) return true;
  
  try {
    const consentDate = new Date(consent.timestamp);
    const expiryDate = new Date(consentDate);
    expiryDate.setDate(expiryDate.getDate() + CONSENT_EXPIRY_DAYS);
    
    return new Date() > expiryDate;
  } catch {
    return true; // Invalid date, consider expired
  }
}

/**
 * Check if consent version is outdated
 * @param {Object} consent - Consent object
 * @returns {boolean} True if outdated
 */
function isConsentOutdated(consent) {
  return consent?.version !== CONSENT_VERSION;
}

/**
 * Get current cookie consent from localStorage with validation
 * @returns {Object|null} Valid consent object or null
 */
export function getCookieConsent() {
  try {
    const stored = typeof localStorage !== 'undefined' 
      ? localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) 
      : null;
    
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    
    // Validate structure
    if (!isValidConsentObject(parsed)) {
      logger.warn('Invalid consent object in storage, clearing');
      clearCookieConsent();
      return null;
    }
    
    // Check if expired
    if (isConsentExpired(parsed)) {
      logger.info('Consent has expired, clearing');
      clearCookieConsent();
      return null;
    }
    
    // Check if outdated version
    if (isConsentOutdated(parsed)) {
      logger.info('Consent version outdated, clearing');
      clearCookieConsent();
      return null;
    }
    
    return parsed;
  } catch (err) {
    logger.error('Failed to parse consent from localStorage:', err);
    clearCookieConsent();
    return null;
  }
}

/**
 * Check if user has given valid consent
 * @returns {boolean}
 */
export function hasCookieConsent() {
  return getCookieConsent() !== null;
}

/**
 * Check if specific cookie type is allowed
 * @param {string} type - 'necessary' | 'functional' | 'analytics'
 * @returns {boolean}
 */
export function isCookieTypeAllowed(type) {
  const consent = getCookieConsent();
  if (!consent) return false;
  
  // Necessary cookies are always allowed if consent exists
  if (type === 'necessary') return true;
  
  return consent[type] === true;
}

/**
 * Save cookie consent with validation
 * @param {Object} consentData - Consent object {necessary, functional, analytics}
 * @returns {boolean} True if saved successfully
 */
export function saveCookieConsent(consentData) {
  try {
    // Sanitize and validate input
    const consentPayload = {
      necessary: Boolean(consentData.necessary ?? true), // Always true
      functional: Boolean(consentData.functional ?? false),
      analytics: Boolean(consentData.analytics ?? false),
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
    
    // Validate before saving
    if (!isValidConsentObject(consentPayload)) {
      logger.error('Attempted to save invalid consent object');
      return false;
    }
    
    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consentPayload));
    }
    
    // Dispatch event for reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mais:cookie-consent:updated', {
        detail: consentPayload
      }));
    }
    
    logger.info('Cookie consent saved:', { 
      functional: consentPayload.functional, 
      analytics: consentPayload.analytics 
    });
    
    return true;
  } catch (err) {
    logger.error('Failed to save cookie consent:', err);
    return false;
  }
}

/**
 * Clear cookie consent and cleanup
 * @returns {void}
 */
export function clearCookieConsent() {
  try {
    // Clear from localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    }
    
    logger.info('Cookie consent cleared');
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mais:cookie-consent:cleared'));
      
      // Clear analytics cookies if they exist
      if (typeof document !== 'undefined') {
        document.cookie.split(';').forEach(cookie => {
          const name = cookie.split('=')[0].trim();
          if (name.startsWith('_ga') || name.startsWith('_gid')) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          }
        });
      }
    }
  } catch (err) {
    logger.error('Failed to clear cookie consent:', err);
  }
}

/**
 * Get consent details for display
 * @returns {Object|null} Consent details with formatted date
 */
export function getConsentDetails() {
  const consent = getCookieConsent();
  if (!consent) return null;
  
  const daysLeft = getDaysUntilExpiry();
  
  return {
    ...consent,
    date: consent.timestamp ? new Date(consent.timestamp).toLocaleDateString() : null,
    time: consent.timestamp ? new Date(consent.timestamp).toLocaleTimeString() : null,
    daysUntilExpiry: daysLeft,
    expiryDate: consent.timestamp ? new Date(new Date(consent.timestamp).getTime() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString() : null,
  };
}

/**
 * Cookie type definitions with GDPR-compliant information
 */
export const COOKIE_TYPES = {
  necessary: {
    id: 'necessary',
    name: 'Necessary Cookies',
    description: 'Essential cookies required for the website to function. These cannot be disabled as they enable core functionality.',
    alwaysActive: true,
    examples: [
      'Authentication tokens - Keep you logged in during your session',
      'Security tokens - Protect against CSRF attacks and unauthorized access',
      'User interface preferences - Remember your language, theme, and layout choices',
      'Session data - Maintain your browsing session across pages',
      'Form data - Prevent data loss when filling out forms'
    ],
    consequences: {
      enabled: 'Website functions normally with full security, session management, and user experience.',
      disabled: 'Cannot be disabled. Without these cookies, the website cannot function properly or securely.'
    },
    duration: 'Session cookies expire when you close your browser. Persistent cookies (for "Remember me") last up to 30 days.',
    thirdParty: false,
    dataCollected: ['Session ID', 'User preferences', 'Security tokens'],
    legalBasis: 'Strictly necessary for service provision (GDPR Art. 6(1)(b))'
  },
  functional: {
    id: 'functional',
    name: 'Functional Cookies',
    description: 'Enable enhanced functionality and personalization to improve your experience.',
    alwaysActive: false,
    examples: [
      'User preferences - Remember your customized settings (theme, language, layout)',
      'Chat history - Preserve your conversation state and message history',
      'Form auto-fill - Save form field data for faster completion',
      'Video player settings - Remember volume, quality, and playback preferences',
      'Accessibility settings - Maintain your chosen accessibility options',
      'Dashboard customization - Save widget positions and preferences'
    ],
    consequences: {
      enabled: 'Enhanced user experience with personalized features, saved preferences, and improved convenience.',
      disabled: 'You will need to reconfigure your preferences on each visit. Some features may not work optimally or remember your choices.'
    },
    duration: 'Up to 1 year from last update',
    thirdParty: false,
    dataCollected: ['User preferences', 'UI customization', 'Feature settings'],
    legalBasis: 'Legitimate interest or consent (GDPR Art. 6(1)(f) or 6(1)(a))'
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website to improve user experience and service quality.',
    alwaysActive: false,
    examples: [
      'Page views and navigation - Track which pages are visited and how users navigate',
      'Time on page - Measure engagement with different content',
      'Error tracking - Identify and fix technical issues quickly',
      'Performance metrics - Monitor loading times and optimize performance',
      'Feature usage - Understand which features are most valuable',
      'User flow analysis - Improve navigation and user journeys'
    ],
    consequences: {
      enabled: 'We can continuously improve the website based on real usage patterns. All data is anonymized and aggregated - no personal information is collected.',
      disabled: 'We cannot track which features are most useful or identify areas for improvement, making it harder to enhance the service.'
    },
    duration: 'Up to 2 years',
    thirdParty: false,
    dataCollected: ['Anonymous page views', 'Aggregated usage statistics', 'Performance metrics'],
    legalBasis: 'Consent required (GDPR Art. 6(1)(a))',
    note: 'All analytics data is anonymized. We do not track personally identifiable information or share data with third parties.'
  }
};

/**
 * Get detailed information about a cookie type
 * @param {string} type - Cookie type ID
 * @returns {Object|null}
 */
export function getCookieTypeInfo(type) {
  return COOKIE_TYPES[type] || null;
}

/**
 * Get all active cookie types
 * @returns {string[]} Array of active cookie type IDs
 */
export function getActiveCookieTypes() {
  const consent = getCookieConsent();
  if (!consent) return ['necessary']; // Only necessary if no consent
  
  const active = ['necessary']; // Always active
  if (consent.functional) active.push('functional');
  if (consent.analytics) active.push('analytics');
  
  return active;
}

/**
 * Get days until consent expires
 * @returns {number|null} Days remaining or null if no consent
 */
export function getDaysUntilExpiry() {
  const consent = getCookieConsent();
  if (!consent?.timestamp) return null;
  
  try {
    const consentDate = new Date(consent.timestamp);
    const expiryDate = new Date(consentDate);
    expiryDate.setDate(expiryDate.getDate() + CONSENT_EXPIRY_DAYS);
    
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  } catch {
    return null;
  }
}

/**
 * Check if consent needs renewal soon (within 30 days)
 * @returns {boolean}
 */
export function needsRenewal() {
  const daysLeft = getDaysUntilExpiry();
  return daysLeft !== null && daysLeft < 30;
}

export { 
  COOKIE_CONSENT_STORAGE_KEY, 
  COOKIE_CONSENT_KEY, 
  CONSENT_VERSION,
  CONSENT_EXPIRY_DAYS 
};

