// src/data/thesisApi.js
import api from '../utils/apiClient';

// STUDENT – my thesis
export async function getMyThesis() {
  try { return await api.get('/thesis/my'); } catch { return null; }
}
export async function updateMyThesis(patch = {}) {
  return api.put('/thesis/my', patch);
}
export async function submitMyThesis(note) {
  return api.post('/thesis/my/submit', { note });
}

// STUDENT – requests
export async function getMyRequests() {
  try { const res = await api.get('/thesis/requests/my'); return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []); } catch { return []; }
}
export async function createRequest(draft) {
  return api.post('/thesis/requests', draft);
}
export async function updateRequest(id, draft) {
  return api.put(`/thesis/requests/${encodeURIComponent(id)}`, draft);
}
export async function cancelRequest(id) {
  return api.post(`/thesis/requests/${encodeURIComponent(id)}/cancel`, {});
}
export async function deleteRequest(id) {
  return api.del(`/thesis/requests/${encodeURIComponent(id)}`);
}

// STUDENT – browse topics/assignments
export async function listTopics(filters = {}) {
  const q = new URLSearchParams();
  if (filters.q) q.set('q', filters.q);
  if (filters.year) q.set('year', filters.year);
  if (filters.degree && filters.degree !== 'all') q.set('degree', filters.degree);
  if (filters.faculty && filters.faculty !== 'all') q.set('faculty', filters.faculty);
  if (filters.department && filters.department !== 'all') q.set('department', filters.department);
  if (filters.program && filters.program !== 'all') q.set('program', filters.program);
  if (filters.state && filters.state !== 'all') q.set('state', filters.state);
  if (filters.sort) q.set('sort', filters.sort);
  try {
    const res = await api.get(`/thesis/topics${q.toString() ? `?${q.toString()}` : ''}`);
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch { return []; }
}

// TEACHER – topics
export async function listMyTopics(supervisorEmail) {
  const q = new URLSearchParams();
  if (supervisorEmail) q.set('supervisor', supervisorEmail);
  const res = await api.get(`/thesis/topics/my${q.toString() ? `?${q.toString()}` : ''}`);
  return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
}
export async function createTopic(data) {
  return api.post('/thesis/topics', data);
}
export async function updateTopic(id, data) {
  return api.put(`/thesis/topics/${encodeURIComponent(id)}`, data);
}
export async function deleteTopicApi(id) {
  return api.del(`/thesis/topics/${encodeURIComponent(id)}`);
}

// TEACHER – requests
export async function listIncomingRequests(supervisorEmail) {
  const q = new URLSearchParams();
  if (supervisorEmail) q.set('supervisor', supervisorEmail);
  const res = await api.get(`/thesis/requests/incoming${q.toString() ? `?${q.toString()}` : ''}`);
  return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
}
export async function approveRequestApi(id, { topicId, message } = {}) {
  return api.post(`/thesis/requests/${encodeURIComponent(id)}/approve`, { topicId: topicId || null, message: message || '' });
}
export async function returnRequestApi(id, { message } = {}) {
  return api.post(`/thesis/requests/${encodeURIComponent(id)}/return`, { message: message || '' });
}
export async function rejectRequestApi(id, { message } = {}) {
  return api.post(`/thesis/requests/${encodeURIComponent(id)}/reject`, { message: message || '' });
}

// TEACHER – supervisions (assignments)
export async function listSupervisions(supervisorEmail) {
  const q = new URLSearchParams();
  if (supervisorEmail) q.set('supervisor', supervisorEmail);
  const res = await api.get(`/thesis/supervisions${q.toString() ? `?${q.toString()}` : ''}`);
  return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
}
export async function updateSupervisionStatus(id, status) {
  return api.post(`/thesis/supervisions/${encodeURIComponent(id)}/status`, { status });
}
export async function scheduleDefenseApi(id, { date, room }) {
  return api.post(`/thesis/supervisions/${encodeURIComponent(id)}/defense`, { date, room });
}
export async function updateOriginalityApi(id, { percentage, protocolUrl }) {
  return api.post(`/thesis/supervisions/${encodeURIComponent(id)}/originality`, { percentage, protocolUrl });
}
export async function appendGradesApi(id, items) {
  // items: [{ item, term, by, grade, date }, ...]
  return api.post(`/thesis/supervisions/${encodeURIComponent(id)}/grades`, { items: Array.isArray(items) ? items : [] });
}

export default {
  getMyThesis, updateMyThesis, submitMyThesis,
  getMyRequests, createRequest, updateRequest, cancelRequest, deleteRequest,
  listTopics,
  listMyTopics, createTopic, updateTopic, deleteTopicApi,
  listIncomingRequests, approveRequestApi, returnRequestApi, rejectRequestApi,
  listSupervisions, updateSupervisionStatus, scheduleDefenseApi, updateOriginalityApi, appendGradesApi,
};
