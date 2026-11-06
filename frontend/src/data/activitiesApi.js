// src/data/activitiesApi.js
import api from '../utils/apiClient';

/**
 * Get activities with filtering, sorting, and pagination
 */
export async function getActivities(options = {}) {
  const {
    type,
    q,
    from,
    to,
    requiresAction,
    sort = 'time',
    dir = 'desc',
    page = 1,
    perPage = 10,
  } = options;

  const params = new URLSearchParams();
  if (type && type !== 'all' && type !== 'pinned') params.set('type', type);
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (requiresAction) params.set('requiresAction', 'true');
  if (sort !== 'time') params.set('sort', sort);
  if (dir !== 'desc') params.set('dir', dir);
  if (page !== 1) params.set('page', String(page));
  if (perPage !== 10) params.set('perPage', String(perPage));

  const query = params.toString();
  const url = `/activities${query ? `?${query}` : ''}`;

  return await api.get(url, { cache: { strategy: 'network-first', ttl: 30000 } });
}

/**
 * Get a single activity by ID
 */
export async function getActivity(id) {
  return await api.get(`/activities/${encodeURIComponent(id)}`, {
    cache: { strategy: 'network-first', ttl: 60000 }
  });
}

/**
 * Get activities for a specific user (teachers only)
 */
export async function getUserActivities(userEmail, options = {}) {
  const {
    type,
    requiresAction,
    sort = 'time',
    dir = 'desc',
    page = 1,
    perPage = 20,
  } = options;

  const params = new URLSearchParams();
  if (type && type !== 'all' && type !== 'pinned') params.set('type', type);
  if (requiresAction) params.set('requiresAction', 'true');
  if (sort !== 'time') params.set('sort', sort);
  if (dir !== 'desc') params.set('dir', dir);
  if (page !== 1) params.set('page', String(page));
  if (perPage !== 20) params.set('perPage', String(perPage));

  const query = params.toString();
  const url = `/activities/user/${encodeURIComponent(userEmail)}${query ? `?${query}` : ''}`;

  return await api.get(url, { cache: { strategy: 'network-first', ttl: 30000 } });
}

/**
 * Create a new activity (teachers only)
 */
export async function createActivity(activity) {
  return await api.post('/activities', activity);
}

/**
 * Update an activity
 */
export async function updateActivity(id, updates) {
  return await api.put(`/activities/${encodeURIComponent(id)}`, updates);
}

/**
 * Mark activities as resolved
 */
export async function resolveActivities(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  return await api.post('/activities/resolve', ids, { cache: { invalidate: ['/activities'] } });
}

/**
 * Mark activities as requiring action (teachers only)
 */
export async function markActivitiesNeedsAction(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  return await api.post('/activities/mark-needs-action', ids, { cache: { invalidate: ['/activities'] } });
}

/**
 * Delete activities (soft delete - archive, teachers only)
 */
export async function deleteActivities(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  return await api.post('/activities/bulk-delete', ids, { cache: { invalidate: ['/activities'] } });
}

/**
 * Get activity statistics
 */
export async function getActivityStats() {
  return await api.get('/activities/stats', {
    cache: { strategy: 'network-first', ttl: 60000 }
  });
}

