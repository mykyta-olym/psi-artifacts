// src/data/gradesApi.js
import api from '../utils/apiClient';

export async function listGrades(courseCode, params = {}) {
  return api.get(`/grades/${courseCode}`, { params });
}

export async function createGrade(data) {
  return api.post('/grades', data);
}

export async function updateGrade(id, data) {
  return api.put(`/grades/${id}`, data);
}

export async function deleteGrade(id) {
  return api.del(`/grades/${id}`);
}

export async function getGradingScheme(courseCode) {
  return api.get(`/grades/${courseCode}/scheme`);
}

export async function updateGradingScheme(courseCode, data) {
  return api.put(`/grades/${courseCode}/scheme`, data);
}

export default {
  listGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  getGradingScheme,
  updateGradingScheme,
};
