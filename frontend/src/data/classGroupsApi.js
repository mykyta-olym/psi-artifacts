// src/data/classGroupsApi.js
import api from '../utils/apiClient';

export async function listClassGroups(params = {}) {
  return api.get('/class-groups', { params });
}

export async function createClassGroup(data) {
  return api.post('/class-groups', data);
}

export async function updateClassGroup(id, data) {
  return api.put(`/class-groups/${id}`, data);
}

export async function deleteClassGroup(id) {
  return api.del(`/class-groups/${id}`);
}

export async function addStudent(groupId, studentId) {
  return api.post(`/class-groups/${groupId}/students/${studentId}`, {});
}

export async function removeStudent(groupId, studentId) {
  return api.del(`/class-groups/${groupId}/students/${studentId}`);
}

export default {
  listClassGroups,
  createClassGroup,
  updateClassGroup,
  deleteClassGroup,
  addStudent,
  removeStudent,
};
