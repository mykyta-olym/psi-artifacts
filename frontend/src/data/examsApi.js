// src/data/examsApi.js
import api from '../utils/apiClient';

// Student-facing APIs
export async function listAvailableTerms(params = {}) {
  const q = new URLSearchParams();
  if (params.range) q.set('range', params.range); // e.g., 30d, all
  if (params.termKey) q.set('term', params.termKey);
  try {
    const res = await api.get(`/exams/terms/available${q.toString() ? `?${q.toString()}` : ''}`);
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch {
    return [];
  }
}

export async function listMyTerms(params = {}) {
  const q = new URLSearchParams();
  if (params.range) q.set('range', params.range);
  if (params.termKey) q.set('term', params.termKey);
  try {
    const res = await api.get(`/exams/terms/my${q.toString() ? `?${q.toString()}` : ''}`);
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch {
    return [];
  }
}

export async function registerForTerm(termId) {
  return api.post(`/exams/terms/${encodeURIComponent(termId)}/register`, {});
}

export async function unregisterFromTerm(termId) {
  return api.post(`/exams/terms/${encodeURIComponent(termId)}/unregister`, {});
}

// Teacher-facing APIs
export async function listTeacherTerms(params = {}) {
  const q = new URLSearchParams();
  if (params.range) q.set('range', params.range);
  if (params.termKey) q.set('term', params.termKey);
  try {
    const res = await api.get(`/exams/terms${q.toString() ? `?${q.toString()}` : ''}`);
    return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
  } catch {
    return [];
  }
}

export async function createExamTerm(payload) {
  return api.post('/exams/terms', payload);
}

export async function updateExamTerm(id, payload) {
  return api.put(`/exams/terms/${encodeURIComponent(id)}`, payload);
}

export async function deleteExamTerm(id) {
  return api.del(`/exams/terms/${encodeURIComponent(id)}`);
}

export async function listRegistrationsForTerm(id) {
  const res = await api.get(`/exams/terms/${encodeURIComponent(id)}/registrations`);
  return Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);
}

export default {
  listAvailableTerms,
  listMyTerms,
  registerForTerm,
  unregisterFromTerm,
  listTeacherTerms,
  createExamTerm,
  updateExamTerm,
  deleteExamTerm,
  listRegistrationsForTerm,
};
