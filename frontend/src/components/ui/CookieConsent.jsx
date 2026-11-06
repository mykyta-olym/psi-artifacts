// src/components/ui/CookieConsent.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from './Button';
import { Checkbox } from './Checkbox';
import Icon from '../AppIcon';
import { setUserPreference } from '../../data/userPreferencesApi';
import { createLogger } from '../../utils/logger';
const logger = createLogger('CookieConsent');

import { 
  getCookieConsent, 
  saveCookieConsent, 
  COOKIE_CONSENT_KEY,
  COOKIE_TYPES,
  getDaysUntilExpiry,
  needsRenewal 
} from '../../utils/cookieConsent';

export default function CookieConsent() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedType, setExpandedType] = useState(null);
  const [consent, setConsent] = useState({
    necessary: true,
    functional: false,
    analytics: false,
  });
  const [showRenewal, setShowRenewal] = useState(false);

  useEffect(() => {
    // Check if consent was already given
    const stored = getCookieConsent();
    
    if (!stored) {
      // No consent, show banner
      setShow(true);
      return;
    }
    
    // Check if needs renewal
    if (needsRenewal()) {
      setShowRenewal(true);
      setShow(true);
      setConsent({
        necessary: true,
        functional: stored.functional ?? false,
        analytics: stored.analytics ?? false,
      });
    }
  }, []);

  const handleAcceptAll = useCallback(async () => {
    const fullConsent = {
      necessary: true,
      functional: true,
      analytics: true,
    };
    await saveConsent(fullConsent);
  }, []);

  const handleAcceptSelected = useCallback(async () => {
    await saveConsent(consent);
  }, [consent]);

  const handleRejectAll = useCallback(async () => {
    const minimalConsent = {
      necessary: true,
      functional: false,
      analytics: false,
    };
    await saveConsent(minimalConsent);
  }, []);

  const toggleExpand = useCallback((type) => {
    setExpandedType(prev => prev === type ? null : type);
  }, []);

  const saveConsent = async (consentData) => {
    setLoading(true);
    try {
      // Save to localStorage with validation
      const success = saveCookieConsent(consentData);
      
      if (!success) {
        logger.error('Failed to save consent to localStorage');
        return;
      }

      // Save to backend if user is authenticated
      if (user?.email) {
        try {
          await setUserPreference(COOKIE_CONSENT_KEY, {
            ...consentData,
            timestamp: new Date().toISOString(),
            version: '1.1',
          });
          logger.info('Consent synced to backend');
        } catch (err) {
          logger.warn('Failed to save cookie consent to backend:', err);
          // Continue anyway, localStorage is saved
        }
      }

      setShow(false);
      setShowRenewal(false);
    } catch (err) {
      logger.error('Failed to save cookie consent:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const daysLeft = getDaysUntilExpiry();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 pointer-events-none">
      <div className="max-w-5xl mx-auto pointer-events-auto">
        <div className="glass-card rounded-2xl border border-border/80 p-6 sm:p-8 shadow-modal backdrop-blur-glass">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center">
                <Icon name="Shield" size={20} className="text-sky-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {showRenewal ? 'Cookie Consent Renewal Required' : 'Cookie Consent'}
                </h3>
                {showRenewal && daysLeft !== null && (
                  <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-sm text-amber-300">
                      <Icon name="AlertTriangle" size={16} />
                      <span>Your cookie consent expires in {daysLeft} days. Please review and update your preferences.</span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-white/80 leading-relaxed">
                  We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
                  By clicking "Accept All", you consent to our use of cookies. You can customize your preferences below.
                  {showRenewal && ' Your previous preferences have been pre-selected.'}
                </p>
              </div>
            </div>

            {/* Cookie Types */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              {Object.values(COOKIE_TYPES).map((cookieType) => {
                const isExpanded = expandedType === cookieType.id;
                const isChecked = consent[cookieType.id];
                const isDisabled = cookieType.alwaysActive;

                return (
                  <div key={cookieType.id} className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => {
                          if (!isDisabled) {
                            setConsent({ ...consent, [cookieType.id]: e.target.checked });
                          }
                        }}
                        label={
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{cookieType.name}</span>
                              {isDisabled && (
                                <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                                  Always active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/60 mt-0.5">{cookieType.description}</p>
                          </div>
                        }
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpand(cookieType.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        aria-label={isExpanded ? 'Hide details' : 'Show details'}
                        aria-expanded={isExpanded}
                      >
                        <Icon 
                          name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
                          size={16} 
                          className="text-white/60" 
                        />
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="ml-7 pl-4 border-l-2 border-border/30 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div>
                          <h4 className="text-xs font-semibold text-white/90 mb-1.5">Examples:</h4>
                          <ul className="space-y-1">
                            {cookieType.examples.map((example, idx) => (
                              <li key={idx} className="text-xs text-white/70 flex items-start gap-2">
                                <span className="text-sky-400 mt-0.5">•</span>
                                <span>{example}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3 rounded-lg bg-white/5 border border-border/30">
                          <h4 className="text-xs font-semibold text-white/90 mb-1.5">
                            {isChecked ? 'Consequences if enabled:' : 'Consequences if disabled:'}
                          </h4>
                          <p className="text-xs text-white/70 leading-relaxed">
                            {isChecked ? cookieType.consequences.enabled : cookieType.consequences.disabled}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-white/60">
                          <div className="flex items-center gap-1.5">
                            <Icon name="Clock" size={12} />
                            <span>Duration: {cookieType.duration}</span>
                          </div>
                          {!cookieType.thirdParty && (
                            <div className="flex items-center gap-1.5">
                              <Icon name="Shield" size={12} />
                              <span>First-party only</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/50">
              <Button
                onClick={handleAcceptAll}
                loading={loading}
                disabled={loading}
                className="flex-1"
                iconName="CheckCircle"
              >
                Accept All
              </Button>
              <Button
                onClick={handleAcceptSelected}
                loading={loading}
                disabled={loading}
                variant="secondary"
                className="flex-1"
                iconName="Settings"
              >
                Save Preferences
              </Button>
              <Button
                onClick={handleRejectAll}
                loading={loading}
                disabled={loading}
                variant="outline"
                className="flex-1"
                iconName="XCircle"
              >
                Reject All
              </Button>
            </div>

            {/* Footer Info */}
            <div className="text-xs text-white/50 text-center pt-2 border-t border-border/30">
              <p>
                You can change your cookie preferences at any time in your{' '}
                <a href="/profile" className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
                  profile settings
                </a>
                . For more information, see our{' '}
                <a href="/privacy" className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
