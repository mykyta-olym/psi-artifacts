import { useEffect, useRef } from 'react';
import useUserPreference from './useUserPreference';
import {
  STORAGE_KEY as STUDY_PREFERENCE_KEY,
  cacheSelectedStudy,
  clearSelectedStudyCache,
  loadCachedSelectedStudy,
} from '../pages/study-selection/utils/studyUtils';

export default function useSelectedStudyValue() {
  const pref = useUserPreference(STUDY_PREFERENCE_KEY, null);
  const cacheRef = useRef(typeof window !== 'undefined' ? loadCachedSelectedStudy() : null);

  useEffect(() => {
    if (!pref.loading) {
      if (pref.value) {
        cacheSelectedStudy(pref.value);
        cacheRef.current = pref.value;
      } else {
        // Check session storage for cached value when pref is empty
        const cached = loadCachedSelectedStudy();
        if (cached) {
          cacheRef.current = cached;
        } else {
          cacheRef.current = null;
          clearSelectedStudyCache();
        }
      }
    }
  }, [pref.loading, pref.value]);

  // Always re-read from cache on each render to catch updates from other components
  const freshCache = typeof window !== 'undefined' ? loadCachedSelectedStudy() : null;
  const effectiveValue = pref.value || freshCache || cacheRef.current;

  return {
    value: effectiveValue,
    loading: pref.loading && !effectiveValue,
  };
}

