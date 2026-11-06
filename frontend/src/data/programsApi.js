// src/data/programsApi.js
import api from '../utils/apiClient';

export const fetchPrograms = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.faculty) params.append('faculty', filters.faculty);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);
  
  const query = params.toString();
  return await api.get(`/catalog/programs${query ? `?${query}` : ''}`);
};

export const createProgram = async (data) => {
  return await api.post('/catalog/programs', {
    name: data.name,
    code: data.code,
    faculty: data.faculty,
    departmentId: data.departmentId,
    level: data.level,
    description: data.description,
    active: data.active ?? true
  });
};

export const updateProgram = async (id, data) => {
  return await api.put(`/catalog/programs/${id}`, {
    name: data.name,
    code: data.code,
    faculty: data.faculty,
    departmentId: data.departmentId,
    level: data.level,
    description: data.description,
    active: data.active
  });
};

export const deleteProgram = async (id) => {
  return await api.delete(`/catalog/programs/${id}`);
};
