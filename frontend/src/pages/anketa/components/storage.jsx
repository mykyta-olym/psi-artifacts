// src/pages/anketa/components/storage.jsx
import { nowISO } from '../utils/utils';
import {
  fetchSurveys,
  fetchSurveyResponses,
  submitSurveyResponse,
  createSurvey,
  updateSurvey,
  deleteSurvey
} from '../../../data/surveysApi';
import api from '../../../utils/apiClient';

const clone = (value) => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* ignore */
    }
  }
  return JSON.parse(JSON.stringify(value ?? null));
};

let cache = {
  defs: [],
  drafts: {},
  responses: {},
};

let hydrated = false;
let hydrationPromise = null;

const isAuthenticated = () => {
  return !!api.getAccessToken();
};

/**
 * Load surveys and responses from backend
 */
const ensureHydrated = async () => {
  if (hydrated) return;
  if (!isAuthenticated()) {
    hydrated = true;
    return;
  }
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      try {
        // Fetch surveys with stats
        const surveys = await fetchSurveys({ includeStats: true });
        cache.defs = Array.isArray(surveys) ? surveys : [];

        // Fetch responses for all surveys (teacher-only)
        // Students will see their own responses through survey stats
        cache.responses = {};
        
        // Load drafts from localStorage (browser-specific, not persisted to backend)
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const draftsJson = window.localStorage.getItem('anketa.drafts');
            cache.drafts = draftsJson ? JSON.parse(draftsJson) : {};
          } catch {
            cache.drafts = {};
          }
        }
      } catch (error) {
        console.error('[storage] Failed to hydrate from backend:', error);
        cache = { defs: [], drafts: {}, responses: {} };
      } finally {
        hydrated = true;
        hydrationPromise = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('anketa:storage:hydrated'));
        }
      }
    })();
  }
  return hydrationPromise;
};

/**
 * Read survey definitions from backend cache
 */
export const readDefs = async () => {
  if (!hydrated) await ensureHydrated();
  return Array.isArray(cache.defs) ? clone(cache.defs) ?? [] : [];
};

/**
 * Create or update survey in backend
 */
export const writeDefs = async (defs) => {
  if (!Array.isArray(defs)) return;
  
  // Sync to backend - only update/create surveys that changed
  try {
    const oldCache = clone(cache.defs) ?? [];
    const updatedCache = [];
    const processedIds = new Set();
    
    for (const survey of defs) {
      // Check if this is a new temporary survey that needs to be created
      const isTemporary = survey.id && survey.id.startsWith('survey_new_');
      const existingInCache = oldCache.find(s => s.id === survey.id);
      
      if (isTemporary) {
        // Create new survey in backend - it will get a real ID
        try {
          const created = await createSurvey(survey);
          updatedCache.push(created);
          processedIds.add(created.id);
        } catch (error) {
          console.error('[storage] Failed to create survey:', error);
          // Keep temporary survey in cache if creation failed
          updatedCache.push(survey);
          processedIds.add(survey.id);
        }
      } else if (existingInCache) {
        // Check if survey actually changed (deep comparison of relevant fields)
        const hasChanged = 
          survey.title !== existingInCache.title ||
          survey.published !== existingInCache.published ||
          JSON.stringify(survey.questions) !== JSON.stringify(existingInCache.questions) ||
          JSON.stringify(survey.meta) !== JSON.stringify(existingInCache.meta);
        
        if (hasChanged) {
          // Update existing survey only if it changed
          try {
            const updated = await updateSurvey(survey.id, survey);
            updatedCache.push(updated);
            processedIds.add(updated.id);
          } catch (error) {
            console.error('[storage] Failed to update survey:', error);
            // Keep old survey data if update failed
            updatedCache.push(existingInCache);
            processedIds.add(survey.id);
          }
        } else {
          // No changes, keep existing cache data
          updatedCache.push(existingInCache);
          processedIds.add(survey.id);
        }
      } else {
        // New survey with proper ID (shouldn't happen, but keep it)
        updatedCache.push(survey);
        processedIds.add(survey.id);
      }
    }
    
    // Update cache with real data from backend
    cache.defs = updatedCache;
    
    // Trigger storage update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anketa:storage:updated'));
    }
  } catch (error) {
    console.error('[storage] Failed to sync surveys to backend:', error);
    // On error, still update cache optimistically
    cache.defs = clone(defs);
  }
};

