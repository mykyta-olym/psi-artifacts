// src/pages/profile/components/CookieSettingsPanel.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';
import { setUserPreference } from '../../../data/userPreferencesApi';
import {
  getCookieConsent,
  saveCookieConsent,
  getConsentDetails,
  COOKIE_CONSENT_KEY,
  COOKIE_TYPES,
  needsRenewal,
  getDaysUntilExpiry
} from '../../../utils/cookieConsent';
import { useToasts } from '../../../components/ui/Toasts';

import { createLogger } from '../../../utils/logger';
const logger = createLogger('CookieSettingsPanel');

const CookieSettingsPanel = () => {
  const { user } = useAuth();
  const { notify } = useToasts();
  const [loading, setLoading] = useState(false);
  const [expandedType, setExpandedType] = useState(null);
  const [consent, setConsent] = useState({
    necessary: true,
    functional: false,
    analytics: false,
  });
  const [consentDetails, setConsentDetails] = useState(null);
  const [showRenewalWarning, setShowRenewalWarning] = useState(false);

  useEffect(() => {
    // Load current consent
    const current = getCookieConsent();
    if (current) {
      setConsent({
        necessary: current.necessary ?? true,
        functional: current.functional ?? false,
        analytics: current.analytics ?? false,
      });
      setConsentDetails(getConsentDetails());
      setShowRenewalWarning(needsRenewal());
    }
  }, []);

  const toggleExpand = (type) => {
    setExpandedType(expandedType === type ? null : type);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save with validation
      const success = saveCookieConsent(consent);
      
      if (!success) {
        notify('error', 'Failed to save preferences. Invalid consent data.', {
          title: 'Validation Error'
        });
        return;
      }

      // Save to backend if user is authenticated
      if (user?.email) {
        try {
          await setUserPreference(COOKIE_CONSENT_KEY, {
            ...consent,
            timestamp: new Date().toISOString(),
            version: '1.1',
          });
        } catch (err) {
          logger.warn('Failed to save cookie consent to backend:', err);
          notify('warning', 'Preferences saved locally but failed to sync to server.', {
            title: 'Partial Save'
          });
          return;
        }
      }

      setConsentDetails(getConsentDetails());
      setShowRenewalWarning(false);
      notify('success', 'Cookie preferences updated successfully.', {
        title: 'Preferences Saved'
      });
    } catch (err) {
      logger.error('Failed to save cookie consent:', err);
      notify('error', 'Failed to save cookie preferences. Please try again.', {
        title: 'Save Error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const minimalConsent = {
      necessary: true,
      functional: false,
      analytics: false,
    };
    setConsent(minimalConsent);
  };

  const hasChanges = () => {
    const current = getCookieConsent();
    if (!current) return true;
    return (
      current.functional !== consent.functional ||
      current.analytics !== consent.analytics
    );
  };

  return (
    <section className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Cookie Preferences</h3>
          <p className="text-sm text-white/60">
            Manage how we use cookies to enhance your experience
          </p>
        </div>
        <Icon name="Shield" size={20} className="text-muted-foreground" />
      </div>

      {showRenewalWarning && consentDetails?.daysUntilExpiry !== null && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <Icon name="AlertTriangle" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-300">
              <p className="font-medium mb-1">Consent Renewal Required</p>
              <p className="text-amber-200/80">
                Your cookie consent expires in {consentDetails.daysUntilExpiry} days 
                (on {consentDetails.expiryDate}). Please review and update your preferences to continue using all features.
              </p>
            </div>
          </div>
        </div>
      )}

      {consentDetails && (
        <div className="mb-4 p-3 rounded-lg bg-white/5 border border-border/30">
          <div className="flex items-center justify-between gap-4 text-xs text-white/70">
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={12} />
              <span>
                Last updated: {consentDetails.date} at {consentDetails.time}
              </span>
            </div>
            {consentDetails.daysUntilExpiry !== null && (
              <div className="flex items-center gap-2">
                <Icon name="Calendar" size={12} />
                <span>
                  Expires: {consentDetails.expiryDate} ({consentDetails.daysUntilExpiry} days left)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-4">
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

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
        <Button
          onClick={handleSave}
          loading={loading}
          disabled={loading || !hasChanges()}
          className="flex-1"
          iconName="Save"
        >
          Save Preferences
        </Button>
        <Button
          onClick={handleReset}
          disabled={loading}
          variant="outline"
          className="flex-1"
          iconName="RotateCcw"
        >
          Reset to Minimal
        </Button>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-2">
          <Icon name="Info" size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-white/80">
            <p className="font-medium text-amber-300 mb-1">Important:</p>
            <p>
              Changes to cookie preferences may require a page refresh to take full effect. 
              Some features may not work optimally if certain cookies are disabled.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CookieSettingsPanel;

