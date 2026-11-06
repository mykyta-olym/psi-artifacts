// src/contexts/AuthContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import api from '../utils/apiClient';
import { extractApiErrorMessage } from '../utils/apiErrors';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const buildSessionUser = (payload, fallbackEmail) => {
  const email = String(payload?.email || fallbackEmail || '').trim();
  const id = payload?.id || email || randomId();
  const role = payload?.role || 'student';
  const fullName = payload?.fullName || (email ? email.split('@')[0] : 'User');
  return {
    id,
    email,
    role,
    full_name: fullName,
    lastLoginAt: payload?.lastLoginAt || null,
  };
};

const buildProfileFromMe = (sessionUser, me) => {
  if (!sessionUser) return null;
  const fromMe = me?.user ?? me ?? {};
  const fullName =
    (typeof fromMe.fullName === 'string' && fromMe.fullName.trim()) ||
    sessionUser.full_name ||
    '';

  return {
    id: sessionUser.id,
    email: sessionUser.email,
    role: sessionUser.role,
    full_name: fullName,
    faculty: me?.faculty || '',
    program: me?.program || '',
    department: me?.department || '',
    year: me?.studyYear || null,
    degree: me?.degree || null,
    phone: me?.phone || '',
    office: me?.office || '',
    officeHours: me?.officeHours || {},
    workingHours: me?.workingHours || {},
    certifications: Array.isArray(me?.certifications) ? me.certifications : [],
    studentId: me?.student?.id || null,
    personId: me?.student?.personId || null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
};

export const AuthProvider = ({ children } = {}) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileLoading = false;
  const refreshTimerRef = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleTokenRefresh = useCallback(
    (accessToken) => {
      if (typeof window === 'undefined' || !accessToken) return;
      const parts = String(accessToken).split('.');
      if (parts.length < 2) return;
      try {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) base64 += '=';
        const payload = JSON.parse(window.atob(base64));
        const expMs = typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
        if (!expMs) return;
        const now = Date.now();
        const leadMs = 60 * 1000;
        const delay = Math.max(5 * 1000, expMs - now - leadMs);
        clearRefreshTimer();
        refreshTimerRef.current = window.setTimeout(async () => {
          try {
            await api.refreshTokens();
          } catch (err) {
            const stillValidToken = api.getAccessToken();
            if (stillValidToken) scheduleTokenRefresh(stillValidToken);
          }
        }, delay);
      } catch {
        /* ignore decode errors */
      }
    },
    [clearRefreshTimer],
  );

  const handleExternalLogout = useCallback(() => {
    clearRefreshTimer();
    setUser(null);
    setUserProfile(null);
  }, [clearRefreshTimer]);

  const fetchBackendProfile = useCallback(async (sessionUser) => {
    if (!sessionUser?.email) return null;
    try {
      const me = await api.get('/me', { cache: false });
      return buildProfileFromMe(sessionUser, me);
    } catch {
      return null;
    }
  }, []);

  const applySession = useCallback(
    async (payload) => {
      if (!payload?.user) {
        setUser(null);
        setUserProfile(null);
        return;
      }
      const sessionUser = buildSessionUser(payload.user, payload.user?.email);
      setUser(sessionUser);

      if (payload.profile) {
        setUserProfile(payload.profile);
        return;
      }

      const profile = await fetchBackendProfile(sessionUser);
      if (profile) setUserProfile(profile);
    },
    [fetchBackendProfile],
  );

  const hydrateFromSession = useCallback(
    async (options = { silent: false }) => {
      if (!options.silent) setLoading(true);
      try {
        const session = await api
          .get('/auth/session', { cache: false })
          .catch((err) => {
            if (err?.status === 401 || err?.status === 403) return null;
            throw err;
          });

        if (!session) {
          api.clearTokens();
          handleExternalLogout();
          if (!options.silent) setLoading(false);
          return;
        }

        if (session.accessToken || session.refreshToken) {
          api.setTokens({
            accessToken: session.accessToken ?? null,
            refreshToken: session.refreshToken ?? null,
          });
          if (session.accessToken) {
            scheduleTokenRefresh(session.accessToken);
          }
        }

        await applySession(session);
      } catch (err) {
        api.clearTokens();
        handleExternalLogout();
        throw err;
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [applySession, handleExternalLogout, scheduleTokenRefresh],
  );

  useEffect(() => {
    // Attempt to restore session on mount
    // 401 errors are expected if user is not logged in and are handled silently
    hydrateFromSession({ silent: false }).catch(() => {
      // Errors are already handled in hydrateFromSession
      // 401 on /auth/session is normal for logged-out users
    });
  }, [hydrateFromSession]);

  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    const onTokens = (event) => {
      const token = event?.detail?.accessToken || api.getAccessToken();
      if (token) scheduleTokenRefresh(token);
    };
    const onRefreshed = (event) => {
      const refreshed = event?.detail?.user;
      if (!refreshed) return;
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          email: refreshed.email || prev.email,
          role: refreshed.role || prev.role,
          full_name: refreshed.fullName || prev.full_name,
          lastLoginAt: refreshed.lastLoginAt || prev.lastLoginAt,
        };
      });
    };
    const onLogout = () => handleExternalLogout();
    window.addEventListener('mais:auth:tokens', onTokens);
    window.addEventListener('mais:auth:refreshed', onRefreshed);
    window.addEventListener('mais:auth:logout', onLogout);
    return () => {
      window.removeEventListener('mais:auth:tokens', onTokens);
      window.removeEventListener('mais:auth:refreshed', onRefreshed);
      window.removeEventListener('mais:auth:logout', onLogout);
    };
  }, [handleExternalLogout, scheduleTokenRefresh]);

  const signIn = useCallback(
    async ({ email, password, remember = true }) => {
      try {
        const resp = await api.post('/auth/login', { email, password, rememberMe: !!remember });
        if (resp?.accessToken || resp?.refreshToken) {
          api.setTokens({
            accessToken: resp.accessToken ?? null,
            refreshToken: resp.refreshToken ?? null,
          });
          if (resp.accessToken) scheduleTokenRefresh(resp.accessToken);
        }
        await applySession(resp);
        return { data: { user: buildSessionUser(resp?.user, email) }, error: null };
      } catch (e) {
        return { data: null, error: extractApiErrorMessage(e, 'Sign in failed') };
      }
    },
    [applySession, scheduleTokenRefresh],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    api.clearTokens();
    handleExternalLogout();
    return { error: null };
  }, [handleExternalLogout]);

  const updateProfile = useCallback(async () => ({
    data: null,
    error: 'Profile updates are not yet connected to the backend.',
  }), []);

  const requestPasswordReset = useCallback(async ({ email }) => {
    try {
      const resp = await api.post('/auth/forgot-password/request', { email });
      return { data: resp, error: null };
    } catch (e) {
      return { data: null, error: extractApiErrorMessage(e, 'Failed to request password reset') };
    }
  }, []);

  const resendPasswordReset = useCallback(async ({ email }) => {
    try {
      const resp = await api.post('/auth/forgot-password/resend', { email });
      return { data: resp, error: null };
    } catch (e) {
      return { data: null, error: extractApiErrorMessage(e, 'Failed to resend password reset') };
    }
  }, []);

  const verifyResetToken = useCallback(async ({ token }) => {
    try {
      const resp = await api.post('/auth/forgot-password/verify-token', { token });
      return resp?.valid === true;
    } catch {
      return false;
    }
  }, []);

  const verifyResetCode = useCallback(async ({ email, code }) => {
    try {
      const resp = await api.post('/auth/forgot-password/verify-code', { email, code });
      return { data: resp, error: null };
    } catch (e) {
      return { data: null, error: extractApiErrorMessage(e, 'Failed to verify code') };
    }
  }, []);

  const resetPassword = useCallback(async ({ token, newPassword, signOutAll = true }) => {
    try {
      await api.post('/auth/forgot-password/reset', { token, newPassword, signOutAll });
      return { error: null };
    } catch (e) {
      return { error: extractApiErrorMessage(e, 'Failed to reset password') };
    }
  }, []);

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    lastLoginAt: user?.lastLoginAt ?? null,
    signUp: async () => ({ data: null, error: 'Sign up is not supported.' }),
    signIn,
    signOut,
    updateProfile,
    refreshSession: () => hydrateFromSession({ silent: true }),
    requestPasswordReset,
    resendPasswordReset,
    verifyResetToken,
    verifyResetCode,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;