/**
 * Read drafts from localStorage (browser-only)
 */
export const readDrafts = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const draftsJson = window.localStorage.getItem('anketa.drafts');
      cache.drafts = draftsJson ? JSON.parse(draftsJson) : {};
    } catch {
      cache.drafts = {};
    }
  }
  return cache.drafts ? clone(cache.drafts) ?? {} : {};
};

/**
 * Write drafts to localStorage (browser-only)
 */
export const writeDrafts = (db) => {
  cache.drafts = db && typeof db === 'object' ? clone(db) ?? {} : {};
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('anketa.drafts', JSON.stringify(cache.drafts));
    } catch {
      console.warn('[storage] Failed to save drafts to localStorage');
    }
  }
};

export const loadEntry = (surveyId) => {
  const entry = (cache.drafts || {})[surveyId];
  return entry ? clone(entry) : null;
};

export const saveEntry = (surveyId, entry) => {
  if (!surveyId) return;
  const next = { ...(cache.drafts || {}) };
  next[surveyId] = clone(entry);
  cache.drafts = next;
  writeDrafts(cache.drafts);
};

export const clearEntry = (surveyId) => {
  if (!surveyId || !cache.drafts || !cache.drafts[surveyId]) return;
  const next = { ...(cache.drafts || {}) };
  delete next[surveyId];
  cache.drafts = next;
  writeDrafts(cache.drafts);
};

/**
 * Read responses from backend (teacher-only)
 */
export const readResponses = async () => {
  if (!hydrated) await ensureHydrated();
  return cache.responses ? clone(cache.responses) ?? {} : {};
};

/**
 * Not used - responses are read-only from backend
 */
export const writeResponses = (obj) => {
  console.warn('[storage] writeResponses is deprecated - responses are managed by backend');
};

/**
 * Submit a response to the backend
 */
export const addResponse = async (surveyId, submission) => {
  if (!surveyId || !submission) return;
  
  try {
    // Submit to backend API
    await submitSurveyResponse(surveyId, submission.answers);
    
    // Update local cache for immediate UI feedback
    const db = { ...(cache.responses || {}) };
    const arr = Array.isArray(db[surveyId]) ? [...db[surveyId]] : [];
    const idx = submission.uid ? arr.findIndex((x) => x.uid === submission.uid) : -1;
    if (idx >= 0) {
      arr[idx] = clone(submission);
    } else {
      arr.unshift(clone(submission));
    }
    db[surveyId] = arr;
    cache.responses = db;
    
    // Clear draft after successful submission
    clearEntry(surveyId);
  } catch (error) {
    console.error('[storage] Failed to submit survey response:', error);
    throw error;
  }
};

/**
 * Get cached responses for a survey synchronously (for display purposes)
 */
export const getResponsesSync = (surveyId) => {
  if (!surveyId) return [];
  const db = cache.responses || {};
  return Array.isArray(db[surveyId]) ? clone(db[surveyId]) ?? [] : [];
};

/**
 * Get responses for a survey from backend (teacher-only)
 */
export const getResponses = async (surveyId) => {
  if (!surveyId) return [];
  
  // Skip temporary/unsaved surveys
  if (surveyId.startsWith('survey_new_')) {
    return [];
  }
  
  try {
    const responses = await fetchSurveyResponses(surveyId);
    
    // Update cache
    const db = { ...(cache.responses || {}) };
    db[surveyId] = Array.isArray(responses) ? responses : [];
    cache.responses = db;
    
    return clone(responses) ?? [];
  } catch (error) {
    console.error('[storage] Failed to fetch survey responses:', error);
    // Return cached responses if fetch fails
    const db = cache.responses || {};
    return Array.isArray(db[surveyId]) ? clone(db[surveyId]) ?? [] : [];
  }
};

export const stampSubmission = (answers, uid, name) => ({
  id: `sub_${Math.random().toString(36).slice(2)}_${Date.now()}`,
  uid,
  name,
  answers,
  submittedAt: nowISO(),
});

export const isAnketaStorageHydrated = () => hydrated;