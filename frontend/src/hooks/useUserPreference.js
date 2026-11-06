import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUserPreferences, setUserPreference, deleteUserPreference } from '../data/userPreferencesApi';
import { useAuth } from '../contexts/AuthContext';

export default function useUserPreference(key, defaultValue) {
  const { user } = useAuth();
  const email = user?.email || '';
  const defaultValueRef = useRef(defaultValue);
  // Update ref if defaultValue changes (but don't trigger re-fetch)
  if (defaultValueRef.current !== defaultValue) {
    defaultValueRef.current = defaultValue;
  }
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    if (!key) {
      setValue(defaultValueRef.current);
      setLoading(false);
      return () => {};
    }

    const load = async () => {
      setLoading(true);
      try {
        if (!email) {
          setValue(defaultValueRef.current);
          return;
        }
        const prefs = await getUserPreferences([key]);
        if (ignore) return;
        const next = Object.prototype.hasOwnProperty.call(prefs, key) ? prefs[key] : defaultValueRef.current;
        setValue(next === undefined ? defaultValueRef.current : next);
      } catch {
        if (!ignore) setValue(defaultValueRef.current);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [key, email]);

  const save = useCallback(
    async (nextValue) => {
      setValue(nextValue);
      if (!key || !email) return;
      try {
        if (nextValue === undefined || nextValue === null) {
          await deleteUserPreference(key);
        } else {
          await setUserPreference(key, nextValue);
        }
      } catch {
        // swallow errors; caller can decide to report
      }
    },
    [key, email],
  );

  const reset = useCallback(async () => {
    setValue(defaultValueRef.current);
    if (!key || !email) return;
    try {
      await deleteUserPreference(key);
    } catch {
      // ignore
    }
  }, [key, email]);

  return useMemo(() => ({ value, setValue: save, reset, loading }), [value, save, reset, loading]);
}

