// src/hooks/useCookieConsent.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getCookieConsent, 
  saveCookieConsent, 
  isCookieTypeAllowed,
  getActiveCookieTypes,
  COOKIE_CONSENT_KEY 
} from '../utils/cookieConsent';
import { setUserPreference, getUserPreferences } from '../data/userPreferencesApi';
import { createLogger } from '../utils/logger';
const logger = createLogger('useCookieConsent');

/**
 * Hook for managing cookie consent
 * @returns {Object} Consent state and functions
 */
export default function useCookieConsent() {
  const { user } = useAuth();
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load consent from localStorage and backend
  useEffect(() => {
    const loadConsent = async () => {
      setLoading(true);
      try {
        // First, try to get from localStorage
        let localConsent = getCookieConsent();
        
        // If user is authenticated, try to sync with backend
        if (user?.email) {
          try {
            const backendPrefs = await getUserPreferences([COOKIE_CONSENT_KEY]);
            const backendConsent = backendPrefs[COOKIE_CONSENT_KEY];
            
            // If backend has consent and it's newer, use it
            if (backendConsent && backendConsent.timestamp) {
              const backendTime = new Date(backendConsent.timestamp).getTime();
              const localTime = localConsent ? new Date(localConsent.timestamp).getTime() : 0;
              
              if (backendTime > localTime) {
                localConsent = backendConsent;
                saveCookieConsent(backendConsent);
              } else if (localConsent && localTime > backendTime) {
                // Local is newer, sync to backend
                await setUserPreference(COOKIE_CONSENT_KEY, localConsent);
              }
            } else if (localConsent) {
              // Only local exists, sync to backend
              await setUserPreference(COOKIE_CONSENT_KEY, localConsent);
            }
          } catch (err) {
            logger.warn('Failed to sync cookie consent with backend:', err);
            // Continue with local consent
          }
        }
        
        setConsent(localConsent);
      } catch (err) {
        logger.error('Failed to load cookie consent:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConsent();

    // Listen for consent updates
    const handleConsentUpdate = (event) => {
      setConsent(event.detail);
    };

    window.addEventListener('mais:cookie-consent:updated', handleConsentUpdate);
    return () => {
      window.removeEventListener('mais:cookie-consent:updated', handleConsentUpdate);
    };
  }, [user?.email]);

  const updateConsent = useCallback(async (newConsent) => {
    const consentPayload = {
      ...newConsent,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    saveCookieConsent(consentPayload);
    setConsent(consentPayload);

    // Sync to backend if authenticated
    if (user?.email) {
      try {
        await setUserPreference(COOKIE_CONSENT_KEY, consentPayload);
      } catch (err) {
        logger.warn('Failed to save cookie consent to backend:', err);
      }
    }
  }, [user?.email]);

  const isAllowed = useCallback((type) => {
    return isCookieTypeAllowed(type);
  }, [consent]);

  const activeTypes = getActiveCookieTypes();

  return {
    consent,
    loading,
    hasConsent: consent !== null,
    isAllowed,
    activeTypes,
    updateConsent,
  };
}

