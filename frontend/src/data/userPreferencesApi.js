import api from '../utils/apiClient';

export async function getUserPreferences(keys = []) {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!list.length) return {};
  const query = `?keys=${list.map((k) => encodeURIComponent(k)).join(',')}`;
  try {
    const res = await api.get(`/users/preferences${query}`, { cache: { strategy: 'network-first', ttl: 0 } });
    return res || {};
  } catch (error) {
    // Silently handle 401/403 errors when user is not authenticated
    if (error?.status === 401 || error?.status === 403) {
      return {};
    }
    // Re-throw other errors
    throw error;
  }
}

export async function setUserPreference(key, value) {
  if (!key) throw new Error('Preference key is required');
  await api.put('/users/preferences', { key, value });
}

export async function deleteUserPreference(key) {
  if (!key) return;
  await api.delete(`/users/preferences/${encodeURIComponent(key)}`);
}

